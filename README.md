# sqlite-wasm-http

SQLite WASM with HTTP VFS

[![License: ISC](https://img.shields.io/github/license/mmomtchev/sqlite-wasm-http)](https://github.com/mmomtchev/sqlite-wasm-http/blob/main/LICENSE)
[![Node.js CI](https://github.com/mmomtchev/sqlite-wasm-http/actions/workflows/node.js.yml/badge.svg)](https://github.com/mmomtchev/sqlite-wasm-http/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/mmomtchev/sqlite-wasm-http/branch/main/graph/badge.svg?token=SLQOP9XTEV)](https://codecov.io/gh/mmomtchev/sqlite-wasm-http)


This project is inspired from [@phiresky](https://github.com/phiresky/)/[sql.js-httpvfs](https://github.com/phiresky/sql.js-httpvfs) but uses the new official SQLite WASM distribution.

It includes a number of improvements over the first version:
* Based upon what will probably be the industry reference (backed by SQLite and Google)
* Supports multiple concurrent connections to the same database with shared cache

  The shared cache version uses `SharedArrayBuffer` which requires that the server hosting the JS code sends [`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers](https://web.dev/coop-coep/) (aka CORS 2).

* Simplified fall-back version without support for sharing cache between worker threads that does not require `SharedArrayBuffer`
* Aims to support all bundlers out-of-the-box without special configuration

You can see a [live demo of the shared cache version here](https://sqlite-wasm-http.momtchev.com/).

The [Github Pages live demo](https://mmomtchev.github.io/sqlite-wasm-http/) uses the sync backend since as of March 2023 Github Pages still does not support cross-origin isolation.

Ony ES6 module mode is supported at the moment, CommonJS is not supported and this includes TypeScript transpiled to CommonJS - you have to transpile to ES6 in order to use this module

You can check [test/integration](https://github.com/mmomtchev/sqlite-wasm-http/blob/main/test/integration) for examples for the various environments that are currently tested and supported.

Node.js is fully supported but requires `web-worker` and `fetch` available in Node.js 18.x+.

If you intend to use Node.js only for bundling without using SQLite in a standalone application, then the minimum required version is Node.js 16.x.

# Status

Experimental

# Usage

If you are not already familiar with [@phiresky](https://github.com/phiresky/)/[sql.js-httpvfs](https://github.com/phiresky/sql.js-httpvfs), there is a brief presentation in the [Overview](#Overview) section.

## Page size

It is highly recommended to decrease your SQLite page size to 1024 bytes for maximum performance:
```
PRAGMA JOURNAL_MODE = DELETE;
PRAGMA page_size = 1024;
-- Do it for every FTS table you have
-- (geospatial datasets do not use full text search)
INSERT INTO ftstable(ftstable) VALUES ('optimize');
-- Reorganize database and apply changed page size
-- Sometimes you will be surprised by the new size of your DB
VACUUM;
```

## Using the SQLite API

This method allows using the raw SQLite interface with the added support of an HTTP VFS.

```typescript
import { createSQLiteThread, createHttpBackend } from 'sqlite-wasm-http';

// MBTiles is a common format for storing both vector and
// raster maps in an SQLite database
const remoteURL = 
  'https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';
// createHttpBackend will autodetect if you can use SharedArrayBuffer or not
const httpBackend = createHttpBackend({
  maxPageSize: 4096,    // this is the current default SQLite page size
  timeout: 10000,       // 10s
  cacheSize: 4096       // 4 MB
});
// Multiple DB workers can be created, all sharing the same backend cache
// db is a raw SQLite Promiser object as described here:
// https://sqlite.org/wasm/doc/trunk/api-worker1.md
const db = await createSQLiteThread({ http: httpBackend });
// This API is compatible with all SQLite VFS
await db('open', { filename: 'file:' + encodeURI(remoteURL), vfs: 'http' });
await db('exec', {
  sql: 'SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles ' +
    'WHERE zoom_level = 10 AND tile_column = $col AND tile_row = $row',
  bind: { $col: 600, $row: 600 },
  callback: (msg) => {
    if (msg.row) {
      console.log(msg.columnNames);
      console.log(msg.row);
    } else {
      console.log('end');
    }
  }
});
// This closes the DB connection
await db('close', {});
// This terminates the SQLite worker
db.close();
await httpBackend.close();
```

## Using the automated pool

A higher-level API allows to automatically use concurrent HTTP connections to the same SQLite database.

Unlike the previous API which is compatible with all SQLite VFS, this one works only for HTTP remote access.

```typescript
const remoteURL = 
  'https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';
const pool = await createSQLiteHTTPPool({ workers: 8 });
await pool.open(remoteURL);
// This will automatically use a free thread from the pool
const tile = await pool.exec('SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles ' +
    'WHERE zoom_level = 10 AND tile_column = $col AND tile_row = $row',
    { $col: 600, $row: 600 });
console.log(tile[0].columnNames);
console.log(tile[0].row);
// This shutdowns the pool
await pool.close();
```

## Further information

* [The full `sqlite-wasm-http` API](https://github.com/mmomtchev/sqlite-wasm-http/blob/integration-tests/docs/API.md)
* [The SQLite WASM main documentation](https://sqlite.org/wasm/doc/trunk/index.md)

# Overview

This package includes a browser-compatible version of SQLite3 compiled to WASM. SQLite3 already supports user-defined VFS - both in its original C API and in its very recent new JS API. The JS API includes an OPFS VFS driver which is the reason this project is being pushed by Google and has very good chances of becoming an industry reference. This package adds an additional HTTP VFS driver that uses HTTP `Range` requests - the same that are used by clients supporting resuming of failed downloads - to implement a filesystem-like random access for SQLite3.

The main drawback of SQLite3 - as it is the case of almost all C/C++ software built to WASM for the web - is that it is fully synchronous. Accordingly, the SQLite3 WASM comes with two APIs - one, fully synchronous, which works a lot like the C/C++ version, and another one - which runs SQLite3 in a Web Worker and communicates with it by message passing implemented in a `Promise`-based wrapper.

Currently, the builtin multithreading of the C/C++ version of SQLite3 is not enabled in the WASM version. This means that the only way to have multiple concurrent connections to one (or more) databases is to run several independent SQLite3 workers.

OPFS and HTTP further complicate that situation - as both are intrinsically asynchronous APIs. This is why the HTTP driver comes in two flavors:
  * a more modern one, that uses a dedicated HTTP worker thread to run asynchronously all HTTP operations for all SQLite3 workers and implements sharing of the cache between those
  * and a more compatible one, that runs synchronously all HTTP operations in the SQLite3 thread that invoked them and does not support cache sharing between workers

If you do not intend to run concurrent queries using multiple workers, both backends will be equivalent to you.

The driver is smart enough to select the appropriate backend according to whether `SharedArrayBuffer` is available or not.

# Will write access ever be possible?

Short answer: Maybe, in some cases.

Long answer: It won't have the same universal support as read-only access though. There is a `Content-Range` header for HTTP bodies - that is used in the response of an HTTP `GET` request that carries a `Range` header. The RFC does not say anything about this header being used for `PUT` requests. Most web server do not support it. Apache does support it if the WebDAV extensions are enabled. Maybe other servers support in specific configurations too. Support on public infrastructure servers, especially the low-cost ones, will likely be very rare.

# Developer mode

```
npm run start
```

If you open `http://localhost:9000` you will have a `SharedArrayBuffer` environment, and if you open `http://<your-ip>:9000`, you will have a legacy environment. This is because a non-`https` environment can be cross-origin isolated only if running on `localhost`.

## Debug output

Browser mode:
```
SQLITE_DEBUG=vfs,threads,cache npm run start
```

Node.js
```
SQLITE_DEBUG=vfs,threads,cache mocha
```

# Apache httpd configuration fragment

These are all the options required for maximum performance:

```
<Location "/">
  Header always append Cross-Origin-Embedder-Policy "require-corp"
  Header always append Cross-Origin-Opener-Policy: "same-origin"
  AddOutputFilterByType DEFLATE application/wasm
</Location>
```

They must be set on the origin - the main entry point as it is displayed in the user's URL bar. When using an `iframe`, the `iframe` must have them **as well as all of its parents up to the origin**, as well as the special `iframe` attribute: `<iframe allow="cross-origin-isolated">`.

# Overview

[![Overview](https://github.com/mmomtchev/sqlite-wasm-http/blob/main/docs/overview.png)](https://github.com/mmomtchev/sqlite-wasm-http/blob/main/docs/overview.png)

# Copyright

ISC License

Copyright (c) 2023, Momtchil Momtchev <momtchil@momtchev.com>

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
