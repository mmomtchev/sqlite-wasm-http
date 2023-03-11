// This is the entry point for an SQLite worker thread
import sqlite3q from '#sqlite3.js';
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
  sqlite3q().then((sqlite3) => {
    debug['threads']('SQLite init');
    sqlite3.initWorker1API();
    if (typeof msg.httpChannel === 'object') {
      installHttpVfs(sqlite3, msg.httpChannel);
    } else if (msg.httpChannel === true) {
      if (typeof globalThis.XMLHttpRequest === 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).XMLHttpRequest = class XMLHttpRequest extends _XMLHttpRequest {
          get response() {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = Uint8Array.from((this as any).responseText.split('').map(x => x.charCodeAt())).buffer;
            return r;
          }
        };
      }

      installSyncHttpVfs(sqlite3, VFSHTTP.defaultOptions(msg.httpOptions));
    }
  });
};
