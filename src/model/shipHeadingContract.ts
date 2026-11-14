/** Ada's visual heading samples. Enemy craft retain their independent heading count. */
export const SHIP_HEADINGS = 64;
export const SHIP_HEADING_VERSION = 2;

/** Player heading metadata is independent of the generic jet geometry encoding version. */
export interface ShipHeadingContract {
  readonly count: typeof SHIP_HEADINGS;
  readonly version: typeof SHIP_HEADING_VERSION;
}

export const SHIP_HEADING_CONTRACT: ShipHeadingContract = {
  count: SHIP_HEADINGS,
  version: SHIP_HEADING_VERSION,
};

/** Rejects stale or mismatched player metadata before interpreting direction indices. */
export function readShipHeadingContract(value: unknown): ShipHeadingContract | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return record.count === SHIP_HEADINGS && record.version === SHIP_HEADING_VERSION
    ? SHIP_HEADING_CONTRACT
    : undefined;
}
