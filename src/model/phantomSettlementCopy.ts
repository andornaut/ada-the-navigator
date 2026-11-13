import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";

/** Copy follows liberation order; the destination id remains the actual outcome target. */
export function phantomSettlementCopy(freed: readonly string[], id: string): string | null {
  const known = (value: string) =>
    PHANTOM_DESTINATIONS.some((destination) => destination === value);
  if (!known(id) || new Set(freed).size !== freed.length || !freed.every(known)) {
    return null;
  }
  const previous = freed.indexOf(id);
  return PHANTOM_DESTINATIONS[previous < 0 ? freed.length : previous] ?? null;
}
