declare namespace VFSHTTP {

  export interface BackendChannel {
    port: MessagePort;
    shm: SharedArrayBuffer;
  }

  export interface Backend {
    worker: Worker;
    createNewChannel: () => Promise<BackendChannel>;
  }

  export interface Options {
    /**
     * Timeout for SQL operations (must take HTTP transfers into account)
     * @default 30000
     */
    timeout?: number;
    /**
     * Maximum supported page size
     * @default 4096
     */
    maxPageSize?: number;
  }
}