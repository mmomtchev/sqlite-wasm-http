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
    backend: BackendChannel;
  }

}