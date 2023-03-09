// This is the user-facing API
/// <reference path='../deps/types/sqlite3.d.ts' />
/// <reference path='../deps/types/sqlite3-promiser.d.ts' />
import '#sqlite3.js';
import '#sqlite3-worker1-promiser.js';
import { debug } from './vfs-http-types.js';
import * as VFSHTTP from './vfs-http-types.js';
export * as VFSHTTP from './vfs-http-types.js';

export interface SQLiteOptions {
  http?: VFSHTTP.Backend;
};

declare global {
  export var sqlite3Worker1Promiser: (config: SQLite.PromiserConfig) => SQLite.Promiser;
}

export function createSQLiteThread(options?: SQLiteOptions): Promise<SQLite.Promiser> {
  debug['threads']('Creating new SQLite thread', options);
  let worker: Worker;
  const r = new Promise<SQLite.Promiser>((resolve, reject) => {
    const promiser = sqlite3Worker1Promiser({
      onready: () => {
        resolve(promiser);
      },
      worker: () => {
        try {
          worker = new Worker(new URL('./sqlite-worker.js', import.meta.url));
          worker.onerror = (event) => console.error('Worker bootstrap failed', event);
          if (options?.http) {
            options.http.createNewChannel()
              .then((channel) => {
                worker.postMessage({ httpChannel: channel }, [channel.port]);
              });
          } else {
            worker.postMessage({});
          }
          return worker;
        } catch (e) {
          console.error('Failed to create SQLite worker', e);
          reject(e);
        }
      }
    });
  }).then((p) => {
    p.close = () => {
      worker.terminate();
    };
    return p;
  });

  return r;
}

// HTTP backend multiplexer
export function createHttpBackend(options?: VFSHTTP.Options): VFSHTTP.Backend {
  debug['threads']('Creating new HTTP VFS backend thread');
  let nextId = 1;
  const worker = new Worker(new URL('./vfs-http-worker.js', import.meta.url));
  options = VFSHTTP.defaultOptions(options);
  worker.postMessage({ msg: 'init', options });

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
    createNewChannel: function () {
      debug['threads']('Creating a new HTTP VFS channel');
      const channel = new MessageChannel();
      const id = nextId++;
      worker.postMessage({ msg: 'handshake', port: channel.port1, id }, [channel.port1]);
      return new Promise<VFSHTTP.BackendChannel>((resolve, reject) => {
        const timeout = setTimeout(() => {
          delete consumers[id];
          reject('Timeout while waiting on backend');
        }, options.timeout);
        consumers[id] = { id, channel, resolve, timeout };
      });
    },
    terminate: function () {
      worker.terminate();
    },
    close: function () {
      debug['threads']('Closing the HTTP VFS channel');
      worker.postMessage({ msg: 'close' });
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject('Timeout while waiting on backend');
        }, options.timeout);
        worker.onmessage = ({ data }) => {
          debug['threads']('Received close response', data);
          if (data.msg === 'ack' && data.id === undefined) {
            resolve();
            clearTimeout(timeout);
          }
        };
      });
    },
  };
}
