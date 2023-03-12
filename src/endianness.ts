// Procedures for changing the byte sex
// SQLite is always Big-Endian, JS follows the platform, which is Little-Endian on x86

import { debug } from './vfs-http-types.js';

const swapNeeded = (function () {
  const ab = new ArrayBuffer(2);
  const u8 = new Uint8Array(ab);
  const u16 = new Uint16Array(ab);
  u8[0] = 0xF0;
  u8[1] = 0x0D;
  // Big
  if (u16[0] == 0xF00D) {
    debug['threads']('System is Big-Endian');
    return false;
  }
  // Little
  if (u16[0] == 0x0DF0) {
    debug['threads']('System is Little-Endian');
    return true;
  }
  throw new Error(`Failed determining endianness: ${u16}`);
})();

export function ntoh16(data) {
  if (swapNeeded) {
    for (let i = 0; i < data.length; i++) {
      data[i] = ((data[i] & 0xFF00) >> 8) | ((data[i] & 0x00FF) << 8);
    }
  }
}
