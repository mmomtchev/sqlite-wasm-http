// This is the ersatz HTTP backend
// It does not require SharedArrayBuffer and does not share its cache
// It runs in the SQLite worker thread

import LRUCache from 'lru-cache';
import * as VFSHTTP from './vfs-http-types.js';
import { debug } from './vfs-http-types.js';

interface FileDescriptor {
  fid: SQLite.Internal.FH;
  url: string;
  sq3File: SQLite.Internal.CStruct;
  size: bigint;
  pageSize: number;
  pageCache: LRUCache<number, Uint8Array>;
}

const openFiles: Record<SQLite.Internal.FH, FileDescriptor> = {};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function installSyncHttpVfs(sqlite3: SQLite.SQLite, options: VFSHTTP.Options) {
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

  const ioSyncWrappers = {
    xCheckReservedLock: function (fid: SQLite.Internal.FH, out: SQLite.Internal.CPointer): number {
      debug['vfs']('xCheckReservedLock', fid, out);
      wasm.poke(out, 0, 'i32');
      return 0;
    },
    xClose: function (fid: SQLite.Internal.FH): number {
      debug['vfs']('xClose', fid);
      if (!openFiles[fid]) {
        return capi.SQLITE_NOTFOUND;
      }
      delete openFiles[fid];
      return 0;
    },
    xDeviceCharacteristics: function (fid: SQLite.Internal.FH): number {
      debug['vfs']('xDeviceCharacteristics', fid);
      return capi.SQLITE_IOCAP_IMMUTABLE;
    },
    xFileControl: function (fid: SQLite.Internal.FH, op: number, arg: number): number {
      debug['vfs']('xFileControl', fid, op, arg);
      return 0;
    },
    xFileSize: function (fid: SQLite.Internal.FH, size: SQLite.Internal.CPointer) {
      debug['vfs']('xFileSize', fid, size);
      if (!openFiles[fid]) {
        return capi.SQLITE_NOTFOUND;
      }
      debug['vfs']('file size is ', openFiles[fid].size);
      wasm.poke(size, openFiles[fid].size, 'i64');
      return 0;
    },
    xLock: function (fid: SQLite.Internal.FH, lock: number) {
      debug['vfs']('xLock', fid, lock);
      return 0;
    },
    xRead: function (fid: SQLite.Internal.FH, dest: Uint8Array, n: number, offset: bigint) {
      debug['vfs']('xRead', fid, dest, n, offset);
      if (Number(offset) > Number.MAX_SAFE_INTEGER) {
        // CampToCamp are not supported
        return capi.SQLITE_TOOBIG;
      }
      if (!openFiles[fid]) {
        return capi.SQLITE_NOTFOUND;
      }
      const entry = openFiles[fid];

      try {
        let data: Uint8Array;
        const xhr = new XMLHttpRequest();
        xhr.open('GET', entry.url, false);
        xhr.setRequestHeader('Range', `bytes=${Number(offset)}-${Number(offset) + n - 1}`);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
          if (xhr.response instanceof ArrayBuffer)
            data = new Uint8Array(xhr.response);
        };
        xhr.send();
        if (!data) {
          return capi.SQLITE_IOERR;
        }

        wasm.heap8u().set(data.subarray(0, n), dest);
        return capi.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return capi.SQLITE_ERROR;
      }
    },
    xSync: function (fid: SQLite.Internal.FH, flags: number) {
      debug['vfs']('xSync', fid, flags);
      return 0;
    },
    xTruncate: function (fid: SQLite.Internal.FH, size: number) {
      debug['vfs']('xTruncate', fid, size);
      return 0;
    },
    xUnlock: function (fid: SQLite.Internal.FH, lock: number) {
      debug['vfs']('xUnlock', fid, lock);
      return 0;
    },
    xWrite: function (fid: SQLite.Internal.FH, src: Uint8Array, n: number, offset: bigint) {
      debug['vfs']('xWrite', fid, src, n, offset);
      return capi.SQLITE_READONLY;
    }
  };

  const vfsSyncWrappers = {
    xAccess: function (vfs: SQLite.Internal.CPointer,
      name: SQLite.Internal.CPointer,
      flags: number,
      out: SQLite.Internal.CPointer) {
      debug['vfs']('xAccess', vfs, name, flags, out);
      /*
      const url = wasm.cstrToJs(name);
      const r = sendAndWait({ msg: 'xAccess', url });
      if (r !== 0) {
        console.error('xAccess', r);
        return capi.SQLITE_IOERR;
      }
      const result = new Uint32Array(backend.shm, 0, 1)[0];
      wasm.poke(out, result, 'i32');*/
      return capi.SQLITE_OK;
    },
    xCurrentTime: function (vfs: SQLite.Internal.CPointer, out: SQLite.Internal.CPointer) {
      debug['vfs']('xCurrentTime', vfs, out);
      wasm.poke(out, 2440587.5 + (new Date().getTime() / 86400000), 'double');
      return 0;
    },
    xCurrentTimeInt64: function (vfs: SQLite.Internal.CPointer, out: SQLite.Internal.CPointer) {
      debug['vfs']('xCurrentTimeInt64', vfs, out);
      wasm.poke(out, (BigInt(2440587.5) * BigInt(86400000)) + BigInt(new Date().getTime()), 'i64');
      return 0;
    },
    xDelete: function (vfs: SQLite.Internal.CPointer, name: SQLite.Internal.CPointer, doSyncDir) {
      debug['vfs']('xDelete', vfs, name, doSyncDir);
      return capi.SQLITE_READONLY;
    },
    xFullPathname: function (vfs: SQLite.Internal.CPointer,
      name: SQLite.Internal.CPointer,
      nOut: number,
      pOut: SQLite.Internal.CPointer) {
      debug['vfs']('xFullPathname', vfs, name, nOut, pOut);
      const i = wasm.cstrncpy(pOut, name, nOut);
      return i < nOut ? 0 : capi.SQLITE_CANTOPEN;
    },
    xGetLastError: function (vfs: SQLite.Internal.CPointer,
      nOut: number,
      pout: SQLite.Internal.CPointer) {
      debug['vfs']('xGetLastError', vfs, nOut, pout);
      return 0;
    },
    xOpen: function (vfs: SQLite.Internal.CPointer,
      name: SQLite.Internal.CPointer,
      fid: SQLite.Internal.FH,
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
      const url = wasm.cstrToJs(name);

      let valid = false;
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('HEAD', url, false);
        xhr.onload = () => {
          const fh = Object.create(null) as FileDescriptor;
          fh.fid = fid;
          fh.url = url;
          fh.sq3File = new sqlite3_file(fid);
          fh.sq3File.$pMethods = httpIoMethods.pointer;
          fh.size = BigInt(xhr.getResponseHeader('Content-Length'));
          openFiles[fid] = fh;
          valid = true;
        };
        xhr.send();
      } catch (e) {
        console.error('xOpen', e);
      }

      if (!valid) {
        console.error('xOpen');
        return capi.SQLITE_CANTOPEN;
      }
      wasm.poke(pOutFlags, capi.SQLITE_OPEN_READONLY, 'i32');
      return capi.SQLITE_OK;
    }
  };

  sqlite3.vfs.installVfs({
    io: { struct: httpIoMethods, methods: ioSyncWrappers },
    vfs: { struct: httpVfs, methods: vfsSyncWrappers }
  });
}
