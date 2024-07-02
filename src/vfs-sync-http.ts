// This is the ersatz HTTP backend
// It does not require SharedArrayBuffer and does not share its cache
// It runs in the SQLite worker thread
// Each SQLite worker thread has its own independent copy

import { LRUCache } from 'lru-cache';
import { ntoh16 } from './endianness.js';
import * as VFSHTTP from './vfs-http-types.js';
import { debug } from './vfs-http-types.js';
import { SQLite3, Internal } from '../deps/types/sqlite3.js';

interface FileDescriptor {
  fid: Internal.FH;
  url: string;
  sq3File: Internal.CStruct;
  size: bigint;
  pageSize: number;
  pageCache: LRUCache<number, Uint8Array | number>;
}

const openFiles: Record<Internal.FH, FileDescriptor> = {};

export function installSyncHttpVfs(sqlite3: SQLite3, options?: VFSHTTP.Options) {
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
      debug['vfs']('file size is ', openFiles[fid].size);
      wasm.poke(size, openFiles[fid].size, 'i64');
      return 0;
    },
    xLock: function (fid: Internal.FH, lock: number) {
      debug['vfs']('xLock', fid, lock);
      return 0;
    },
    xRead: function (fid: Internal.FH, dest: Internal.CPointer | Uint8Array, n: number, offset: bigint) {
      debug['vfs']('xRead (sync)', fid, dest, n, offset);
      if (Number(offset) > Number.MAX_SAFE_INTEGER) {
        // CampToCamp are not supported
        return capi.SQLITE_TOOBIG;
      }
      if (!openFiles[fid]) {
        return capi.SQLITE_NOTFOUND;
      }
      const entry = openFiles[fid];

      if (!entry.pageSize) {
        // Determine the page size if we don't know it
        // It is in two big-endian bytes at offset 16 in what is always the first page
        entry.pageSize = 1024;
        const pageDataBuffer = new Uint8Array(2);
        const r = ioSyncWrappers.xRead(fid, pageDataBuffer, 2, BigInt(16));
        const pageData = new Uint16Array(pageDataBuffer.buffer);
        if (r !== 0)
          return capi.SQLITE_IOERR;
        ntoh16(pageData);
        entry.pageSize = pageData[0];
        debug['vfs'](`page size is ${entry.pageSize}`);
        if (entry.pageSize != 1024) {
          // If the page size is not 1024 we can't keep this "page" in the cache
          console.warn(`Page size for ${entry.url} is ${entry.pageSize}, recommended size is 1024`);
          entry.pageCache.delete(0);
        }
        if (entry.pageSize > (options?.maxPageSize ?? VFSHTTP.defaultOptions.maxPageSize))
          throw new Error(`${entry.pageSize} is over the maximum configured ` +
            `${options?.maxPageSize ?? VFSHTTP.defaultOptions.maxPageSize}`);
      }

      try {
        const pageSize = BigInt(entry.pageSize);
        const len = BigInt(n);
        const page = offset / pageSize;
        if (page * pageSize !== offset)
          debug['vfs'](`Read chunk ${offset} is not page-aligned`);
        let pageStart = page * pageSize;
        if (pageStart + pageSize < offset + len)
          throw new Error(`Read chunk ${offset}:${n} spans across a page-boundary`);
        let data = entry.pageCache.get(Number(page));

        if (typeof data === 'number') {
          debug['cache'](`[sync] cache hit (multi-page segment) for ${entry.url}:${page}`);

          // This page is present as a segment of a super-page
          const newPageStart = BigInt(data) * pageSize;
          data = entry.pageCache.get(data);
          if (data instanceof Uint8Array) {
            // Not all subpages are valid, there are two possible cases
            // where a non-valid superpage can be referenced:
            // * the superpage was too big to fit in the cache
            // * the superpage was evicted before the subsegments
            pageStart = newPageStart;
          } else {
            data = undefined as unknown as Uint8Array;
          }
        }

        if (typeof data === 'undefined') {
          debug['cache'](`[sync] cache miss for ${entry.url}:${page}`);

          let chunkSize = entry.pageSize;
          // If the previous page is in the cache, we double the page size
          // This was the original page merging algorithm implemented by @phiresky
          let prev = page > 0 && entry.pageCache.get((Number(page) - 1));
          if (prev) {
            if (typeof prev === 'number')
              prev = entry.pageCache.get(prev) as Uint8Array;
            if (prev instanceof Uint8Array) {
              // Valid superpage
              chunkSize = prev.byteLength * 2;
              debug['cache'](`[sync] downloading super page of size ${chunkSize}`);
            }
          }
          const pages = chunkSize / entry.pageSize;

          // Downloading a new segment
          debug['http'](`downloading page ${page} of size ${chunkSize} starting at ${pageStart}`);
          const xhr = new XMLHttpRequest();
          xhr.open('GET', entry.url, false);
          for (const h of Object.keys(options?.headers ?? VFSHTTP.defaultOptions.headers))
            xhr.setRequestHeader(h, (options?.headers ?? VFSHTTP.defaultOptions.headers)[h]);
          xhr.setRequestHeader('Range', `bytes=${pageStart}-${pageStart + BigInt(chunkSize - 1)}`);
          xhr.responseType = 'arraybuffer';
          xhr.onload = () => {
            if (xhr.response instanceof ArrayBuffer)
              data = new Uint8Array(xhr.response);
          };
          xhr.send();
          if (!data) {
            return capi.SQLITE_IOERR;
          }
          // TypeScript does not recognize the sync XMLHttpRequest
          data = data as Uint8Array;

          if (!(data instanceof Uint8Array) || data.length === 0)
            throw new Error(`Invalid HTTP response received: ${JSON.stringify(xhr.response)}`);

          // In case of a multiple-page segment, this is the parent super-page
          entry.pageCache.set(Number(page), data);

          // These point to the parent super-page
          for (let i = Number(page) + 1; i < Number(page) + pages; i++) {
            entry.pageCache.set(i, Number(page));
          }
        } else {
          debug['cache'](`[sync] cache hit for ${entry.url}:${page}`);
        }

        const pageOffset = Number(offset - pageStart);
        if (dest instanceof Uint8Array)
          dest.set(data.subarray(pageOffset, pageOffset + n));
        else
          wasm.heap8u().set(data.subarray(pageOffset, pageOffset + n), dest);
        return capi.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return capi.SQLITE_ERROR;
      }
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

      const fid = Symbol();
      const r = vfsSyncWrappers.xOpen(vfs, name, fid, flags, out);
      if (r === capi.SQLITE_OK) {
        ioSyncWrappers.xClose(fid);
        wasm.poke(out, 1, 'i32');
      } else {
        wasm.poke(out, 0, 'i32');
      }
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
      pOutFlags: Internal.CPointer) {
      debug['vfs']('xOpen (sync)', vfs, name, fid, flags, pOutFlags);
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
        for (const h of Object.keys(options?.headers ?? VFSHTTP.defaultOptions.headers))
          xhr.setRequestHeader(h, (options?.headers ?? VFSHTTP.defaultOptions.headers)[h]);
        xhr.onload = () => {
          const fh = Object.create(null) as FileDescriptor;
          fh.fid = fid;
          fh.url = url;
          fh.sq3File = new sqlite3_file(fid);
          fh.sq3File.$pMethods = httpIoMethods.pointer;
          fh.size = BigInt(xhr.getResponseHeader('Content-Length') ?? 0);
          fh.pageCache = new LRUCache({
            maxSize: (options?.cacheSize ?? VFSHTTP.defaultOptions.cacheSize) * 1024,
            sizeCalculation: (value) => (value as Uint8Array).byteLength ?? 4
          });
          if (xhr.getResponseHeader('Accept-Ranges') !== 'bytes') {
            console.warn(`Server for ${url} does not advertise 'Accept-Ranges'. ` +
              'If the server supports it, in order to remove this message, add "Accept-Ranges: bytes". ' +
              'Additionally, if using CORS, add "Access-Control-Expose-Headers: *".');
          }
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
