// This is the user-facing API
// It runs in the user-thread (which is probably the main UI thread)
import '#sqlite3.js';
import '#sqlite3-worker1-promiser.js';
import { debug } from './vfs-http-types.js';
import * as VFSHTTP from './vfs-http-types.js';
import * as SQLite from '../deps/types/sqlite3.js';

export * as VFSHTTP from './vfs-http-types.js';

export interface SQLiteOptions {
  http?: VFSHTTP.Backend;
}

declare global {
  // eslint-disable-next-line no-var
  export var sqlite3Worker1Promiser: (config: SQLite.PromiserConfig) => SQLite.Promiser;
}

/**
 * Creates a new SQLite worker thread, can accept an optional HTTP backend for HTTP support.
 * 
 * The sync backend is particularly inefficient in Node.js and should never be used except for unit-testing browser
 * code.
 * 
 * @param {SQLiteOptions} [options] Options object
 * @param {VFSHTTP.Backend | true} [options.http] Optional HTTP backend, either a shared one or a dedicated sync one
 * @returns {Promise<SQLite.Promiser>}
 */
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
          const backend = options?.http;
          // This is the SQLite worker green light
          if (backend?.type === 'shared') {
            backend.createNewChannel()
              .then((channel) => {
                worker.postMessage({ httpChannel: channel, httpOptions: backend.options }, [channel.port]);
              });
          } else if (backend?.type === 'sync') {
            worker.postMessage({ httpChannel: true, httpOptions: backend.options });
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

const noSharedBufferMsg = 'SharedArrayBuffer is not available. ' +
  'If your browser supports it, the webserver must send ' +
  '"Cross-Origin-Opener-Policy: same-origin "' +
  'and "Cross-Origin-Embedder-Policy: require-corp" headers.';
/**
 * Creates a new HTTP backend worker that can support multiple SQLite threads.
 * The cache is shared only if the environment supports SharedArrayBuffer.
 * 
 * This is always the case in Node.js, but it requires a cross-origin isolated
 * environment in the browser.
 * 
 * @param {VFSHTTP.Options} [options] Options object
 * @returns {VFSHTTP.Backend}
 */
export function createHttpBackend(options?: VFSHTTP.Options): VFSHTTP.Backend {
  debug['threads']('Creating new HTTP VFS backend thread');

  if (typeof SharedArrayBuffer === 'undefined' || options?.backendType === 'sync') {
    if (options?.backendType === 'shared') throw new Error(noSharedBufferMsg);
    if (options?.backendType !== 'sync')
      console.warn(noSharedBufferMsg + ' Falling back to the legacy HTTP backend.');
    return {
      type: 'sync',
      worker: null,
      options,
      createNewChannel: () => undefined,
      close: () => Promise.resolve(),
      terminate: () => undefined
    };
  }

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
    type: 'shared',
    worker,
    options,
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

export interface SQLiteHTTPPool {
  /**
   * Open a new remote database
   * @param {string} url Remote database
   * @returns {Promise<void>}
   */
  open: (url: string) => Promise<void>;

  /**
   * Dispose of the pool (stops the background workers)
   * @returns {Promise<void>}
   */
  close: () => Promise<void>;

  /**
   * Run an SQL statement
   * @param {string} sql SQL statement
   * @param {Record<string, unknown>} [bind] Optional map of values to be binded
   * @returns {Promise<void>}
   */
  exec: (sql: string, bind?: Record<string, unknown>) => Promise<SQLite.Row[]>;
}

type PoolThread = {
  worker: SQLite.Promiser;
  busy: null | Promise<void>;
};

/**
 * Higher-level API for working with a pool
 * @param {number} [opts.workers] Number of concurrent workers to spawn, @default 1
 * @param {VFSHTTP.Options} [opts.httpOptions] Options to pass to the HTTP backend
 */
export async function createSQLiteHTTPPool(opts: {
  workers?: number,
  httpOptions?: VFSHTTP.Options;
}): Promise<SQLiteHTTPPool> {
  const backend = createHttpBackend(opts?.httpOptions);

  const workers: PoolThread[] = [];
  const startq: Promise<void>[] = [];
  for (let i = 0; i < (opts.workers ?? 1); i++) {
    startq.push(createSQLiteThread({ http: backend })
      .then((worker) =>
        workers.push({
          worker,
          busy: null
        }))
      .then(() => undefined));
  }
  await Promise.all(startq);

  return {
    open: (url: string) =>
      Promise.all(workers.map((w) => w.worker('open', {
        filename: 'file:' + encodeURI(url),
        vfs: 'http'
      })))
        .then(() => undefined),

    close: () =>
      Promise.all(workers.map((w) => w.worker.close()))
        .then(() => backend.close()),

    exec: async function (sql: string, bind?: Record<string, unknown>) {
      let w: PoolThread | undefined;
      do {
        w = workers.find((w) => !w.busy);
        if (!w)
          await Promise.race(workers.map((w) => w.busy)).catch(() => undefined);
      } while (!w);

      const results: SQLite.Row[] = [];
      w.busy = w.worker('exec', {
        sql,
        bind,
        callback: (row) => {
          if (row.row)
            results.push(row);
        }
      })
        .then(() => undefined);
      await w.busy;

      w.busy = null;
      return results;
    }
  };
}
