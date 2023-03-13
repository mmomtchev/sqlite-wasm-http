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

  export namespace sqlite3 {
    export namespace capi {
      export const sqlite3_vfs: typeof Internal.CStruct;
      export const sqlite3_file: typeof Internal.CStruct;
      export const sqlite3_io_methods: typeof Internal.CStruct;
      export const sqlite3_vfs_find: (vfs: unknown) => unknown;

      export const OK = 0;
      export const SQLITE_ERROR: number;
      export const SQLITE_NOTFOUND: number;
      export const SQLITE_IOERR: number;
      export const SQLITE_TOOBIG: number;
      export const SQLITE_OK: number;
      export const SQLITE_CANTOPEN: number;
      export const SQLITE_READONLY: number;

      export const SQLITE_OPEN_READONLY: number;
      export const SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN: number;
      export const SQLITE_IOCAP_IMMUTABLE: number;
      export const SQLITE_LOCK_NONE: number;
    }

    export namespace wasm {
      export function poke(ptr: Internal.CPointer, val: bigint, size: 'i64'): void;
      export function poke(ptr: Internal.CPointer, val: number, size: 'i32'): void;
      export function poke(ptr: Internal.CPointer, val: number, size: 'double'): void;
      export function cstrToJs(ptr: Internal.CPointer): string;
      export function cstrncpy(dst: Internal.CPointer, src: Internal.CPointer, len: number): number;
      export function heap8u(): {
        set: (src: Uint8Array, dest: Internal.CPointer) => void;
      };
      export function allocCString(s: string): Internal.CPointer;
    }

    export namespace oo1 {
      export class DB {}
    }
    export namespace vfs {
      export function installVfs(...args: unknown[]): void;
    }
  }
}
