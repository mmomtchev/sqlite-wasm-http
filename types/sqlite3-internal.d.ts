declare namespace Internal {
  // Opaque C pointer type
  export type CPointer = unknown;
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
