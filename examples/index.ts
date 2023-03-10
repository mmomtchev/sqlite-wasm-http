import { createSQLiteThread, createHttpBackend } from 'sqlite-wasm-http';

(async function main() {
  const httpBackend = createHttpBackend({
    maxPageSize: 1024,
    timeout: 10000
  });
  const db = await createSQLiteThread({ http: httpBackend });
  const remoteDB = 'https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';

  const elUrl = document.getElementById('input-url') as HTMLInputElement;
  const elSql = document.getElementById('input-sql') as HTMLInputElement;
  const btnGo = document.getElementById('btn-go');
  const btnConf = document.getElementById('btn-config');
  const divResults = document.getElementById('results');
  const divMsg = document.getElementById('msg');

  elUrl.value = remoteDB;
  elSql.value = 'SELECT zoom_level, tile_row, tile_column FROM tiles WHERE zoom_level = 1';

  btnConf.addEventListener('click', async () => {
    const msg = await db('config-get', {});
    divMsg.innerHTML = JSON.stringify(msg, null, 4);
    divResults.innerHTML = '';
  });

  for (const ex of Array.from(document.getElementsByClassName('example-sql')))
    ex.addEventListener('click', (el) => {
      elSql.value = el.target.innerText;
  });

  btnGo.addEventListener('click', async () => {
    divMsg.innerHTML = '';
    divResults.innerHTML = '';
    try {
      const msgOpen = await db('open', {
        filename: 'file:' + encodeURI(elUrl.value),
        vfs: 'http'
      });
      divMsg.innerHTML = JSON.stringify(msgOpen, null, 4);

      const msgExec = await db('exec', {
        sql: elSql.value,
        callback: function (row) {
          if (row.row)
            divResults.innerHTML += `<div>row: ${JSON.stringify(row, null, 4)}</div>`;
          else
            console.log('done');
        }
      });
      divMsg.innerHTML += JSON.stringify(msgExec, null, 4);

      const msgClose = await db('close', {});
      divMsg.innerHTML += JSON.stringify(msgClose, null, 4);
    } catch (e) {
      if (e.result?.message)
        divMsg.innerHTML = e.result.message;
      else
        divMsg.innerHTML = e.toString();
    }
  });


  /*
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
    resultsDiv.innerHTML += `<div>${JSON.stringify(msg)}</div>`;*/
})();
