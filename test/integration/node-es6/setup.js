// Some quick hacks to make SQLite WASM work in Node.js
import WebWorker from '@mmomtchev/web-worker';
import { MessageChannel, MessagePort as MessagePort } from 'worker_threads';
import { performance } from 'perf_hooks';
globalThis.self = globalThis;
self.location = { href: 'http://localhost/' };
globalThis.Worker = class Worker extends WebWorker {
    constructor(specifier, options = {}) {
        super(specifier, Object.assign(Object.assign({}, options), { type: 'module' }));
    }
};
globalThis.MessagePort = MessagePort;
globalThis.MessageChannel = MessageChannel;
globalThis.performance = performance;
