declare namespace SQLite {
  export namespace Internal {
    // Opaque C pointer type
    export type CPointer = unknown;
    // Opaque file descriptor type
    export type FH = symbol;

    export class CStruct {
      constructor(...args: unknown[]);

      static structInfo: {
        sizeof: number;
      };

      [prop: string]: unknown;
    }
  }

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
    readonly SQLITE_IOCAP_IMMUTABLE: number;
    readonly SQLITE_LOCK_NONE: number;
  }

  export interface WASM {
    poke: ((ptr: Internal.CPointer, val: bigint, size: 'i64') => void) &
    ((ptr: Internal.CPointer, val: number, size: 'i32') => void) &
    ((ptr: Internal.CPointer, val: number, size: 'double') => void);
    cstrToJs: (ptr: Internal.CPointer) => string;
    cstrncpy: (dst: Internal.CPointer, src: Internal.CPointer, len: number) => number;
    heap8u: () => {
      set: (src: Uint8Array, dest: Uint8Array) => void;
    };

    [fn: string]: Function;
  }
  export interface SQLite {
    capi: CAPI;
    wasm: WASM;
    vfs: {
      installVfs: (...args: unknown[]) => void;
    };
  }
}
