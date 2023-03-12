import { createSQLiteHTTPPool } from '../dist/index.js';

import { assert } from 'chai';

const remoteURL = 'https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';

describe('SQLite HTTP pool', () => {
  const workers = 8;
  const requests = 32;

  it('should handle automatically concurrent connections', (done) => {
    const poolq = createSQLiteHTTPPool({ workers });

    poolq.then((pool) => pool.open(remoteURL).then(() => {
      console.log('opened', remoteURL);
      const r: Promise<SQLite.Row>[] = [];
      for (let i = 0; i < requests; i++)
        r.push(pool.exec('SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles ' +
          'WHERE zoom_level = 10 AND tile_column = $col AND tile_row = $row',
          { $col: 600 + i, $row: 600 + i })
          .then((results) => {
            assert.lengthOf(results, 1);
            assert.sameMembers(results[0].columnNames, ['zoom_level', 'tile_column', 'tile_row', 'tile_data']);
            assert.strictEqual(results[0].row[0], 10);
            assert.strictEqual(results[0].row[1], 600 + i);
            assert.strictEqual(results[0].row[2], 600 + i);
            assert.instanceOf(results[0].row[3], Uint8Array);
            return results[0];
          }));

      return Promise.all(r).then((resp) => {
        const tiles = resp.flat();
        assert.lengthOf(tiles, requests);
        done();
      });
    }))
      .finally(() => {
        console.log('finally');
        poolq.then((pool) => pool.close());
      })
      .catch(done);
  });
});
