export interface RowArray {
  type: string;
  row: unknown[];
  rowNumber: number;
  columnNames: string[];
}

export interface RowObject {
  type: string;
  row: Record<string, unknown>;
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

export type Result = ResultArray | ResultObject;

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

export namespace sqlite3 {
  export namespace capi {
    export const sqlite3_vfs: typeof Internal.CStruct;
    export const sqlite3_file: typeof Internal.CStruct;
    export const sqlite3_io_methods: typeof Internal.CStruct;

    export function sqlite3_exec(
      db: oo1.DB, sql: string | string[],
      cb: Internal.CPointer,
      arg: Internal.CPointer,
      err: Internal.CPointer);
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
    export class DB {
      static dbCtorHelper: DbCtorHelper;
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
  bind?: Record<string, unknown>;
  callback: (row: ResultArray) => void;
  rowMode?: 'array';
  resultRows?: unknown[];
};
export type MessageExecObject = {
  sql: string;
  bind?: Record<string, unknown>;
  callback: (row: ResultObject) => void;
  rowMode: 'object';
  resultRows?: unknown[];
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

export type Promiser1Exec = (msgType: 'exec', args: MessageExecArray) => Promise<ResponseExec>;
export type Promiser2Exec = (msg: { type: 'exec'; } & MessageExecArray) => Promise<ResponseExec>;
export type Promiser3Exec = (msgType: 'exec', args: MessageExecObject) => Promise<ResponseExec>;
export type Promiser4Exec = (msg: { type: 'exec'; } & MessageExecObject) => Promise<ResponseExec>;
export type Promiser1Open = (msgType: 'open', args: MessageOpen) => Promise<ResponseOpen>;
export type Promiser2Open = (msg: { type: 'open'; } & MessageOpen) => Promise<ResponseOpen>;
export type Promiser1Close = (msgType: 'close', args: MessageClose) => Promise<ResponseClose>;
export type Promiser2Close = (msg: { type: 'close'; } & MessageClose) => Promise<ResponseClose>;
export type Promiser1ConfigGet = (msgType: 'config-get', args: MessageConfigGet) => Promise<ResponseConfigGet>;
export type Promiser2ConfigGet = (msg: { type: 'config-get'; } & MessageConfigGet) => Promise<ResponseConfigGet>;
export type Promiser = Promiser1Exec & Promiser2Exec &
  Promiser1Open & Promiser2Open &
  Promiser1Close & Promiser2Close &
  Promiser1ConfigGet & Promiser2ConfigGet &
{ close: () => void; };
