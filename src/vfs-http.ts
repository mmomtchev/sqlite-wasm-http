// This is the VFS layer for the shared backend
// It run in each SQLite worker thread that uses it

import * as VFSHTTP from './vfs-http-types.js';
import { debug } from './vfs-http-types.js';
import { SQLite3, Internal } from '#sqlite3.js';

interface FileDescriptor {
  fid: Internal.FH;
  url: string;
  sq3File: Internal.CStruct;
}
const openFiles: Record<Internal.FH, FileDescriptor> = {};

export function installHttpVfs(
  sqlite3: SQLite3,
  backend: VFSHTTP.BackendChannel,
  options?: VFSHTTP.Options) {
  if (typeof SharedArrayBuffer === 'undefined') {
    throw new Error('SharedArrayBuffer is not available. ' +
      'If your browser supports it, the webserver must send ' +
      '"Cross-Origin-Opener-Policy: same-origin "' +
      'and "Cross-Origin-Embedder-Policy: require-corp" headers.');
  }
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

  httpVfs.$iVersion = 1;
  httpVfs.$szOsFile = capi.sqlite3_file.structInfo.sizeof;
  httpVfs.$mxPathname = 1024;
  httpVfs.$zName = wasm.allocCString('http');

  httpVfs.$xDlOpen = httpVfs.$xDlError = httpVfs.$xDlSym = httpVfs.$xDlClose = null;

  const sendAndWait = (msg: VFSHTTP.Message) => {
    Atomics.store(lock, 0, 0xffffff);
    backend.port.postMessage(msg);
    const r = Atomics.wait(lock, 0, 0xffffff, options?.timeout ?? VFSHTTP.defaultOptions.timeout);
    if (r === 'timed-out') {
      console.error('Backend timeout', r, lock, msg);
      return -1;
    } else if (r === 'not-equal') {
      console.warn('Operation finished too fast', r, lock, msg, Atomics.load(lock, 0));
    }
    return Atomics.load(lock, 0);
  };

  const ioSyncWrappers = {
    xCheckReservedLock: function (fid: Internal.FH, out: Internal.CPointer): number {
      debug['vfs']('xCheckReservedLock', fid, out);
      wasm.poke(out, 0, 'i32');
      return 0;
    },
    xClose: function (fid: Internal.FH): number {
      debug['vfs']('xClose', fid);
      if (!openFiles[fid]) {
        return capi.SQLITE_NOTFOUND;
      }
      delete openFiles[fid];
      return 0;
    },
    xDeviceCharacteristics: function (fid: Internal.FH): number {
      debug['vfs']('xDeviceCharacteristics', fid);
      return capi.SQLITE_IOCAP_IMMUTABLE;
    },
    xFileControl: function (fid: Internal.FH, op: number, arg: number): number {
      debug['vfs']('xFileControl', fid, op, arg);
      if (op === capi.SQLITE_FCNTL_SYNC)
        return capi.SQLITE_OK;
      return capi.SQLITE_NOTFOUND;
    },
    xFileSize: function (fid: Internal.FH, size: Internal.CPointer) {
      debug['vfs']('xFileSize', fid, size);
      if (!openFiles[fid]) {
        return capi.SQLITE_NOTFOUND;
      }
      const r = sendAndWait({ msg: 'xFilesize', url: openFiles[fid].url });
      if (r !== 0) {
        return capi.SQLITE_IOERR;
      }
      const sz = new BigUint64Array(backend.shm, 0, 1)[0];
      debug['vfs']('file size is ', sz);
      wasm.poke(size, sz, 'i64');
      return 0;
    },
    xLock: function (fid: Internal.FH, lock: number) {
      debug['vfs']('xLock', fid, lock);
      return 0;
    },
    xRead: function (fid: Internal.FH, dest: Uint8Array, n: number, offset: bigint) {
      debug['vfs']('xRead', fid, dest, n, offset);
      if (Number(offset) > Number.MAX_SAFE_INTEGER) {
        // CampToCamp are not supported
        return capi.SQLITE_TOOBIG;
      }
      if (!openFiles[fid]) {
        return capi.SQLITE_NOTFOUND;
      }
      const r = sendAndWait({ msg: 'xRead', url: openFiles[fid].url, n, offset });
      if (r !== 0) {
        console.error('xRead', r);
        return capi.SQLITE_IOERR;
      }
      wasm.heap8u().set(shm.subarray(0, n), dest);
      return capi.SQLITE_OK;
    },
    xSync: function (fid: Internal.FH, flags: number) {
      debug['vfs']('xSync', fid, flags);
      return 0;
    },
    xTruncate: function (fid: Internal.FH, size: number) {
      debug['vfs']('xTruncate', fid, size);
      return 0;
    },
    xUnlock: function (fid: Internal.FH, lock: number) {
      debug['vfs']('xUnlock', fid, lock);
      return 0;
    },
    xWrite: function (fid: Internal.FH, src: Uint8Array, n: number, offset: bigint) {
      debug['vfs']('xWrite', fid, src, n, offset);
      return capi.SQLITE_READONLY;
    }
  };

  const vfsSyncWrappers = {
    xAccess: function (vfs: Internal.CPointer,
      name: Internal.CPointer,
      flags: number,
      out: Internal.CPointer) {
      debug['vfs']('xAccess', vfs, name, flags, out);
      if ((flags & capi.SQLITE_OPEN_READONLY) === 0) {
        wasm.poke(out, 0, 'i32');
        return capi.SQLITE_OK;
      }
      const url = wasm.cstrToJs(name);
      const r = sendAndWait({ msg: 'xAccess', url });
      if (r !== 0) {
        console.error('xAccess', r);
        return capi.SQLITE_IOERR;
      }
      const result = new Uint32Array(backend.shm, 0, 1)[0];
      wasm.poke(out, result, 'i32');
      return capi.SQLITE_OK;
    },
    xCurrentTime: function (vfs: Internal.CPointer, out: Internal.CPointer) {
      debug['vfs']('xCurrentTime', vfs, out);
      wasm.poke(out, 2440587.5 + (new Date().getTime() / 86400000), 'double');
      return 0;
    },
    xCurrentTimeInt64: function (vfs: Internal.CPointer, out: Internal.CPointer) {
      debug['vfs']('xCurrentTimeInt64', vfs, out);
      wasm.poke(out, (BigInt(2440587.5) * BigInt(86400000)) + BigInt(new Date().getTime()), 'i64');
      return 0;
    },
    xDelete: function (vfs: Internal.CPointer, name: Internal.CPointer, doSyncDir: boolean) {
      debug['vfs']('xDelete', vfs, name, doSyncDir);
      return capi.SQLITE_READONLY;
    },
    xFullPathname: function (vfs: Internal.CPointer,
      name: Internal.CPointer,
      nOut: number,
      pOut: Internal.CPointer) {
      debug['vfs']('xFullPathname', vfs, name, nOut, pOut);
      const i = wasm.cstrncpy(pOut, name, nOut);
      return i < nOut ? 0 : capi.SQLITE_CANTOPEN;
    },
    xGetLastError: function (vfs: Internal.CPointer,
      nOut: number,
      pout: Internal.CPointer) {
      debug['vfs']('xGetLastError', vfs, nOut, pout);
      return 0;
    },
    xOpen: function (vfs: Internal.CPointer,
      name: Internal.CPointer,
      fid: Internal.FH,
      flags: number,
      pOutFlags: number) {
      debug['vfs']('xOpen', vfs, name, fid, flags, pOutFlags);
      if (name === 0) {
        console.error('HTTP VFS does not support anonymous files');
        return capi.SQLITE_CANTOPEN;
      }
      if (typeof name !== 'number') {
        return capi.SQLITE_ERROR;
      }
      wasm.poke(pOutFlags, capi.SQLITE_OPEN_READONLY, 'i32');
      const url = wasm.cstrToJs(name);
      const fh = Object.create(null) as FileDescriptor;
      fh.fid = fid;
      fh.url = url;
      fh.sq3File = new sqlite3_file(fid);
      fh.sq3File.$pMethods = httpIoMethods.pointer;
      openFiles[fid] = fh;

      const r = sendAndWait({ msg: 'xOpen', url });
      if (r < 0) {
        console.error('xOpen', r);
        return capi.SQLITE_IOERR;
      }
      if (r !== 0) {
        console.error('xOpen', r);
        return capi.SQLITE_CANTOPEN;
      }
      return capi.SQLITE_OK;
    }
  };

  sqlite3.vfs.installVfs({
    io: { struct: httpIoMethods, methods: ioSyncWrappers },
    vfs: { struct: httpVfs, methods: vfsSyncWrappers }
  });

  sqlite3.oo1.DB.dbCtorHelper.setVfsPostOpenSql(
    httpVfs.pointer,
    function (oo1Db, sqlite3) {
      sqlite3.capi.sqlite3_busy_timeout(oo1Db, options?.timeout ?? VFSHTTP.defaultOptions.timeout);
      sqlite3.capi.sqlite3_exec(oo1Db, [
        'PRAGMA journal_mode=DELETE;',
        'PRAGMA cache_size=0;'
      ], 0, 0, 0);
    }
  );
}
