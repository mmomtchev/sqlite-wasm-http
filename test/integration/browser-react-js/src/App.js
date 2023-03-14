import { createSQLiteThread, createHttpBackend } from 'sqlite-wasm-http';

async function test() {
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

  if (rows !== 5)
    throw new Error('test failed');
}

function App() {
  test()
  .then(() => {
    if (typeof window.testDone === 'function')
      window.testDone()
    else
      console.error('Not running in the test environment');
  })
  .catch(window.testDone);

  return (
    <div className="App">
      <header className="App-header">
        React Integration
      </header>
    </div>
  );
}

export default App;
