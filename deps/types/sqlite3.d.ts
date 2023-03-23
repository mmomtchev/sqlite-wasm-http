export type SQLValue = null | number | boolean | bigint | string | Uint8Array;
export type SQLBindable = undefined | SQLValue | Int8Array | ArrayBuffer;

export interface RowArray {
  type: string;
  row: SQLValue[];
  rowNumber: number;
  columnNames: string[];
}

export interface RowObject {
  type: string;
  row: Record<string, SQLValue>;
  rowNumber: number;
  columnNames: string[];
}

export interface RowEOT {
  type: string;
  row: undefined;
  rowNumber: null;
  columnNames: string[];
}

export type ResultArray = RowArray | RowEOT;

export type ResultObject = RowObject | RowEOT;

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

export type SQLite3 = typeof sqlite3;

export default function (): Promise<SQLite3>;

export namespace sqlite3 {
  export function initWorker1API(): void;
  export namespace capi {
    export const sqlite3_vfs: typeof Internal.CStruct;
    export const sqlite3_file: typeof Internal.CStruct;
    export const sqlite3_io_methods: typeof Internal.CStruct;

    export function sqlite3_exec(
      db: oo1.DB, sql: string | string[],
      cb: Internal.CPointer,
      arg: Internal.CPointer,
      err: Internal.CPointer): number;
    export function sqlite3_vfs_find(vfs: unknown): unknown;
    export function sqlite3_busy_timeout(db: oo1.DB, timeout: number): void;

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

  interface DbCtorHelper {
    setVfsPostOpenSql(vfs: Internal.CPointer, cb: (db: oo1.DB, sqlite3: SQLite3) => void): void;
  }

  export namespace oo1 {
    interface OpenOptions {
      bind?: Record<string, SQLBindable> | SQLBindable[];
      saveSql?: string[],
      columnNames?: string[];
      resultRows?: SQLValue[];
    }
    export class DB {
      constructor(filename?: string, flags?: number, vfs?: string);
      constructor(opts: {filename?: string, flags?: number, vfs?: string});
      static dbCtorHelper: DbCtorHelper;

      close(): void;
      checkRc(resultCode: number): void;
      static checkRc(db: DB, resultCode: number): void;
      affirmOpen(): void;
      isOpen(): boolean;
      dbFilename(dbName?: string): string;
      dbName(dbIndex?: number): string;
      dbVfsName(dbName?: string): string;


      exec(sql: string, opts: OpenOptions & {
        returnValue?: 'resultRows',
        rowMode: 'array';
      }): SQLValue[][];
      exec(sql: string, opts: OpenOptions & {
        returnValue?: 'resultRows',
        rowMode: 'object';
      }): Record<string, SQLValue>[];

      exec(sql: string, opts?: OpenOptions & {
        returnValue?: 'this',
        callback?: (row: SQLValue[]) => void;
        rowMode?: 'array'
      }): this;
      exec(sql: string, opts: OpenOptions & {
        returnValue?: 'this',
        callback?: (row: Record<string, SQLValue>) => void;
        rowMode: 'object';
      }): this;
    }
  }
  export namespace vfs {
    export function installVfs(...args: unknown[]): void;
  }
}

export interface PromiserConfig {
  onready: () => void;
  worker: Worker | (() => void);
  generateMessageId?: (msg: Message) => MessageId;
  debug?: (...args: unknown[]) => void;
  onunhandled?: (e: unknown) => void;
}

export type RowMode = 'array' | 'object' | 'stmt';

export type MessageType = 'open' | 'close' | 'exec' | 'config-get';
export type MessageId = string;
export type MessageExecArray = {
  sql: string;
  bind?: Record<string, SQLBindable> | SQLBindable[];
  callback: (row: ResultArray) => void;
  rowMode?: 'array';
  resultRows?: SQLValue[];
};
export type MessageExecObject = {
  sql: string;
  bind?: Record<string, SQLBindable> | SQLBindable[];
  callback: (row: ResultObject) => void;
  rowMode: 'object';
  resultRows?: SQLValue[];
};

export type MessageOpen = {
  filename: string;
  vfs?: string;
};

export type MessageClose = { unlink?: boolean; };
export type MessageConfigGet = {};
export type Message = MessageExecArray | MessageExecObject | MessageOpen | MessageClose | MessageConfigGet;

export type ResponseError = {
  type: 'error';
  messageId: MessageId;
  dbId: MessageId;
  result: {
    operation: MessageType;
    message: string;
    errorClass: string;
    input: string;
    stack?: unknown[];
  };
};

export type ResponseConfigGet = {
  type: 'config-get';
  messageId: MessageId;
  dbId: string;
  result: {
    version: string;
    bigIntEnable: boolean;
    vfsList: string[];
  };
};

export type ResponseExec = {
  type: 'exec';
  messageId: MessageId;
  dbId: string;
  result: Record<string, any>;
};

export type ResponseOpen = {
  type: 'open';
  messageId: MessageId;
  dbId: string;
  result: {
    filename: string;
    persistent: boolean;
    vfs: string;
  };
};

export type ResponseClose = {
  type: 'close';
  messageId: MessageId;
  dbId: string;
  result: {
    filename?: string;
  };
};

export type Response = ResponseConfigGet | ResponseOpen | ResponseClose | ResponseExec;

export type Promiser = {
  (msgType: 'exec', args: MessageExecArray): Promise<ResponseExec>;
  (msg: { type: 'exec'; } & MessageExecArray): Promise<ResponseExec>;
  (msgType: 'exec', args: MessageExecObject): Promise<ResponseExec>;
  (msg: { type: 'exec'; } & MessageExecObject): Promise<ResponseExec>;
  (msgType: 'open', args: MessageOpen): Promise<ResponseOpen>;
  (msg: { type: 'open'; } & MessageOpen): Promise<ResponseOpen>;
  (msgType: 'close', args: MessageClose): Promise<ResponseClose>;
  (msg: { type: 'close'; } & MessageClose): Promise<ResponseClose>;
  (msgType: 'config-get', args: MessageConfigGet): Promise<ResponseConfigGet>;
  (msg: { type: 'config-get'; } & MessageConfigGet): Promise<ResponseConfigGet>;
} & { close: () => void; };

declare global {
  export var sqlite3Worker1Promiser: (config: PromiserConfig) => Promiser;
}
