import { createSQLiteThread, createHttpBackend, VFSHTTP } from '../dist/index.js';

import { assert } from 'chai';

const remoteURL = 'https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';

describe('HTTP VFS (multiplexed)', () => {
  let httpBackend: VFSHTTP.Backend;
  let db: SQLite.Promiser;
  before((done) => {
    httpBackend = createHttpBackend({
      maxPageSize: 1024,
      timeout: 10000
    });
    createSQLiteThread({ http: httpBackend })
      .then((r) => {
        db = r;
        done();
      })
      .then(() => db('open', {
        filename: 'file:' + encodeURI(remoteURL),
        vfs: 'http'
      }))
      .then((msg) => {
        assert.equal(msg.type, 'open');
        assert.isString(msg.messageId);
        assert.isString(msg.dbId);
        assert.strictEqual(msg.result.filename, 'file:' + remoteURL);
        assert.strictEqual(msg.result.vfs, 'http');
      })
      .catch(done);
  });

  after((done) => {
    db('close', {})
      .then((msg: SQLite.ResponseClose) => {
        assert.equal(msg.type, 'close');
      }).then(() => {
        db.close();
        return httpBackend.close();
      })
      .then(() => {
        done();
      })
      .catch(done);
  });

  it('should register the HTTP VFS', (done) => {
    db('config-get', {})
      .then((cfg) => {
        assert.include(cfg.result.vfsList, 'http');
        done();
      })
      .catch(done);
  });

  it('should retrieve remote data', (done) => {
    const rows: SQLite.Result[] = [];
    db('exec', {
      sql: 'SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles WHERE zoom_level = 1',
      callback: (msg) => {
        rows.push(msg);
      }
    })
      .then((msg) => {
        assert.strictEqual(msg.type, 'exec');
        assert.sameMembers(msg.result.columnNames, ['zoom_level', 'tile_column', 'tile_row', 'tile_data']);
        assert.lengthOf(rows, 5);
        rows.forEach((row, idx) => {
          assert.sameMembers(row.columnNames, ['zoom_level', 'tile_column', 'tile_row', 'tile_data']);
          if (row.row) {
            assert.isAtMost(idx, 3);
            assert.isNumber(row.rowNumber);
            assert.strictEqual(row.row[0], 1);
            assert.isNumber(row.row[1]);
            assert.isNumber(row.row[2]);
            assert.instanceOf(row.row[3], Uint8Array);
          } else {
            assert.isNull(row.rowNumber);
            assert.strictEqual(idx, 4);
          }
        });
        done();
      })
      .catch(done);
  });

  it('should support aggregation (VFS stress test)', (done) => {
    const rows: SQLite.Result[] = [];
    db('exec', {
      sql: 'SELECT COUNT(*) AS total FROM tiles WHERE zoom_level < 10',
      callback: (msg) => {
        rows.push(msg);
      }
    })
      .then((msg) => {
        assert.strictEqual(msg.type, 'exec');
        assert.sameMembers(msg.result.columnNames, ['total']);
        assert.lengthOf(rows, 2);
        rows.forEach((row, idx) => {
          assert.sameMembers(row.columnNames, ['total']);
          if (row.row) {
            assert.isAtMost(idx, 0);
            assert.isNumber(row.rowNumber);
            assert.strictEqual(row.row[0], 20953);
          } else {
            assert.isNull(row.rowNumber);
            assert.strictEqual(idx, 1);
          }
        });
        done();
      })
      .catch(done);
  });

  it('should support custom HTTP headers', (done) => {
    const secretURL = 'https://sqlite-secret-zone.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';
    const authorization = 'Basic: OpenSesame';

    const backend = createHttpBackend({
      headers: {
        'Authorization': authorization
      }
    });
    const dbAuthq = createSQLiteThread({ http: backend });
    const rows: SQLite.Result[] = [];
    dbAuthq
      .then((dbAuth) => dbAuth('open', {
        filename: 'file:' + encodeURI(secretURL),
        vfs: 'http'
      })
        .then(() => dbAuth))
      .then((dbAuth) => dbAuth('exec', {
        sql: 'SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles WHERE zoom_level = 1',
        callback: (msg) => {
          rows.push(msg);
        }
      }))
      .then((msg) => {
        assert.strictEqual(msg.type, 'exec');
        assert.sameMembers(msg.result.columnNames, ['zoom_level', 'tile_column', 'tile_row', 'tile_data']);
        assert.lengthOf(rows, 5);
        rows.forEach((row, idx) => {
          assert.sameMembers(row.columnNames, ['zoom_level', 'tile_column', 'tile_row', 'tile_data']);
          if (row.row) {
            assert.isAtMost(idx, 3);
            assert.isNumber(row.rowNumber);
            assert.strictEqual(row.row[0], 1);
            assert.isNumber(row.row[1]);
            assert.isNumber(row.row[2]);
            assert.instanceOf(row.row[3], Uint8Array);
          } else {
            assert.isNull(row.rowNumber);
            assert.strictEqual(idx, 4);
          }
        });
        done();
      })
      .catch(done)
      .finally(() => {
        dbAuthq.then((dbAuth) => dbAuth.close()).then(() => backend.close());
      });
  });

  it('should support multiple parallel connections', (done) => {
    const concurrentDb: Promise<SQLite.Promiser>[] = [];
    let tiles = 0;

    for (let i = 0; i < 8; i++) {
      concurrentDb.push(createSQLiteThread({ http: httpBackend }));
    }

    const q: Promise<SQLite.Response>[] = [];
    for (let i = 0; i < concurrentDb.length; i++) {
      q.push(concurrentDb[i]
        .then((db) => db('open', {
          filename: 'file:' + encodeURI(remoteURL),
          vfs: 'http'
        }).then(() => db))
        .then((db) => db('exec', {
          sql: 'SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles ' +
            'WHERE zoom_level = 10 AND tile_column = $col AND tile_row = $row',
          bind: { $col: 600 + i, $row: 600 + i },
          callback: (msg) => {
            if (msg.row) {
              tiles++;
              assert.sameMembers(msg.columnNames, ['zoom_level', 'tile_column', 'tile_row', 'tile_data']);
              assert.strictEqual(msg.row[0], 10);
              assert.strictEqual(msg.row[1], 600 + i);
              assert.strictEqual(msg.row[2], 600 + i);
              assert.instanceOf(msg.row[3], Uint8Array);
            }
          }
        })));
    }

    Promise.all(q)
      .then(() => {
        assert.strictEqual(tiles, concurrentDb.length);
      })
      .finally(() => {
        Promise.all(concurrentDb.map((dbq) => dbq.then((db) => db.close())));
        done();
      })
      .catch(done);
  });
});