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
   * @default 4096
   */
  cacheSize?: number;
  /**
   * Optional custom headers to be used when requesting data
   */
  headers?: Record<string, string>;
  /**
   * Force the type of backend
   */
  backendType?: 'sync' | 'shared';
  /**
   * Open method to determine file size. Use GET if server uses
   * compression for HEAD responses (e.g. GitHub)
   */
  openMethod?: 'GET' | 'HEAD';
}

export const defaultOptions = {
  timeout: 20000,
  maxPageSize: 4096,
  cacheSize: 1024,
  headers: {} as Record<string, string>,
  openMethod: 'HEAD'
};

export interface BackendChannel {
  port: MessagePort;
  shm: SharedArrayBuffer;
}

export interface Backend {
  /**
   * The backend type
   */
  type: 'shared' | 'sync',
  /**
   * @private
   */
  worker: Worker | null;
  /**
   * @private
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
  /**
   * The options object
   */
  options?: Options;
}

export type Operation = 'xOpen' | 'xAccess' | 'xRead' | 'xFilesize';
export interface Message {
  msg: Operation;
  url: string;
  offset?: bigint;
  n?: number;
  [key: string]: string | number | bigint | undefined;
}

// These must be different from any SQLite CAPI codes
export enum SYNC {
  WORKMSG = 0xffffff,
  HANDSHAKE = 0xfffffe
}

declare const SQLITE_DEBUG: string[];
const debugOptions = (typeof SQLITE_DEBUG !== 'undefined' && SQLITE_DEBUG) ||
  (typeof process !== 'undefined' && typeof process?.env?.SQLITE_DEBUG !== 'undefined' && process.env.SQLITE_DEBUG) ||
  '';

export const debugSys = ['threads', 'vfs', 'cache', 'http'] as const;
export const debug = {} as Record<typeof debugSys[number], (...args: unknown[]) => void>;
for (const d of debugSys) {
  debug[d] = debugOptions.includes(d) ?
    console.debug.bind(console) :
    () => undefined;
}

