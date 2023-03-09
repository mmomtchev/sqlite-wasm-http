import { createSQLiteThread, createHttpBackend, VFSHTTP } from '../dist/index.js';

import { assert } from 'chai';

const remoteURL = 'https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';

describe('HTTP VFS', () => {
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
        console.log('close finished');
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
});
