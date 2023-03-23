import { createSQLiteThread, createHttpBackend } from 'sqlite-wasm-http';
import sqlite from 'sqlite-wasm-http/sqlite3.js';

import './setup.js';

if (typeof sqlite !== 'function')
  throw new Error('Importing sqlite3 subpath export failed');

(async function main() {
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

  const rows = [];

  await db('exec', {
    sql: 'SELECT * FROM tiles WHERE zoom_level = 1',
    callback: function (row) {
      rows.push(row);
    }
  });

  await db('exec', {
    sql: 'SELECT * FROM tiles WHERE zoom_level = 0',
    callback: function (row) {
      rows.push(row);
    }
  });

  if (rows.length < 6)
    throw new Error('Could not retrieve all rows');

  await db('close', {});
  db.close();
  await httpBackend.close();
})();
