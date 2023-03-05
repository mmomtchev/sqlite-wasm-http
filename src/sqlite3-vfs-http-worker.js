import LRUCache from 'lru-cache';

if (typeof WorkerGlobalScope === 'undefined' || !(self instanceof WorkerGlobalScope))
  throw new Error('This script must run in a WebWorker');

const pageSize = 1024;

const consumers = {};
const cache = {};

const backendAsyncMethods = {
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
      pageCache: new LRUCache({
        max: 1024
      })
    };

    return 0;
  },

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

    const page = Math.floor(offset / pageSize);
    if (page * pageSize !== offset)
      console.warn(`Read chunk ${msg.offset} is not page-aligned`);
    const pageStart = page * pageSize;
    if (pageStart + pageSize < offset + msg.n)
      throw new Error(`Read chunk ${offset}:${msg.n} spans across a page-boundary`);
    let data = entry.pageCache.get(page);

    if (!data) {
      console.log(`cache miss for ${msg.name}:${page}`);
      const resp = await fetch(msg.name, {
        method: 'GET',
        headers: {
          'Range': `bytes=${pageStart}-${pageStart + pageSize - 1}`
        }
      });
      data = new Uint8Array(await resp.arrayBuffer());
      entry.pageCache.set(page, data);
    } else {
      console.log(`cache hit for ${msg.name}:${page}`);
    }

    const pageOffset = offset - pageStart;
    consumer.buffer.set(data.subarray(pageOffset, msg.n));
    return 0;
  },

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
      const shm = new SharedArrayBuffer(pageSize + Int32Array.BYTES_PER_ELEMENT);
      const lock = new Int32Array(shm, pageSize);
      const buffer = new Uint8Array(shm, 0, pageSize);
      lock[0] = 0xffff;
      consumers[data.id] = { id: data.id, port: data.port, shm, lock, buffer };
      postMessage({ msg: 'ack', id: data.id, shm, lock });
      data.port.onmessage = workMessage.bind(consumers[data.id]);
      break;
  }
};
