import { sqlite3 } from '../deps/types/sqlite3.js';
import { initSyncSQLite, createHttpBackend, VFSHTTP } from '../dist/index.js';

import { assert } from 'chai';

const remoteURL = 'https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';

const backTests = {
  shared: 'HTTP VFS (multiplexed)',
  sync: 'HTTP VFS (ersatz sync version)'
};

for (const back of Object.keys(backTests) as (keyof typeof backTests)[]) {
  describe('sync SQLite w/ ' + backTests[back], () => {
    let httpBackend: VFSHTTP.Backend;
    let db: sqlite3.oo1.DB;

    before((done) => {
      httpBackend = createHttpBackend({
        maxPageSize: 1024,
        backendType: back === 'sync' ? 'sync' : undefined
      });

      initSyncSQLite({ http: httpBackend })
        .then((sq) => {
          assert.strictEqual(httpBackend.type, back);
          db = new sq.oo1.DB({
            filename: 'file:' + encodeURI(remoteURL),
            vfs: 'http'
          });
          assert.instanceOf(db, sq.oo1.DB);
          assert.isTrue(db.isOpen());
          assert.strictEqual(db.dbFilename(), remoteURL);
          assert.strictEqual(db.dbName(), 'main');
          assert.strictEqual(db.dbVfsName(), 'http');
          done();
        })
        .catch(done);
    });

    after((done) => {
      db.close();
      httpBackend.close().then(() => done()).catch(done);
    });

    it('should retrieve remote data', () => {
      const columnNames: string[] = [];
      const rows = db.exec('SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles WHERE zoom_level = 1',
        { rowMode: 'array', columnNames });
      assert.lengthOf(rows, 4);
      assert.sameMembers(columnNames, ['zoom_level', 'tile_column', 'tile_row', 'tile_data']);
      rows.forEach((row) => {
        assert.strictEqual(row[0], 1);
        assert.isNumber(row[1]);
        assert.isNumber(row[2]);
        assert.instanceOf(row[3], Uint8Array);
      });
    });

    it('should support object row mode', () => {
      const columnNames: string[] = [];
      const rows = db.exec('SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles WHERE zoom_level = 1',
        { rowMode: 'object', columnNames });
      assert.lengthOf(rows, 4);
      assert.sameMembers(columnNames, ['zoom_level', 'tile_column', 'tile_row', 'tile_data']);
      rows.forEach((row) => {
        assert.strictEqual(row.zoom_level, 1);
        assert.isNumber(row.tile_column);
        assert.isNumber(row.tile_row);
        assert.instanceOf(row.tile_data, Uint8Array);
      });
    });
  });
}
