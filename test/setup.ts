/* eslint-disable @typescript-eslint/no-explicit-any */
// Some quick hacks to make SQLite WASM work in Node.js

/// <reference path='./modules.d.ts' />
import WebWorker from '@mmomtchev/web-worker';
import { MessageChannel, MessagePort as MessagePort } from 'worker_threads';
import { performance } from 'perf_hooks';

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
