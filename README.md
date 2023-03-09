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
* `SharedArrayBuffer` which requires that the server hosting the JS code sends [`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers](https://web.dev/coop-coep/).

  According to [caniuse.com](https://caniuse.com/sharedarraybuffer), as of March 2023, this is supported by 92.51% of the currently used browsers.

  Even if the option to include an alternative backend without concurrent connections support is still on the table, this will have only a very marginal effect on the supported browsers share with [WebAssembly](https://caniuse.com/wasm) itself being at 95.54%.

* *Import maps* which require Webpack 5 or the latest rollup

# Node.js compatibility

Node.js is fully supported but requires `web-worker` and `fetch` available in Node.js 18.x+

# Status

Experimental
