import { createSQLiteThread, createHttpBackend } from 'sqlite-wasm-http';

const resultsDiv = document.querySelector('#results');

(async function main() {
  const httpBackend = createHttpBackend({
    maxPageSize: 1024,
    timeout: 10000
  });
  const db = await createSQLiteThread({ http: httpBackend });

  let msg: SQLite.Response;

  resultsDiv.innerHTML += '<div>get-config</div>';
  msg = await db('config-get', {});
  resultsDiv.innerHTML += `<div>${JSON.stringify(msg)}</div>`;

  const remoteDB = 'https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';
  resultsDiv.innerHTML += `<div>open ${remoteDB}</div>`;
  msg = await db('open', {
    filename: 'file:' + encodeURI(remoteDB),
    vfs: 'http'
  });
  resultsDiv.innerHTML += `<div>${JSON.stringify(msg)}</div>`;

  resultsDiv.innerHTML += '<div>SELECT * FROM tiles WHERE zoom_level = 0</div>';
  msg = await db('exec', {
    sql: 'SELECT * FROM tiles WHERE zoom_level = 0',
    callback: function (row) {
      if (row.row)
        resultsDiv.innerHTML += `<div>row: ${JSON.stringify(row)}</div>`;
      else
        resultsDiv.innerHTML += `<div>end of rows</div>`;
    }
  });
  resultsDiv.innerHTML += `<div>${JSON.stringify(msg)}</div>`;

  resultsDiv.innerHTML += '<div>SELECT * FROM tiles WHERE zoom_level = 1</div>';
  msg = await db('exec', {
    sql: 'SELECT * FROM tiles WHERE zoom_level = 1',
    callback: function (row) {
      if (row.row)
        resultsDiv.innerHTML += `<div>row: ${JSON.stringify(row)}</div>`;
      else
        resultsDiv.innerHTML += `<div>end of rows</div>`;
    }
  });
  resultsDiv.innerHTML += `<div>${JSON.stringify(msg)}</div>`;
})();
