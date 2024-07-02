it('test', async () => {
  const { createSQLiteThread, createHttpBackend } = await import('sqlite-wasm-http');
  const httpBackend = createHttpBackend({
    maxPageSize: 1024,
    timeout: 10000
  });
  const db = await createSQLiteThread({ http: httpBackend });

  await db('config-get', {});

  await db('open', {
    filename: 'file:' + encodeURI('https://orel.garga.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles'),
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
