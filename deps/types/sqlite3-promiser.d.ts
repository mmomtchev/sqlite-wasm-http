declare namespace SQLite {
  export interface PromiserConfig {
    onready: () => void;
    worker: Worker | (() => void);
    generateMessageId?: (msg: Message) => MessageId;
    debug?: (...args: unknown[]) => void;
    onunhandled?: (e: unknown) => void;
  }

  export interface Row {
    type: string;
    row: Record<string, unknown>;
    rowNumber: number;
    columnNames: string[];
  }
  export interface RowEOT {
    row: null;
    rowNumber: null;
  }
  export type Result = Row | RowEOT;

  export type MessageType = 'open' | 'close' | 'exec' | 'config-get';
  export type MessageId = string;
  export type MessageExec = {
    sql: string;
    callback: (row: Result) => void;
  };
  export type MessageOpen = {
    filename: string;
    vfs?: string;
  };

  export type MessageClose = {};
  export type MessageConfigGet = {};
  export type Message = MessageExec | MessageOpen | MessageClose | MessageConfigGet;

  export type ResponseError = {
    type: 'error';
    messageId: MessageId;
    dbId: MessageExec;
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
    dbId: MessageExec;
    result: {
      version: string;
      bigIntEnable: boolean;
      vfsList: string[];
    };
  };

  export type ResponseExec = {
    type: 'exec';
    messageId: MessageId;
    dbId: MessageExec;
    result: Record<string, any>;
  };

  export type ResponseOpen = {
    type: 'open';
    messageId: MessageId;
    dbId: MessageExec;
    result: {
      filename: string;
      persistent: boolean;
      vfs: string;
    };
  };

  export type ResponseClose = {
    type: 'close';
    messageId: MessageId;
    dbId: MessageExec;
    result: {
      filename?: string;
    };
  };

  export type Promiser1Exec = (msgType: 'exec', args: MessageExec) => Promise<ResponseExec>;
  export type Promiser2Exec = (msg: { type: 'exec'; } & MessageExec) => Promise<ResponseExec>;
  export type Promiser1Open = (msgType: 'open', args: MessageOpen) => Promise<ResponseOpen>;
  export type Promiser2Open = (msg: { type: 'open'; } & MessageOpen) => Promise<ResponseOpen>;
  export type Promiser1Close = (msgType: 'close', args: MessageClose) => Promise<ResponseClose>;
  export type Promiser2Close = (msg: { type: 'close'; } & MessageClose) => Promise<ResponseClose>;
  export type Promiser1ConfigGet = (msgType: 'config-get', args: MessageConfigGet) => Promise<ResponseConfigGet>;
  export type Promiser2ConfigGet = (msg: { type: 'config-get'; } & MessageConfigGet) => Promise<ResponseConfigGet>;
  export type Promiser = Promiser1Exec & Promiser2Exec &
    Promiser1Open & Promiser2Open &
    Promiser1Close & Promiser2Close &
    Promiser1ConfigGet & Promiser2ConfigGet;
}
