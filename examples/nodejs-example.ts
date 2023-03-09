import { createSQLiteThread, createHttpBackend } from '../dist/index.js';
import '../test/setup.js'

(async () => {
// MBTiles is a common format for storing both vector and raster maps in an SQLite database
const remoteURL = 'https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';
const httpBackend = createHttpBackend({
  maxPageSize: 4096,    // this is the current default SQLite page size
  timeout: 10000,       // 10s
  cacheSize: 4096       // 4 MB
});
// Multiple DB workers can be created, all sharing the same backend cache
const db = await createSQLiteThread({ http: httpBackend });
await db('open', { filename: 'file:' + encodeURI(remoteURL), vfs: 'http' });
await db('exec', {
  sql: 'SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles ' +
    'WHERE zoom_level = 10 AND tile_column = $col AND tile_row = $row',
  bind: { $col: 600, $row: 600 },
  callback: (msg) => {
    if (msg.row) {
      console.log(msg.columnNames);
      console.log(msg.row);
    } else {
      console.log('end');
    }
  }
});
// This closes the DB connection
await db('close', {});
// This terminates the SQLite worker
db.close();
await httpBackend.close();
})();