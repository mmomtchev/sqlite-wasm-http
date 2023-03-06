import { createSQLiteThread, createHttpBackend } from 'sqlite-wasm-http';

(async function main() {
  const httpBackend = createHttpBackend({
    maxPageSize: 1024,
    timeout: 10000
  });
  const promiser = await createSQLiteThread({ http: httpBackend });

  console.log(promiser('config-get', {}));

  console.log(await promiser('open', {
    filename: 'file:' + encodeURI('http://sokol.garga/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles'),
    vfs: 'http'
  }));

  console.log(await promiser('exec', {
    sql: 'SELECT * FROM tiles WHERE zoom_level = 1',
    callback: function (row) {
      console.log('got row', row);
    }
  }));

  console.log(await promiser('exec', {
    sql: 'SELECT * FROM tiles WHERE zoom_level = 1',
    callback: function (row) {
      console.log('got row', row);
    }
  }));
})();
