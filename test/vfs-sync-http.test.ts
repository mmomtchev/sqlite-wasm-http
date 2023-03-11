import { createSQLiteThread, createHttpBackend } from '../dist/index.js';

import { assert } from 'chai';

const remoteURL = 'https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';

describe('HTTP VFS (ersatz sync version)', () => {
  let db: SQLite.Promiser;
  before((done) => {
    createSQLiteThread({ http: true })
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
        db.close();
        assert.equal(msg.type, 'close');
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
      sql: 'SELECT COUNT(*) AS total FROM tiles WHERE zoom_level < 5',
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
            assert.strictEqual(row.row[0], 341);
          } else {
            assert.isNull(row.rowNumber);
            assert.strictEqual(idx, 1);
          }
        });
        done();
      })
      .catch(done);
  });

  it.skip('should support custom HTTP headers', (done) => {
    const secretURL = 'https://sqlite-secret-zone.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';
    const authorization = 'Basic: OpenSesame';

    const backend = createHttpBackend({
      fetchOptions: {
        headers: {
          'Authorization': authorization
        }
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
});