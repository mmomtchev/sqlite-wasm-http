# sqlite-wasm-http

SQLite WASM with HTTP VFS

[![License: ISC](https://img.shields.io/github/license/mmomtchev/sqlite-wasm-http)](https://github.com/mmomtchev/sqlite-wasm-http/blob/main/LICENSE)
[![Node.js CI](https://github.com/mmomtchev/sqlite-wasm-http/actions/workflows/node.js.yml/badge.svg)](https://github.com/mmomtchev/sqlite-wasm-http/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/mmomtchev/sqlite-wasm-http/branch/main/graph/badge.svg?token=SLQOP9XTEV)](https://codecov.io/gh/mmomtchev/sqlite-wasm-http)


This project is inspired from [@phiresky](https://github.com/phiresky/)/[sql.js-httpvfs](https://github.com/phiresky/sql.js-httpvfs) but uses the new official SQLite WASM distribution.

The new features planned for 1.0 compared to the original project are:
* Based upon what will probably be the industry reference (backed by SQLite and Google)
* Supports multiple concurrent connections to the same database with shared cache
* Aims to support all bundlers out-of-the-box without special configuration

Its main drawback at the moment is that it depends on a number of very recent JS features:
* `SharedArrayBuffer` which requires that the server hosting the JS code sends [`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers](https://web.dev/coop-coep/) (aka CORS 2).

  According to [caniuse.com](https://caniuse.com/sharedarraybuffer), as of March 2023, this is supported by 92.51% of the currently used browsers.

  Even if the option to include an alternative backend without concurrent connections support is still on the table, this will have only a very marginal effect on the supported browsers share with [WebAssembly](https://caniuse.com/wasm) itself being at 95.54%.

* *Import maps* which require Webpack 5 or the latest rollup

* Ony ES6 module mode is supported at the moment, CommonJS is not supported and this includes TypeScript transpiled to CommonJS - you have to transpile to ES6 in order to use this module

You can check [test/integration](https://github.com/mmomtchev/sqlite-wasm-http/blob/main/test/integration) for examples for the various environments that are currently tested and supported.

Also you can check [this](http://stefnotch.github.io/web/COOP%20and%20COEP%20Service%20Worker/) for a hack-ish *Baron Munchausen-style* method to enable COOP/COEP via JS if you don't have access to the server.

# Node.js compatibility

Node.js is fully supported but requires `web-worker` and `fetch` available in Node.js 18.x+.

Check [`test/setup.ts`](https://github.com/mmomtchev/sqlite-wasm-http/blob/main/test/setup.ts) which is used to setup the `mocha` environment for everything that is required.

# Status

Experimental

# Usage

```typescript
import { createSQLiteThread, createHttpBackend } from 'sqlite-wasm-http';

// MBTiles is a common format for storing both vector and
// raster maps in an SQLite database
const remoteURL = 
  'https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';
const httpBackend = createHttpBackend({
  maxPageSize: 4096,    // this is the current default SQLite page size
  timeout: 10000,       // 10s
  cacheSize: 4096       // 4 MB
});
// Multiple DB workers can be created, all sharing the same backend cache
const db = await createSQLiteThread({ http: httpBackend });
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

# Will write-access ever be possible?

Short answer: Maybe, in some cases.

Long answer: It won't have the same universal support as read-only access though. There is a `Content-Range` header for HTTP bodies - that is used in the response of an HTTP `GET` request that carries a `Range` header. The RFC does not say anything about this header being used for `PUT` requests. Most web server do not support it. Apache does support it if the WebDAV extensions are enabled. Maybe other servers support in specific configurations too. Support on public infrastructure servers, especially the low-cost ones, will likely be very rare.
