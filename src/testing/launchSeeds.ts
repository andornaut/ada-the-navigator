// Test support: one shared deterministic stream for launch-seed consumers.
let launchSeed = 1;

/** Test support: the next launch seed, then a fixed sequence after it. */
export function seedLaunches(seed: number): void {
  launchSeed = seed >>> 0;
}

/** Test support: fills array with the pinned launch seed sequence, one 32-bit value per step. */
export function pinnedRandomValues<T extends ArrayBufferView | null>(array: T): T {
  if (!array) {
    return array;
  }
  const view = new DataView(array.buffer, array.byteOffset, array.byteLength);
  for (let offset = 0; offset < view.byteLength; offset += 4) {
    const value = launchSeed;
    launchSeed = (Math.imul(launchSeed, 1664525) + 1013904223) >>> 0;
    if (offset + 4 <= view.byteLength) {
      view.setUint32(offset, value, true);
    } else {
      for (let byte = offset; byte < view.byteLength; byte++) {
        view.setUint8(byte, (value >>> (8 * (byte - offset))) & 0xff);
      }
    }
  }
  return array;
}
