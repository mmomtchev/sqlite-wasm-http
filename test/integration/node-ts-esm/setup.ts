// Some quick hacks to make SQLite WASM work in Node.js
import WebWorker from '@mmomtchev/web-worker';
import { MessageChannel, MessagePort as MessagePort } from 'worker_threads';
import { performance } from 'perf_hooks';

(globalThis as any).self = globalThis;
(self as any).location = { href: 'http://localhost/' };

globalThis.Worker = class Worker extends WebWorker {
  constructor(specifier, options = {}) {
    super(specifier, { ...options, type: 'module' });
  }
} as typeof WebWorker;

(globalThis as any).MessagePort = MessagePort;
(globalThis as any).MessageChannel = MessageChannel;

(globalThis as any).performance = performance;
