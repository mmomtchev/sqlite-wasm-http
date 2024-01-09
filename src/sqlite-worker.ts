// This is the entry point for an SQLite worker thread
// It launches the WASM binary in each thread and installs the HTTP VFS driver
// It also intercepts the incoming messages to implement a close protocol
// (as this feature is missing from SQLite WASM)

import { installHttpVfs } from './vfs-http.js';
import { installSyncHttpVfs } from './vfs-sync-http.js';
import * as VFSHTTP from './vfs-http-types.js';
import { debug } from './vfs-http-types.js';

// Binary version of the classic xmlhttprequest (for Node.js)
import { XMLHttpRequest as _XMLHttpRequest } from '#XMLHttpRequest.cjs';

debug['threads']('SQLite worker started');
globalThis.onmessage = ({ data }) => {
  debug['threads']('SQLite received green light', data);
  const msg = data as {
    httpChannel?: VFSHTTP.BackendChannel | boolean | undefined;
    httpOptions?: VFSHTTP.Options;
  };
  import('#sqlite3.js')
    .then((mod) => mod.default())
    .then((sqlite3) => {
      debug['threads']('SQLite init');
      sqlite3.initWorker1API();

      // Install the close interceptor
      const sqlite3Handler = globalThis.onmessage;
      if (!sqlite3Handler) throw new Error('SQL3 WASM failed to init');
      globalThis.onmessage = function (ev) {
        if (ev.data && ev.data.type === 'destroy') {
          debug['threads']('SQLite Worker received destroy');
          globalThis.postMessage({ type: 'ack' });
          globalThis.close();
          return;
        }
        sqlite3Handler.call(this, ev);
      };

      if (typeof msg.httpChannel === 'object') {
        installHttpVfs(sqlite3, msg.httpChannel, msg.httpOptions);
      } else if (msg.httpChannel === true) {
        if (typeof globalThis.XMLHttpRequest === 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).XMLHttpRequest = class XMLHttpRequest extends _XMLHttpRequest {
            get response() {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const r = Uint8Array.from((this as any).responseText.split('')
                .map((x: string) => x.charCodeAt(0))).buffer;
              return r;
            }
          };
        }

        installSyncHttpVfs(sqlite3, msg.httpOptions);
      }
    });
};
