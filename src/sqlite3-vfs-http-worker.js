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
      size: BigInt(head.headers.get('Content-Length'))
    };

    return 0;
  },

  xAccess: async function (msg, consumer) {
    const result = new Uint32Array(consumer.shm, 0, 1);
    const r = backendAsyncMethods.xOpen(msg);
    if (r === 0) {
      result[0] = 1;
    } else {
      result[0] = 0;
    }

    return 0;
  },

  xRead: async function (msg, consumer) {
    if (!cache[msg.name])
      throw new Error(`File ${msg.name} not open`);

    const resp = await fetch(msg.name, {
      method: 'GET',
      headers: {
        'Range': `bytes=${Number(msg.offset)}-${Number(msg.offset) + msg.n - 1}`
      }
    });

    const data = new Uint8Array(await resp.arrayBuffer());
    consumer.buffer.set(data);
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
