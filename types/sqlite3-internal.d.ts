declare namespace Internal {
  // Opaque C pointer type
  export type Pointer = symbol;
  // Opaque file descriptor type
  export type FH = symbol;

  export class CStruct {
    constructor(...args: unknown[]);

    static structInfo: {
      sizeof: number;
    }

    [prop: string]: unknown;
  }
}

declare namespace VFSHTTP {
  export type Operation = 'xOpen' | 'xAccess' | 'xRead' | 'xFilesize';
  export interface Message {
    msg: Operation;
    url: string;
    offset?: BigInt;
    n?: number;
    [key: string]: string | number | BigInt;
  }
}