// HTTP backend multiplexer
const timeoutBackend = 2000;

export function createHttpBackend() {
  let nextId = 1;
  const worker = new Worker(new URL('./sqlite3-vfs-http-worker.js', import.meta.url));

  const consumers = {};

  worker.onmessage = ({data}) => {
    console.log('Received new reply', data);
    switch (data.msg) {
      case 'ack':
        if (!consumers[data.id]) {
          console.error('Invalid response received from backend', data);
          return;
        }
        console.log('New channel created', consumers);
        consumers[data.id].resolve({
          port: consumers[data.id].channel.port2,
          shm: data.shm
        });
        clearTimeout(consumers[data.id].timeout);
        delete consumers[data.id].resolve;
        delete consumers[data.id].timeout;
        return;
    }
  };

  return {
    worker,
    createNewChannel: () => {
      const channel = new MessageChannel();
      const id = nextId++;
      worker.postMessage({msg: 'handshake', port: channel.port1, id}, [channel.port1]);
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          delete consumers[id];
          reject('Timeout while waiting on backend');
        }, timeoutBackend);
        consumers[id] = { id, channel, resolve, timeout };
      });
    }
  }
}
