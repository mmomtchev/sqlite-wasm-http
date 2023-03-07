// This is the entry point for an SQLite worker thread
import sqlite3q from '../deps/sqlite/ext/wasm/jswasm/sqlite3-bundler-friendly.mjs'; 
import { installHttpVfs } from '../src/vfs-http';
import * as VFSHTTP from './vfs-http-types';
import { debug } from './vfs-http-types';

debug['threads']('SQLite worker started');
onmessage = ({ data }) => {
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
