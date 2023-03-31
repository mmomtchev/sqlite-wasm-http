## 1.1.1

- Rebuild the SQLite WASM distribution from the SQLite trunk 2023-03-30
- Eliminate `sqlite3-worker1-promiser-node.mjs`

# 1.1.0 2023-03-29

- Support the fully synchronous SQLite OO1 API with both HTTP VFS backends
- Transform the `sqlite3.js` import into a true TypeScript import that can be imported from user code without `sqlite-wasm-http`
- Support SQLite `rowMode: 'object'`
- Support passing bindable parameters in an array
- Improve the TypeScript types to allow auto inferring of the overloaded argument of `Promiser`
- Add `SQLite.SQLValue` and `SQLite.SQLBindable` types for the data coming from or going to the DB
- Expose `sqlite3Worker1Promiser` to user code
- Fix [#13](https://github.com/mmomtchev/sqlite-wasm-http/issues/13), `PRAGMA TABLE_INFO()` returns an empty result set

# 1.0.0 2023-03-14

- First release
