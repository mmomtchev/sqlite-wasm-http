import { createSQLiteThread, createHttpBackend } from '../dist/index.js';

import { assert } from 'chai';

describe('HTTP VFS', () => {
  let httpBackend;
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
    .catch(done);
  });

  it('should register the HTTP VFS', (done) => {
    db('config-get', {})
    .then((cfg) => {
      console.log(cfg);
      done();
    })
      .catch(done);
  });

  it('should retrieve remote data', () => {

  })
})