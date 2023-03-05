import LRUCache from 'lru-cache';
import { ntoh16 } from './endianness';

const maxPageSize = 16384;

if (typeof WorkerGlobalScope === 'undefined' || !(self instanceof WorkerGlobalScope))
  throw new Error('This script must run in a WebWorker');

// The set of sqlite Workers that use this backend
const consumers = {};

// The list of known URLs and retrieved pages
const cache = {};

const backendAsyncMethods = {
  // HTTP is a stateless protocol, so xOpen means verify if the URL is valid
  xOpen: async function (msg) {
    if (cache[msg.name])
      return 0;

    const head = await fetch(msg.name, { method: 'HEAD' });
    if (head.headers.get('Accept-Ranges') !== 'bytes') {
      console.warn(`Server for ${msg.name} does not advertise 'Accept-Ranges'. ` +
        'If the server supports it, in order to remove this message, add "Accept-Ranges: bytes". ' +
        'Additionally, if using CORS, add "Access-Control-Expose-Headers: *".');
    }
    cache[msg.name] = {
      size: BigInt(head.headers.get('Content-Length')),
      // This will be determined on the first read
      pageSize: null,
      pageCache: new LRUCache({
        max: 1024
      })
    };

    return 0;
  },

  // There is no real difference between xOpen and xAccess, only the semantics differ
  xAccess: async function (msg, consumer) {
    const result = new Uint32Array(consumer.shm, 0, 1);
    try {
      const r = await backendAsyncMethods.xOpen(msg);
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
    const entry = cache[msg.name];

    if (!entry)
      throw new Error(`File ${msg.name} not open`);
    const offset = Number(msg.offset);

    if (!entry.pageSize) {
      // Determine the page size if we don't know it
      // It is in two big-endian bytes at offset 16 in what is always the first page
      entry.pageSize = 1024;
      const pageDataBuffer = new ArrayBuffer(2);
      const r = await backendAsyncMethods.xRead({ name: msg.name, offset: 16, n: 2 },
        { buffer: new Uint8Array(pageDataBuffer) });
      const pageData = new Uint16Array(pageDataBuffer);
      if (r !== 0)
        return r;
      ntoh16(pageData);
      entry.pageSize = pageData[0];
      if (entry.pageSize != 1024) {
        // If the page size is not 1024 we can't keep this "page" in the cache
        console.warn(`Page size for ${msg.name} is ${entry.pageSize}, recommended size is 1024`);
        entry.pageCache.delete(0);
      }
      if (entry.pageSize > maxPageSize)
        throw new Error(`${entry.pageSize} is over the maximum supported ${maxPageSize}`);
    }

    const page = Math.floor(offset / entry.pageSize);
    if (page * entry.pageSize !== offset)
      console.warn(`Read chunk ${msg.offset} is not page-aligned`);
    const pageStart = page * entry.pageSize;
    if (pageStart + entry.pageSize < offset + msg.n)
      throw new Error(`Read chunk ${offset}:${msg.n} spans across a page-boundary`);
    let data = entry.pageCache.get(page);

    if (!data) {
      console.log(`cache miss for ${msg.name}:${page}`);
      const resp = await fetch(msg.name, {
        method: 'GET',
        headers: {
          'Range': `bytes=${pageStart}-${pageStart + entry.pageSize - 1}`
        }
      });
      data = new Uint8Array(await resp.arrayBuffer());
      entry.pageCache.set(page, data);
    } else {
      console.log(`cache hit for ${msg.name}:${page}`);
    }

    const pageOffset = offset - pageStart;
    consumer.buffer.set(data.subarray(pageOffset, pageOffset + msg.n));
    return 0;
  },

  // This is cached
  xFilesize: async function (msg, consumer) {
    if (!cache[msg.name])
      throw new Error(`File ${msg.fid} not open`);

    (new BigInt64Array(consumer.shm, 0, 1))[0] = cache[msg.name].size;
    return 0;
  }
};

async function workMessage({ data }) {
  console.log('Received new work message', this, data);
  let r;
  try {
    r = await backendAsyncMethods[data.msg](data, this);

    console.log('operation successful', this, r);
    Atomics.store(this.lock, 0, r);
  } catch (e) {
    console.error(e);
    Atomics.store(this.lock, 0, 1);
  }
  Atomics.notify(this.lock, 0);
}

onmessage = ({ data }) => {
  console.log('Received new control message', data);
  switch (data.msg) {
    case 'handshake':
      const shm = new SharedArrayBuffer(maxPageSize + Int32Array.BYTES_PER_ELEMENT);
      const lock = new Int32Array(shm, maxPageSize);
      const buffer = new Uint8Array(shm, 0, maxPageSize);
      lock[0] = 0xffff;
      consumers[data.id] = { id: data.id, port: data.port, shm, lock, buffer };
      postMessage({ msg: 'ack', id: data.id, shm, lock });
      data.port.onmessage = workMessage.bind(consumers[data.id]);
      break;
  }
};
