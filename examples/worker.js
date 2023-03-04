import sqlite3 from '../deps/sqlite/ext/wasm/jswasm/sqlite3-bundler-friendly.mjs';
import { installhttpVfs } from '../src/sqlite3-vfs-http.js';
import { createHttpBackend } from '../src/sqlite3-vfs-http-muxer';

const backend = createHttpBackend();
Promise.all([sqlite3(), backend.createNewChannel()])
  .then(([sqlite3, channel]) => {
    console.log('sqlite loaded', sqlite3);
    console.log('got new channel', channel);
    sqlite3.initWorker1API();
    console.log('sqlite initialized', sqlite3);
    installhttpVfs(sqlite3, { backend: channel });
  });
