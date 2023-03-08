// This is the entry point for an SQLite worker thread
import sqlite3q from '#sqlite3.js'; 
import { installHttpVfs } from './vfs-http.js';
import * as VFSHTTP from './vfs-http-types.js';
import { debug } from './vfs-http-types.js';

debug['threads']('SQLite worker started');
globalThis.onmessage = ({ data }) => {
  debug['threads']('SQLite received green light', data);
  const msg = data as { httpChannel?: VFSHTTP.BackendChannel; };
  sqlite3q().then((sqlite3) => {
    debug['threads']('SQLite init');
    sqlite3.initWorker1API();
    if (msg.httpChannel) {
      installHttpVfs(sqlite3, msg.httpChannel, {});
    }
  });
};
