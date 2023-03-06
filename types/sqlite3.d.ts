import { Promiser } from "./sqlite3-promiser";

export { };

export interface CAPI {
  sqlite3_vfs: typeof Internal.CStruct;
  sqlite3_file: typeof Internal.CStruct;
  sqlite3_io_methods: typeof Internal.CStruct;
  sqlite3_vfs_find: (vfs: unknown) => unknown;

  readonly OK: 0;
  readonly SQLITE_ERROR: number;
  readonly SQLITE_NOTFOUND: number;
  readonly SQLITE_IOERR: number;
  readonly SQLITE_TOOBIG: number;
  readonly SQLITE_OK: number;
  readonly SQLITE_CANTOPEN: number;
  readonly SQLITE_READONLY: number;

  readonly SQLITE_OPEN_READONLY: number;
  readonly SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN: number;
  readonly SQLITE_LOCK_NONE: number;
}

export interface WASM {
  poke: ((ptr: Internal.Pointer, val: BigInt, size: 'i64') => void) &
  ((ptr: Internal.Pointer, val: number, size: 'i32') => void);

  [fn: string]: Function;
}
export interface SQLite {
  capi: CAPI;
  wasm: WASM;
  vfs: {
    installVfs: (...args: unknown[]) => void;
  };
}

declare global {
  var sqlite3Worker1Promiser: (config: Promiser.PromiserConfig) => Promiser.Promiser;
}