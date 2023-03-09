import { createSQLiteThread, createHttpBackend } from 'sqlite-wasm-http';

(async function main() {
  const httpBackend = createHttpBackend({
    maxPageSize: 1024,
    timeout: 10000
  });
  const db = await createSQLiteThread({ http: httpBackend });

  console.log(await db('config-get', {}));

  console.log(await db('open', {
    filename: 'file:' + encodeURI('https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles'),
    vfs: 'http'
  }));

  console.log(await db('exec', {
    sql: 'SELECT * FROM tiles WHERE zoom_level = 1',
    callback: function (row) {
      console.log('got row', row);
    }
  }));

  console.log(await db('exec', {
    sql: 'SELECT * FROM tiles WHERE zoom_level = 0',
    callback: function (row) {
      console.log('got row', row);
    }
  }));
})();
