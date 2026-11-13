import { STATION_NAME_WORDS } from "../data/stationCopy.ts";

/** Full identity encoding includes placement namespaces, without discovery-order allocation. */
export function stationWords(id: string): string {
  // A leading byte preserves leading zero bytes and distinguishes every encoded length.
  let value = 1n;
  for (const byte of new TextEncoder().encode(id)) {
    value = (value << 8n) | BigInt(byte);
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
