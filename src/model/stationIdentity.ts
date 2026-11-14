import { STATION_NAME_WORDS } from "../data/stationCopy.ts";

const zigzag = (value: bigint): bigint => (value < 0n ? -2n * value - 1n : 2n * value);
const pair = (left: bigint, right: bigint): bigint =>
  ((left + right) * (left + right + 1n)) / 2n + right;

function identityNumber(id: string): bigint {
  const match = /^station:(infill:)?(-?(?:0|[1-9]\d*)),(-?(?:0|[1-9]\d*))$/.exec(id);
  if (match && match[2] !== "-0" && match[3] !== "-0") {
    const cell = pair(zigzag(BigInt(match[2]!)), zigzag(BigInt(match[3]!)));
    return 2n * pair(cell, match[1] ? 1n : 0n);
  }
  // Odd values reserve a separate namespace for complete unknown identity encodings.
  let value = 1n;
  for (const byte of new TextEncoder().encode(id)) {
    value = (value << 8n) | BigInt(byte);
  }
  return 2n * value + 1n;
}

/** Compact full identity encoding includes layer and signed coordinates without allocation. */
export function stationWords(id: string): string {
  return identityWords(identityNumber(id));
}

/** The shared nonnegative integer alphabet used for stable place identity labels. */
export function identityWords(value: bigint): string {
  if (value < 0n) {
    throw new RangeError("Negative word identity");
  }
  return value
    .toString(16)
    .split("")
    .map((digit) => STATION_NAME_WORDS[Number.parseInt(digit, 16)]!)
    .join(" ");
}

/** Named story places retain their labels; callers use this only for procedural stations. */
export function stationDisplayName(galaxyName: string, id: string): string {
  return `${galaxyName} ${stationWords(id)} Station`;
}
