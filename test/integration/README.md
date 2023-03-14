# Integration tests

This directory contains the integration tests which can also be used as example configurations for setting up an environment with `sqlite-wasm-http`.

If you want to setup an environment that is not included you should be aware of the following specific requirements of this package:

* It contains a number of workers that are imported using the new *standard* method that all bundlers have agreed upon: `new Worker(new URL('./script.js', import.meta.url))` - you bundler should support this syntax
* It contains a WASM blob that is also imported using this same syntax: `new URL('./sqlite3.wasm', import.meta.url)` - your bundler should be able to handle this
* It uses Node.js 16 subpath import maps - your bundler and eventually your TypeScript transpiler if you are using one - should be able to handle this. In particular, TypeScript needs `"moduleResolution": "node16"` and the latest 4.2 beta of Vite has a bug which prevents it from using both subpath import maps and workers.

Node.js specific requirements (*these apply to stand-alone Node.js applications, bundling works fine without them*):
* It is a an ESM-only module, which means that it cannot be `require`d from Node.js CJS code. When using in Node.js you should either use `.mjs` extension or you should set `"type": "module"` in your `package.json`. If you are using TypeScript, you should also set `"module": "es6"` or greater in `tsconfig.json` and use `ts-node-esm` instead of `ts-node`.
* It uses `fetch` which requires Node.js 18
* It uses `WebWorker` which require the `web-worker` package
* The sync backend - which works in Node.js but should never be needed, since Node.js always exposes `SharedArrayBuffer` - is particularly inefficient as it uses an old polyfill which creates temporary files on the disk for every transferred segment
