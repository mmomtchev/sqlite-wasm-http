import { createSQLiteThread, createHttpBackend } from 'sqlite-wasm-http';
import './setup.js';

// "moduleResolution: node16" is tsconfig.json is needed only if
// using direct access to the included sqlite3 distribution
import sqlite from 'sqlite-wasm-http/sqlite3.js';
if (typeof sqlite !== 'function')
  throw new Error('Importing sqlite3 subpath export failed');

it('test', async () => {
  const httpBackend = createHttpBackend({
    maxPageSize: 1024,
    timeout: 10000
  });
  const db = await createSQLiteThread({ http: httpBackend });

  await db('config-get', {});

  await db('open', {
    filename: 'file:' + encodeURI('https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles'),
    vfs: 'http'
  });

  let rows = 0;
  await db('exec', {
    sql: 'SELECT * FROM tiles WHERE zoom_level = 1',
    callback: function (row) {
      rows++;
    }
  });

  if (rows != 5)
    throw new Error('test failed');
});
