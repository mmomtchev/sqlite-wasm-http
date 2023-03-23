/* eslint-disable @typescript-eslint/no-explicit-any */
// Some quick hacks to make SQLite WASM work in Node.js

/// <reference path='./modules.d.ts' />
import WebWorker from '@mmomtchev/web-worker';
import { MessageChannel, MessagePort as MessagePort } from 'worker_threads';
import { performance } from 'perf_hooks';
// Binary version of the classic xmlhttprequest
import { XMLHttpRequest as _XMLHttpRequest } from '#XMLHttpRequest.cjs';

(globalThis as any).self = globalThis;
(self as any).location = { href: 'http://localhost/' };

globalThis.Worker = class Worker extends WebWorker {
  constructor(specifier: string, options = {}) {
    super(specifier, { ...options, type: 'module' });
  }
} as typeof WebWorker;

(globalThis as any).MessagePort = MessagePort;
(globalThis as any).MessageChannel = MessageChannel;

(globalThis as any).performance = performance;

if (typeof globalThis.XMLHttpRequest === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).XMLHttpRequest = class XMLHttpRequest extends _XMLHttpRequest {
    get response() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = Uint8Array.from((this as any).responseText.split('').map((x: string) => x.charCodeAt(0))).buffer;
      return r;
    }
  };
}
