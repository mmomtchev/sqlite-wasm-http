(()=>{"use strict";var e,t,r={467:(e,t,r)=>{const n={timeout:2e4,maxPageSize:4096,cacheSize:1024,headers:{}};var o;!function(e){e[e.WORKMSG=16777215]="WORKMSG",e[e.HANDSHAKE=16777214]="HANDSHAKE"}(o||(o={}));const s=[]||0,i=["threads","vfs","cache","http"],a={};for(const e of i)a[e]=s.includes(e)?console.debug.bind(console):()=>{};const c={};var u=r(842);const l=function(){const e=new ArrayBuffer(2),t=new Uint8Array(e),r=new Uint16Array(e);if(t[0]=240,t[1]=13,61453==r[0])return a.threads("System is Big-Endian"),!1;if(3568==r[0])return a.threads("System is Little-Endian"),!0;throw new Error(`Failed determining endianness: ${r}`)}(),f={};a.threads("SQLite worker started"),globalThis.onmessage=({data:e})=>{a.threads("SQLite received green light",e);const t=e;r.e(713).then(r.bind(r,713)).then((e=>e.default())).then((e=>{a.threads("SQLite init"),e.initWorker1API(),"object"==typeof t.httpChannel?function(e,t,r){if("undefined"==typeof SharedArrayBuffer)throw new Error('SharedArrayBuffer is not available. If your browser supports it, the webserver must send "Cross-Origin-Opener-Policy: same-origin "and "Cross-Origin-Embedder-Policy: require-corp" headers.');if(!(t&&t.port instanceof MessagePort&&t.shm instanceof SharedArrayBuffer))throw new Error("No backend message channel in options");const s=new Int32Array(t.shm,t.shm.byteLength-Int32Array.BYTES_PER_ELEMENT),i=new Uint8Array(t.shm,0,t.shm.byteLength-Int32Array.BYTES_PER_ELEMENT),u=e.capi,l=e.wasm,f=u.sqlite3_vfs,p=u.sqlite3_file,d=u.sqlite3_io_methods,h=new f,v=new d;h.$iVersion=1,h.$szOsFile=u.sqlite3_file.structInfo.sizeof,h.$mxPathname=1024,h.$zName=l.allocCString("http"),h.$xDlOpen=h.$xDlError=h.$xDlSym=h.$xDlClose=null;const E=e=>{var i;let a,c;Atomics.store(s,0,o.WORKMSG),t.port.postMessage(e);do{a=Atomics.wait(s,0,o.WORKMSG,null!==(i=null==r?void 0:r.timeout)&&void 0!==i?i:n.timeout),c=Atomics.load(s,0)}while("ok"===a&&c===o.WORKMSG);return"timed-out"===a?(console.error("Backend timeout",a,s,e),-1):c},m={xCheckReservedLock:function(e,t){return a.vfs("xCheckReservedLock",e,t),l.poke(t,0,"i32"),0},xClose:function(e){return a.vfs("xClose",e),c[e]?(delete c[e],0):u.SQLITE_NOTFOUND},xDeviceCharacteristics:function(e){return a.vfs("xDeviceCharacteristics",e),u.SQLITE_IOCAP_IMMUTABLE},xFileControl:function(e,t,r){return a.vfs("xFileControl",e,t,r),t===u.SQLITE_FCNTL_SYNC?u.SQLITE_OK:u.SQLITE_NOTFOUND},xFileSize:function(e,r){if(a.vfs("xFileSize",e,r),!c[e])return u.SQLITE_NOTFOUND;if(0!==E({msg:"xFilesize",url:c[e].url}))return u.SQLITE_IOERR;const n=new BigUint64Array(t.shm,0,1)[0];return a.vfs("file size is ",n),l.poke(r,n,"i64"),0},xLock:function(e,t){return a.vfs("xLock",e,t),0},xRead:function(e,t,r,n){if(a.vfs("xRead",e,t,r,n),Number(n)>Number.MAX_SAFE_INTEGER)return u.SQLITE_TOOBIG;if(!c[e])return u.SQLITE_NOTFOUND;const o=E({msg:"xRead",url:c[e].url,n:r,offset:n});return 0!==o?(console.error("xRead",o),u.SQLITE_IOERR):(l.heap8u().set(i.subarray(0,r),t),u.SQLITE_OK)},xSync:function(e,t){return a.vfs("xSync",e,t),0},xTruncate:function(e,t){return a.vfs("xTruncate",e,t),0},xUnlock:function(e,t){return a.vfs("xUnlock",e,t),0},xWrite:function(e,t,r,n){return a.vfs("xWrite",e,t,r,n),u.SQLITE_READONLY}},S={xAccess:function(e,r,n,o){if(a.vfs("xAccess",e,r,n,o),0==(n&u.SQLITE_OPEN_READONLY))return l.poke(o,0,"i32"),u.SQLITE_OK;const s=l.cstrToJs(r),i=E({msg:"xAccess",url:s});if(0!==i)return console.error("xAccess",i),u.SQLITE_IOERR;const c=new Uint32Array(t.shm,0,1)[0];return l.poke(o,c,"i32"),u.SQLITE_OK},xCurrentTime:function(e,t){return a.vfs("xCurrentTime",e,t),l.poke(t,2440587.5+(new Date).getTime()/864e5,"double"),0},xCurrentTimeInt64:function(e,t){return a.vfs("xCurrentTimeInt64",e,t),l.poke(t,BigInt(2440587.5)*BigInt(864e5)+BigInt((new Date).getTime()),"i64"),0},xDelete:function(e,t,r){return a.vfs("xDelete",e,t,r),u.SQLITE_READONLY},xFullPathname:function(e,t,r,n){return a.vfs("xFullPathname",e,t,r,n),l.cstrncpy(n,t,r)<r?0:u.SQLITE_CANTOPEN},xGetLastError:function(e,t,r){return a.vfs("xGetLastError",e,t,r),0},xOpen:function(e,t,r,n,o){if(a.vfs("xOpen",e,t,r,n,o),0===t)return console.error("HTTP VFS does not support anonymous files"),u.SQLITE_CANTOPEN;if("number"!=typeof t)return u.SQLITE_ERROR;l.poke(o,u.SQLITE_OPEN_READONLY,"i32");const s=l.cstrToJs(t),i=Object.create(null);i.fid=r,i.url=s,i.sq3File=new p(r),i.sq3File.$pMethods=v.pointer,c[r]=i;const f=E({msg:"xOpen",url:s});return f<0?(console.error("xOpen",f),u.SQLITE_IOERR):0!==f?(console.error("xOpen",f),u.SQLITE_CANTOPEN):u.SQLITE_OK}};e.vfs.installVfs({io:{struct:v,methods:m},vfs:{struct:h,methods:S}}),e.oo1.DB.dbCtorHelper.setVfsPostOpenSql(h.pointer,(function(e,t){var o;t.capi.sqlite3_busy_timeout(e,null!==(o=null==r?void 0:r.timeout)&&void 0!==o?o:n.timeout),t.capi.sqlite3_exec(e,["PRAGMA journal_mode=DELETE;","PRAGMA cache_size=0;"],0,0,0)}))}(e,t.httpChannel,t.httpOptions):!0===t.httpChannel&&(void 0===globalThis.XMLHttpRequest&&(globalThis.XMLHttpRequest=class extends(null){get response(){return Uint8Array.from(this.responseText.split("").map((e=>e.charCodeAt(0)))).buffer}}),function(e,t){const r=e.capi,o=e.wasm,s=r.sqlite3_vfs,i=r.sqlite3_file,c=r.sqlite3_io_methods,p=new s,d=new c;p.$iVersion=1,p.$szOsFile=r.sqlite3_file.structInfo.sizeof,p.$mxPathname=1024,p.$zName=o.allocCString("http"),p.$xDlOpen=p.$xDlError=p.$xDlSym=p.$xDlClose=null;const h={xCheckReservedLock:function(e,t){return a.vfs("xCheckReservedLock",e,t),o.poke(t,0,"i32"),0},xClose:function(e){return a.vfs("xClose",e),f[e]?(delete f[e],0):r.SQLITE_NOTFOUND},xDeviceCharacteristics:function(e){return a.vfs("xDeviceCharacteristics",e),r.SQLITE_IOCAP_IMMUTABLE},xFileControl:function(e,t,n){return a.vfs("xFileControl",e,t,n),t===r.SQLITE_FCNTL_SYNC?r.SQLITE_OK:r.SQLITE_NOTFOUND},xFileSize:function(e,t){return a.vfs("xFileSize",e,t),f[e]?(a.vfs("file size is ",f[e].size),o.poke(t,f[e].size,"i64"),0):r.SQLITE_NOTFOUND},xLock:function(e,t){return a.vfs("xLock",e,t),0},xRead:function(e,s,i,c){var u,p,d,v;if(a.vfs("xRead (sync)",e,s,i,c),Number(c)>Number.MAX_SAFE_INTEGER)return r.SQLITE_TOOBIG;if(!f[e])return r.SQLITE_NOTFOUND;const E=f[e];if(!E.pageSize){E.pageSize=1024;const o=new Uint8Array(2),s=h.xRead(e,o,2,BigInt(16)),i=new Uint16Array(o.buffer);if(0!==s)return r.SQLITE_IOERR;if(function(e){if(l)for(let t=0;t<e.length;t++)e[t]=(65280&e[t])>>8|(255&e[t])<<8}(i),E.pageSize=i[0],a.vfs(`page size is ${E.pageSize}`),1024!=E.pageSize&&(console.warn(`Page size for ${E.url} is ${E.pageSize}, recommended size is 1024`),E.pageCache.delete(0)),E.pageSize>(null!==(u=null==t?void 0:t.maxPageSize)&&void 0!==u?u:n.maxPageSize))throw new Error(`${E.pageSize} is over the maximum configured ${null!==(p=null==t?void 0:t.maxPageSize)&&void 0!==p?p:n.maxPageSize}`)}try{const e=BigInt(E.pageSize),u=BigInt(i),l=c/e;l*e!==c&&a.vfs(`Read chunk ${c} is not page-aligned`);let f=l*e;if(f+e<c+u)throw new Error(`Read chunk ${c}:${i} spans across a page-boundary`);let p=E.pageCache.get(Number(l));if("number"==typeof p){a.cache(`[sync] cache hit (multi-page segment) for ${E.url}:${l}`);const t=BigInt(p)*e;p=E.pageCache.get(p),p instanceof Uint8Array?f=t:p=void 0}if(void 0===p){a.cache(`[sync] cache miss for ${E.url}:${l}`);let e=E.pageSize,o=l>0&&E.pageCache.get(Number(l)-1);o&&("number"==typeof o&&(o=E.pageCache.get(o)),o instanceof Uint8Array&&(e=2*o.byteLength,a.cache(`[sync] downloading super page of size ${e}`)));const s=e/E.pageSize;a.http(`downloading page ${l} of size ${e} starting at ${f}`);const i=new XMLHttpRequest;i.open("GET",E.url,!1);for(const e of Object.keys(null!==(d=null==t?void 0:t.headers)&&void 0!==d?d:n.headers))i.setRequestHeader(e,(null!==(v=null==t?void 0:t.headers)&&void 0!==v?v:n.headers)[e]);if(i.setRequestHeader("Range",`bytes=${f}-${f+BigInt(e-1)}`),i.responseType="arraybuffer",i.onload=()=>{i.response instanceof ArrayBuffer&&(p=new Uint8Array(i.response))},i.send(),!p)return r.SQLITE_IOERR;if(!(p instanceof Uint8Array)||0===p.length)throw new Error(`Invalid HTTP response received: ${JSON.stringify(i.response)}`);E.pageCache.set(Number(l),p);for(let e=Number(l)+1;e<Number(l)+s;e++)E.pageCache.set(e,Number(l))}else a.cache(`[sync] cache hit for ${E.url}:${l}`);const h=Number(c-f);return s instanceof Uint8Array?s.set(p.subarray(h,h+i)):o.heap8u().set(p.subarray(h,h+i),s),r.SQLITE_OK}catch(e){return console.error(e),r.SQLITE_ERROR}},xSync:function(e,t){return a.vfs("xSync",e,t),0},xTruncate:function(e,t){return a.vfs("xTruncate",e,t),0},xUnlock:function(e,t){return a.vfs("xUnlock",e,t),0},xWrite:function(e,t,n,o){return a.vfs("xWrite",e,t,n,o),r.SQLITE_READONLY}},v={xAccess:function(e,t,n,s){if(a.vfs("xAccess",e,t,n,s),0==(n&r.SQLITE_OPEN_READONLY))return o.poke(s,0,"i32"),r.SQLITE_OK;const i=Symbol();return v.xOpen(e,t,i,n,s)===r.SQLITE_OK?(h.xClose(i),o.poke(s,1,"i32")):o.poke(s,0,"i32"),r.SQLITE_OK},xCurrentTime:function(e,t){return a.vfs("xCurrentTime",e,t),o.poke(t,2440587.5+(new Date).getTime()/864e5,"double"),0},xCurrentTimeInt64:function(e,t){return a.vfs("xCurrentTimeInt64",e,t),o.poke(t,BigInt(2440587.5)*BigInt(864e5)+BigInt((new Date).getTime()),"i64"),0},xDelete:function(e,t,n){return a.vfs("xDelete",e,t,n),r.SQLITE_READONLY},xFullPathname:function(e,t,n,s){return a.vfs("xFullPathname",e,t,n,s),o.cstrncpy(s,t,n)<n?0:r.SQLITE_CANTOPEN},xGetLastError:function(e,t,r){return a.vfs("xGetLastError",e,t,r),0},xOpen:function(e,s,c,l,p){var h,v;if(a.vfs("xOpen (sync)",e,s,c,l,p),0===s)return console.error("HTTP VFS does not support anonymous files"),r.SQLITE_CANTOPEN;if("number"!=typeof s)return r.SQLITE_ERROR;const E=o.cstrToJs(s);let m=!1;try{const e=new XMLHttpRequest;e.open("HEAD",E,!1);for(const r of Object.keys(null!==(h=null==t?void 0:t.headers)&&void 0!==h?h:n.headers))e.setRequestHeader(r,(null!==(v=null==t?void 0:t.headers)&&void 0!==v?v:n.headers)[r]);e.onload=()=>{var r,o;const s=Object.create(null);s.fid=c,s.url=E,s.sq3File=new i(c),s.sq3File.$pMethods=d.pointer,s.size=BigInt(null!==(r=e.getResponseHeader("Content-Length"))&&void 0!==r?r:0),s.pageCache=new u.Z({maxSize:1024*(null!==(o=null==t?void 0:t.cacheSize)&&void 0!==o?o:n.cacheSize),sizeCalculation:e=>{var t;return null!==(t=e.byteLength)&&void 0!==t?t:4}}),"bytes"!==e.getResponseHeader("Accept-Ranges")&&console.warn(`Server for ${E} does not advertise 'Accept-Ranges'. If the server supports it, in order to remove this message, add "Accept-Ranges: bytes". Additionally, if using CORS, add "Access-Control-Expose-Headers: *".`),f[c]=s,m=!0},e.send()}catch(e){console.error("xOpen",e)}return m?(o.poke(p,r.SQLITE_OPEN_READONLY,"i32"),r.SQLITE_OK):(console.error("xOpen"),r.SQLITE_CANTOPEN)}};e.vfs.installVfs({io:{struct:d,methods:h},vfs:{struct:p,methods:v}}),e.oo1.DB.dbCtorHelper.setVfsPostOpenSql(p.pointer,(function(e,r){var o;r.capi.sqlite3_busy_timeout(e,null!==(o=null==t?void 0:t.timeout)&&void 0!==o?o:n.timeout),r.capi.sqlite3_exec(e,["PRAGMA journal_mode=DELETE;","PRAGMA cache_size=0;"],0,0,0)}))}(e,t.httpOptions))}))}}},n={};function o(e){var t=n[e];if(void 0!==t)return t.exports;var s=n[e]={exports:{}};return r[e](s,s.exports,o),s.exports}o.m=r,o.x=()=>{var e=o.O(void 0,[842],(()=>o(467)));return o.O(e)},e=[],o.O=(t,r,n,s)=>{if(!r){var i=1/0;for(l=0;l<e.length;l++){for(var[r,n,s]=e[l],a=!0,c=0;c<r.length;c++)(!1&s||i>=s)&&Object.keys(o.O).every((e=>o.O[e](r[c])))?r.splice(c--,1):(a=!1,s<i&&(i=s));if(a){e.splice(l--,1);var u=n();void 0!==u&&(t=u)}}return t}s=s||0;for(var l=e.length;l>0&&e[l-1][2]>s;l--)e[l]=e[l-1];e[l]=[r,n,s]},o.d=(e,t)=>{for(var r in t)o.o(t,r)&&!o.o(e,r)&&Object.defineProperty(e,r,{enumerable:!0,get:t[r]})},o.f={},o.e=e=>Promise.all(Object.keys(o.f).reduce(((t,r)=>(o.f[r](e,t),t)),[])),o.u=e=>e+".bundle.js",o.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(e){if("object"==typeof window)return window}}(),o.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),o.r=e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},(()=>{var e;o.g.importScripts&&(e=o.g.location+"");var t=o.g.document;if(!e&&t&&(t.currentScript&&(e=t.currentScript.src),!e)){var r=t.getElementsByTagName("script");r.length&&(e=r[r.length-1].src)}if(!e)throw new Error("Automatic publicPath is not supported in this browser");e=e.replace(/#.*$/,"").replace(/\?.*$/,"").replace(/\/[^\/]+$/,"/"),o.p=e})(),(()=>{o.b=self.location+"";var e={467:1};o.f.i=(t,r)=>{e[t]||importScripts(o.p+o.u(t))};var t=self.webpackChunksqlite_wasm_http=self.webpackChunksqlite_wasm_http||[],r=t.push.bind(t);t.push=t=>{var[n,s,i]=t;for(var a in s)o.o(s,a)&&(o.m[a]=s[a]);for(i&&i(o);n.length;)e[n.pop()]=1;r(t)}})(),t=o.x,o.x=()=>o.e(842).then(t),o.x()})();
//# sourceMappingURL=467.bundle.js.map