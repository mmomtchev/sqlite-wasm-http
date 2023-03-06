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
  /**
   * Cache size in Kb
   * @default 1024
   */
  cacheSize?: number;
}

export function defaultOptions(options?: Options): Options {
  return {
    timeout: options?.timeout ?? 20000,
    maxPageSize: options?.maxPageSize ?? 4096,
    cacheSize: options.cacheSize ?? 1024
  };
}

export type Operation = 'xOpen' | 'xAccess' | 'xRead' | 'xFilesize';
export interface Message {
  msg: Operation;
  url: string;
  offset?: BigInt;
  n?: number;
  [key: string]: string | number | BigInt;
}
