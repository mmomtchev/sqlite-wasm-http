// This is the user-facing API
import '../deps/dist/sqlite3-bundler-friendly.mjs';
import '../deps/dist/sqlite3-worker1-promiser-bundler-friendly.js'; 
import * as VFSHTTP from './vfs-http-types';
import { debug } from './vfs-http-types';

export interface SQLiteOptions {
  http?: VFSHTTP.Backend;
};
export { Backend, BackendChannel, Options as HTTPOptions } from './vfs-http-types';
declare global {
  export var sqlite3Worker1Promiser: (config: SQLite.PromiserConfig) => SQLite.Promiser;
}

export function createSQLiteThread(options?: SQLiteOptions): Promise<SQLite.Promiser> {
  debug['threads']('Creating new SQLite thread', options);
  const r = new Promise<SQLite.Promiser>((resolve, reject) => {
    const promiser = sqlite3Worker1Promiser({
      onready: () => {
        resolve(promiser);
      },
      worker: () => {
        try {
          const w = new Worker(new URL('./sqlite-worker.ts', import.meta.url));
          w.onerror = (event) => console.error('Worker bootstrap failed', event);
          if (options?.http) {
            options.http.createNewChannel()
              .then((channel) => {
                w.postMessage({ httpChannel: channel }, [channel.port]);
              });
          } else {
            w.postMessage({});
          }
          return w;
        } catch (e) {
          console.error('Failed to create SQLite worker', e);
          reject(e);
        }
      }
    });
  });

  return r;
}

// HTTP backend multiplexer
export function createHttpBackend(options?: VFSHTTP.Options): VFSHTTP.Backend {
  debug['threads']('Creating new HTTP VFS backend thread');
  let nextId = 1;
  const worker = new Worker(new URL('./vfs-http-worker.ts', import.meta.url));
  options = VFSHTTP.defaultOptions(options);
  worker.postMessage({msg: 'init', options});

  const consumers = {};

  worker.onmessage = ({ data }) => {
    debug['threads']('Received control message reply', data);
    switch (data.msg) {
      case 'ack':
        if (!consumers[data.id]) {
          console.error('Invalid response received from backend', data);
          return;
        }
        debug['threads']('New HTTP VFS channel created', consumers);
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
    createNewChannel: (): Promise<VFSHTTP.BackendChannel> => {
      debug['threads']('Creating new HTTP VFS channel');
      const channel = new MessageChannel();
      const id = nextId++;
      worker.postMessage({ msg: 'handshake', port: channel.port1, id }, [channel.port1]);
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          delete consumers[id];
          reject('Timeout while waiting on backend');
        }, options.timeout);
        consumers[id] = { id, channel, resolve, timeout };
      });
    }
  };
}
