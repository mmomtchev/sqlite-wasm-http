import sqlite3 from '../deps/sqlite/ext/wasm/jswasm/sqlite3-bundler-friendly.mjs';

import '../deps/sqlite/ext/wasm/jswasm/sqlite3-worker1-promiser-bundler-friendly.js';

const promiser = sqlite3Worker1Promiser({
  onready: () => {
    promiser('config-get', {})
      .then((r) => console.log(r));
    promiser('open', {
      filename: 'file:' +
        encodeURI('http://sokol.garga/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles') +
        '?vfs=http&mode=ro'
    })
      .then((msg) => {
        console.log(msg);
        return promiser('exec', {
          sql: 'select * from tiles where zoom_level = 1',
          callback: function(row) {
            console.log('got row', row);
          }
        })
      })
      .then((msg) => {
        console.log(msg);
      });
  },
  worker: () => {
    const w = new Worker(new URL('./worker.js', import.meta.url));
    w.onerror = (event) => console.error("worker.onerror", event);
    return w;
  }
});
