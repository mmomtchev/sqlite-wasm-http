// This is the entry point for an HTTP backend thread
// It can serve multiple SQLite worker threads

import LRUCache from 'lru-cache';
import * as VFSHTTP from './vfs-http-types.js';
import { ntoh16 } from './endianness.js';
import { debug } from './vfs-http-types.js';

let options: VFSHTTP.Options;

// This identifies an SQLite worker thread
interface Consumer {
  id: number;
  port: MessagePort;
  shm: SharedArrayBuffer;
  lock: Int32Array;
  buffer: Uint8Array;
}
// The set of sqlite Workers that use this backend
const consumers: Record<string, Consumer> = {};

// The list of known URLs and retrieved pages
interface FileEntry {
  id: number;
  url: string;
  size: bigint;
  pageSize: number | null;
}
const files = new LRUCache<string, FileEntry | Promise<FileEntry>>({
  max: 32
});

// The entry for a given page can be either the page itself
// or the number of the page that has the parent super-page
// Here is an example of a cache structure (indexed by the URL + page number)
// URL|0 -> Uint8Array(page)                     # This page is in cache
// URL|1 -> undefined                            # These two
// URL|2 -> undefined                            # are not
// URL|3 -> Promise<Uint8Array(page * 2)>        # This is a currently downloading 2-page segment
// URL|4 -> Promise<3>                           # This references the previous one
// URL|5 -> 2                                    # An invalid stale entry that will be overwritten
let cache: LRUCache<string, Uint8Array | number | Promise<Uint8Array | number>>;

let nextId = 1;

const backendAsyncMethods:
  Record<VFSHTTP.Operation,
    (msg: VFSHTTP.Message, consumer: Consumer) => Promise<number>> = {
  // HTTP is a stateless protocol, so xOpen means verify if the URL is valid
  xOpen: async function (msg) {
    let entry = files.get(msg.url);
    if (entry instanceof Promise)
      entry = await entry;
    if (entry !== undefined)
      return 0;

    // Set a promise for the next opener of the same file to await upon
    entry = fetch(msg.url, { method: 'HEAD', headers: { ...options?.headers } })
      .then((head) => {
        if (head.headers.get('Accept-Ranges') !== 'bytes') {
          console.warn(`Server for ${msg.url} does not advertise 'Accept-Ranges'. ` +
            'If the server supports it, in order to remove this message, add "Accept-Ranges: bytes". ' +
            'Additionally, if using CORS, add "Access-Control-Expose-Headers: *".');
        }
        return {
          url: msg.url,
          id: nextId++,
          size: BigInt(head.headers.get('Content-Length') ?? 0),
          // This will be determined on the first read
          pageSize: null
        };
      });
    files.set(msg.url, entry);
    // Replace it with the actual entry once resolved
    files.set(msg.url, await entry);

    return 0;
  },

  // There is no real difference between xOpen and xAccess, only the semantics differ
  xAccess: async function (msg, consumer) {
    const result = new Uint32Array(consumer.shm, 0, 1);
    try {
      const r = await backendAsyncMethods.xOpen(msg, consumer);
      if (r === 0) {
        result[0] = 1;
      } else {
        result[0] = 0;
      }
    } catch {
      result[0] = 0;
    }

    return 0;
  },

  xRead: async function (msg, consumer) {
    let entry = files.get(msg.url);

    if (!entry)
      throw new Error(`File ${msg.url} not open`);
    if (entry instanceof Promise)
      entry = await entry;

    if (msg.n === undefined || msg.offset === undefined)
      throw new Error('Mandatory arguments missing');

    if (!entry.pageSize) {
      // Determine the page size if we don't know it
      // It is in two big-endian bytes at offset 16 in what is always the first page
      entry.pageSize = 1024;
      const pageDataBuffer = new ArrayBuffer(2);
      const r = await backendAsyncMethods.xRead({ msg: 'xRead', url: msg.url, offset: BigInt(16), n: 2 },
        { buffer: new Uint8Array(pageDataBuffer) } as Consumer);
      const pageData = new Uint16Array(pageDataBuffer);
      if (r !== 0)
        return r;
      ntoh16(pageData);
      entry.pageSize = pageData[0];
      debug['vfs'](`page size is ${entry.pageSize}`);
      if (entry.pageSize != 1024) {
        // If the page size is not 1024 we can't keep this "page" in the cache
        console.warn(`Page size for ${msg.url} is ${entry.pageSize}, recommended size is 1024`);
        cache.delete(entry.id + '|0');
      }
      if (entry.pageSize > (options?.maxPageSize ?? VFSHTTP.defaultOptions.maxPageSize))
        throw new Error(`${entry.pageSize} is over the maximum configured ` +
          `${options?.maxPageSize ?? VFSHTTP.defaultOptions.maxPageSize}`);
    }

    const pageSize = BigInt(entry.pageSize);
    const len = BigInt(msg.n);
    const page = msg.offset / pageSize;
    if (page * pageSize !== msg.offset)
      debug['vfs'](`Read chunk ${msg.offset}:${msg.n} is not page-aligned`);
    let pageStart = page * pageSize;
    if (pageStart + pageSize < msg.offset + len)
      throw new Error(`Read chunk ${msg.offset}:${msg.n} spans across a page-boundary`);

    const cacheId = entry.id + '|' + page;
    let data = cache.get(cacheId);
    if (data instanceof Promise)
      // This means that another thread has requested this segment
      data = await data;

    if (typeof data === 'number') {
      debug['cache'](`cache hit (multi-page segment) for ${msg.url}:${page}`);

      // This page is present as a segment of a super-page
      const newPageStart = BigInt(data) * pageSize;
      data = cache.get(entry.id + '|' + data);
      if (data instanceof Promise)
        data = await data;
      if (data instanceof Uint8Array) {
        // Not all subpages are valid, there are two possible cases
        // where a non-valid superpage can be referenced:
        // * the superpage was too big to fit in the cache
        // * the superpage was evicted before the subsegments
        pageStart = newPageStart;
      } else {
        data = undefined as unknown as Uint8Array;
      }
    }

    if (typeof data === 'undefined') {
      debug['cache'](`cache miss for ${msg.url}:${page}`);

      let chunkSize = entry.pageSize;
      // If the previous page is in the cache, we double the page size
      // This was the original page merging algorithm implemented by @phiresky
      let prev = page > 0 && cache.get(entry.id + '|' + (Number(page) - 1));
      if (prev) {
        if (prev instanceof Promise)
          prev = await prev;
        if (typeof prev === 'number')
          prev = cache.get(entry.id + '|' + prev) as Uint8Array;
        if (prev instanceof Promise)
          prev = await prev;
        if (prev instanceof Uint8Array) {
          // Valid superpage
          chunkSize = prev.byteLength * 2;
          debug['cache'](`downloading super page of size ${chunkSize}`);
        }
      }
      const pages = chunkSize / entry.pageSize;

      // Download a new segment
      debug['http'](`downloading page ${page} of size ${chunkSize} starting at ${pageStart}`);
      const resp = fetch(msg.url, {
        method: 'GET',
        headers: {
          ...(options?.headers ?? VFSHTTP.defaultOptions.headers),
          'Range': `bytes=${pageStart}-${pageStart + BigInt(chunkSize - 1)}`
        }
      })
        .then((r) => r.arrayBuffer())
        .then((r) => new Uint8Array(r));
      // We synchronously set a Promise in the cache in case another thread
      // tries to read the same segment
      cache.set(cacheId, resp);
      // These point to the parent super-page and resolve at the same time as resp
      for (let i = Number(page) + 1; i < Number(page) + pages; i++) {
        cache.set(entry.id + '|' + i, resp.then(() => Number(page)));
      }

      data = await resp;
      if (!(data instanceof Uint8Array) || data.length === 0)
        throw new Error(`Invalid HTTP response received: ${JSON.stringify(resp)}`);

      // In case of a multiple-page segment, this is the parent super-page
      cache.set(cacheId, data);

      // These point to the parent super-page
      for (let i = Number(page) + 1; i < Number(page) + pages; i++) {
        cache.set(entry.id + '|' + i, Number(page));
      }
    } else {
      debug['cache'](`cache hit for ${msg.url}:${page}`);
    }

    const pageOffset = Number(msg.offset - pageStart);
    consumer.buffer.set(data.subarray(pageOffset, pageOffset + msg.n));
    return 0;
  },

  // This is cached
  xFilesize: async function (msg, consumer) {
    let entry = files.get(msg.url);
    if (!entry)
      throw new Error(`File ${msg.fid} not open`);
    if (entry instanceof Promise)
      entry = await entry;

    const out = new BigInt64Array(consumer.shm, 0, 1);
    out[0] = entry.size;
    return 0;
  }
};

