export interface BackendChannel {
  port: MessagePort;
  shm: SharedArrayBuffer;
}

export interface Backend {
  worker: Worker;
  /**
   * Create a new channel to be used with a new SQLite worker
   * @returns {Promise<BackendChannel>}
   */
  createNewChannel: () => Promise<BackendChannel>;
  /**
   * Close the HTTP backend waiting for clean shutdown
   */
  close: () => Promise<void>;
  /**
   * Synchronously kill the HTTP backend
   */
  terminate: () => void;
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
  debug?: string[];
}

export function defaultOptions(options?: Options): Options {
  return {
    timeout: options?.timeout ?? 20000,
    maxPageSize: options?.maxPageSize ?? 4096,
    cacheSize: options.cacheSize ?? 1024,
    debug: []
  };
}

export type Operation = 'xOpen' | 'xAccess' | 'xRead' | 'xFilesize';
export interface Message {
  msg: Operation;
  url: string;
  offset?: bigint;
  n?: number;
  [key: string]: string | number | BigInt;
}

declare const SQLITE_DEBUG: string[];
const debugOptions = (typeof SQLITE_DEBUG !== 'undefined' && SQLITE_DEBUG) ||
  (typeof process?.env?.SQLITE_DEBUG !== 'undefined' && process.env.SQLITE_DEBUG) ||
  '';

export const debugSys = ['threads', 'vfs', 'cache'] as const;
export const debug = {} as Record<typeof debugSys[number], (...args: any[]) => void>;
for (const d of debugSys) {
  debug[d] = debugOptions.includes(d) ?
    console.debug.bind(console) :
    () => undefined;
}
