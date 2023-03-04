if (typeof WorkerGlobalScope === 'undefined' || !(self instanceof WorkerGlobalScope))
  throw new Error('This script must run in a WebWorker');

const pageSize = 1024;

const consumers = {};
const openFiles = {};

async function open(msg) {
  if (openFiles[msg.fid])
    throw new Error(`File ${msg.fid} already open`);

  const head = await fetch(msg.name, { method: 'HEAD' });
  if (head.headers.get('Accept-Ranges') !== 'bytes') {
    console.warn(`Server for ${msg.name} does not advertise 'Accept-Ranges'. ` +
      'If the server supports it, in order to remove this message, add "Accept-Ranges: bytes". ' +
      'Additionally, if using CORS, add "Access-Control-Expose-Headers: *".');
  }
  openFiles[msg.fid] = {
    fid: msg.fid,
    url: msg.name,
    size: BigInt(head.headers.get('Content-Length'))
  };

  return 0;
}

async function access(msg, dest) {
  const result = new Uint32Array(dest, 0, 1);
  try {
    const head = await fetch(msg.name, { method: 'HEAD' });
    if (head.headers.get('Accept-Ranges') !== 'bytes') {
      console.warn(`Server for ${msg.name} does not advertise 'Accept-Ranges'. ` +
        'If the server supports it, in order to remove this message, add "Accept-Ranges: bytes". ' +
        'Additionally, if using CORS, add "Access-Control-Expose-Headers: *".');
    }
    result[0] = 1;
  } catch {
    result[0] = 0;
  }

  return 0;
}

async function read(msg, dest) {
  if (!openFiles[msg.fid])
    throw new Error(`File ${msg.fid} not open`);

  const resp = await fetch(openFiles[msg.fid].url, {
    method: 'GET',
    headers: {
      'Range': `bytes=${Number(msg.offset)}-${Number(msg.offset) + msg.n - 1}`
    }
  });

  const data = new Uint8Array(await resp.arrayBuffer());
  dest.set(data);
  return 0;
}

function filesize(msg, shm) {
  if (!openFiles[msg.fid])
    throw new Error(`File ${msg.fid} not open`);

  (new BigInt64Array(shm, 0, 1))[0] = openFiles[msg.fid].size;
  return 0;
}

async function workMessage({ data }) {
  console.log('Received new work message', this, data);
  let r;
  try {
    switch (data.msg) {
      case 'open':
        r = await open(data);
        break;
      case 'access':
        r = await access(data, this.shm);
        break;
      case 'read':
        r = await read(data, this.buffer);
        break;
      case 'filesize':
        r = await filesize(data, this.shm);
        break;
    }

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