async function workMessage(this: Consumer, { data }: { data: VFSHTTP.Message }) {
  debug['threads']('Received new work message', this, data);
  let r;
  try {
    r = await backendAsyncMethods[data.msg](data, this);

    debug['threads']('operation successful', this, r);
    Atomics.store(this.lock, 0, r);
  } catch (e) {
    console.error(e);
    Atomics.store(this.lock, 0, 1);
  }
  if (Atomics.load(this.lock, 0) === 0xffffff)
    console.warn('0xffffff in sender', data);
  if (Atomics.notify(this.lock, 0) === 0)
    console.warn('no one was notified');
}

globalThis.onmessage = ({ data }) => {
  debug['threads']('Received new control message', data);
  switch (data.msg) {
    case 'handshake':
      {
        const shm = new SharedArrayBuffer((options?.maxPageSize ?? VFSHTTP.defaultOptions.maxPageSize)
          + Int32Array.BYTES_PER_ELEMENT);
        const lock = new Int32Array(shm, (options?.maxPageSize ?? VFSHTTP.defaultOptions.maxPageSize));
        const buffer = new Uint8Array(shm, 0, (options?.maxPageSize ?? VFSHTTP.defaultOptions.maxPageSize));
        Atomics.store(lock, 0, 0xffff);
        consumers[data.id] = { id: data.id, port: data.port, shm, lock, buffer };
        data.port.onmessage = workMessage.bind(consumers[data.id]);
        postMessage({ msg: 'ack', id: data.id, shm, lock });
      }
      break;
    case 'init':
      options = data.options;
      cache = new LRUCache({
        maxSize: (options?.cacheSize ?? VFSHTTP.defaultOptions.cacheSize) * 1024,
        sizeCalculation: (value) => (value as Uint8Array).byteLength ?? 4
      });
      break;
    case 'close':
      postMessage({ msg: 'ack' });
      close();
      break;
    default:
      throw new Error(`Invalid message received by backend: ${data}`);
  }
};

if (typeof SharedArrayBuffer === 'undefined') {
  throw new Error('SharedArrayBuffer is not available. ' +
    'If your browser supports it, the webserver must send ' +
    '"Cross-Origin-Opener-Policy: same-origin "' +
    'and "Cross-Origin-Embedder-Policy: require-corp" headers.');
}
