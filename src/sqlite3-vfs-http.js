const timeoutBackend = 10000;

if (typeof WorkerGlobalScope === 'undefined' || !(self instanceof WorkerGlobalScope))
  throw new Error('This script must run in a WebWorker');

const openFiles = {};

export function installhttpVfs(sqlite3, options) {
  if (typeof SharedArrayBuffer === 'undefined') {
    throw new Error('SharedArrayBuffer is not available. ' +
      'If your browser supports it, the webserver must send ' +
      '"Cross-Origin-Opener-Policy: same-origin"' +
      'and "Cross-Origin-Embedder-Policy: require-corp" headers.');
  }
  const backend = options.backend;
  if (!backend ||
    !(backend.port instanceof MessagePort) ||
    !(backend.shm instanceof SharedArrayBuffer))
    throw new Error('No backend message channel in options');
  const lock = new Int32Array(backend.shm, backend.shm.byteLength - Int32Array.BYTES_PER_ELEMENT);
  const shm = new Uint8Array(backend.shm, 0, backend.shm.byteLength - Int32Array.BYTES_PER_ELEMENT);

  const capi = sqlite3.capi;
  const wasm = sqlite3.wasm;
  const sqlite3_vfs = capi.sqlite3_vfs;
  const sqlite3_file = capi.sqlite3_file;
  const sqlite3_io_methods = capi.sqlite3_io_methods;

  const httpVfs = new sqlite3_vfs();
  const httpIoMethods = new sqlite3_io_methods();

  // Init copied from sqlite3-vfs-opfs.c-pp.js
  const pDVfs = capi.sqlite3_vfs_find(null);
  const dVfs = pDVfs
    ? new sqlite3_vfs(pDVfs)
    : null;

  httpVfs.$iVersion = 1;
  httpVfs.$szOsFile = capi.sqlite3_file.structInfo.sizeof;
  httpVfs.$mxPathname = 1024;
  httpVfs.$zName = wasm.allocCString('http');

  httpVfs.$xDlOpen = httpVfs.$xDlError = httpVfs.$xDlSym = httpVfs.$xDlClose = null;

  backend.port.onmessage = function ({ data }) {
    console.log('Received new work reply', data);
  };

  const sendAndWait = (msg) => {
    Atomics.store(lock, 0, 0xffff);
    backend.port.postMessage(msg);
    const r = Atomics.wait(lock, 0, 0xffff, timeoutBackend);
    if (r !== 'ok') {
      return -1;
    }
    return Atomics.load(lock, 0);
  };

  const ioSyncWrappers = {
    xCheckReservedLock: function (file, out) {
      console.log('xCheckReservedLock', file, out);
      return 0;
    },
    xClose: function (file) {
      console.log('xClose', file);
      return 0;
    },
    xDeviceCharacteristics: function (file) {
      console.log('xDeviceCharacteristics', file);
      return capi.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN;
    },
    xFileControl: function (file, op, arg) {
      console.log('xFileControl', file, op, arg);
      return 0;
    },
    xFileSize: function (fid, size) {
      console.log('xFileSize', fid, size);
      if (!openFiles[fid]) {
        return capi.SQLITE_NOTFOUND;
      }
      const r = sendAndWait({ msg: 'xFilesize', name: openFiles[fid].filename });
      if (r !== 0) {
        return capi.SQLITE_IOERR;
      }
      const sz = new BigUint64Array(backend.shm, 0, 1)[0];
      console.log('file size is ', sz);
      wasm.poke(size, sz, 'i64');
      return 0;
    },
    xLock: function (file, lock) {
      console.log('xLock', file, lock);
      return 0;
    },
    xRead: function (fid, dest, n, offset) {
      console.log('xRead', fid, dest, n, offset);
      if (Number(offset) > Number.MAX_SAFE_INTEGER) {
        return capi.SQLITE_TOOBIG;
      }
      if (!openFiles[fid]) {
        return capi.SQLITE_NOTFOUND;
      }
      const r = sendAndWait({ msg: 'xRead', name: openFiles[fid].filename, n, offset });
      if (r !== 0) {
        return capi.SQLITE_IOERR;
      }
      console.log(shm.subarray(0, n), dest);
      wasm.heap8u().set(shm.subarray(0, n), dest);
      return capi.SQLITE_OK;
    },
    xSync: function (file, flags) {
      console.log('xSync', file, flags);
      return 0;
    },
    xTruncate: function (file, size) {
      console.log('xTruncate', file, size);
      return 0;
    },
    xUnlock: function (file, lock) {
      console.log('xUnlock', file, lock);
      return 0;
    },
    xWrite: function (file, src, n, offset) {
      console.log('xWrite', file, src, n, offset);
      return 0;
    }
  };

  const vfsSyncWrappers = {
    xAccess: function (vfs, name, flags, out) {
      console.log('xAccess', vfs, name, flags, out);
      name = wasm.cstrToJs(name);
      const r = sendAndWait({ msg: 'xAccess', name });
      if (r !== 0)
        return capi.SQLITE_IOERR;
      const result = new Uint32Array(backend.shm, 0, 1)[0];
      wasm.poke(out, result, 'i32');
      return capi.SQLITE_OK;
    },
    xCurrentTime: function (vfs, out) {
      console.log('xCurrentTime', vfs, out);
      return 0;
    },
    xCurrentTimeInt64: function (vfs, out) {
      console.log('xCurrentTimeInt64', vfs, out);
      return 0;
    },
    xDelete: function (vfs, name, doSyncDir) {
      console.log('xDelete', vfs, name, doSyncDir);
      return 0;
    },
    xFullPathname: function (vfs, name, nOut, pOut) {
      console.log('xFullPathname', vfs, name, nOut, pOut);
      const i = wasm.cstrncpy(pOut, name, nOut);
      return i < nOut ? 0 : capi.SQLITE_CANTOPEN;
    },
    xGetLastError: function (vfs, out, pout) {
      console.log('xGetLastError', vfs, out, pout);
      return 0;
    },
    xOpen: function (vfs, name, fid, flags, outflags) {
      console.log('xOpen', vfs, name, fid, flags, outflags);
      if (flags & capi.SQLITE_OPEN_READONLY === 0) {
        return capi.SQLITE_READONLY;
      }
      if (name === 0) {
        console.error('HTTP VFS does not support anonymous files');
        return capi.SQLITE_CANTOPEN;
      }
      if (typeof name !== 'number') {
        return capi.SQLITE_ERROR;
      }
      name = wasm.cstrToJs(name);
      const fh = Object.create(null);
      fh.fid = fid;
      fh.filename = name;
      fh.sq3File = new sqlite3_file(fid);
      fh.sq3File.$pMethods = httpIoMethods.pointer;
      fh.lockType = capi.SQLITE_LOCK_NONE;
      openFiles[fid] = fh;

      const r = sendAndWait({ msg: 'xOpen', name, fid });
      if (r < 0)
        return capi.SQLITE_IOERR;
      if (r !== 0)
        return capi.SQLITE_CANTOPEN;
      return capi.SQLITE_OK;
    }
  };

  sqlite3.vfs.installVfs({
    io: { struct: httpIoMethods, methods: ioSyncWrappers },
    vfs: { struct: httpVfs, methods: vfsSyncWrappers }
  });
};
