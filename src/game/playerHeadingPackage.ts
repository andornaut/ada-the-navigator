import { readShipHeadingContract, SHIP_HEADINGS } from "../model/shipHeadingContract.ts";

/** Validates every declared directional player frame group before loading a player art package. */
export function hasPlayerHeadingPackage(paints: readonly string[], value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const root = value as Record<string, unknown>;
  if (
    root.version !== 1 ||
    !readShipHeadingContract(root.shipHeadings) ||
    !Array.isArray(root.assets)
  ) {
    return false;
  }
  const groups = new Map<string, Set<number>>();
  for (const asset of root.assets as unknown[]) {
    if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
      return false;
    }
    const frame = asset as Record<string, unknown>;
    if (typeof frame.id !== "string") {
      return false;
    }
    const match = /^ship-(?:([a-z][a-z0-9-]*)-)?(\d+)$/u.exec(frame.id);
    if (!match) {
      continue;
    }
    const group = match[1] ?? "idle";
    const index = frame.directionIndex;
    if (
      !Number.isInteger(index) ||
      (index as number) < 0 ||
      (index as number) >= SHIP_HEADINGS ||
      Number(match[2]) !== index ||
      (group === "idle" || group === "thrust" ? frame.paint !== undefined : frame.paint !== group)
    ) {
      return false;
    }
    const indices = groups.get(group) ?? new Set<number>();
    if (indices.has(index as number)) {
      return false;
    }
    indices.add(index as number);
    groups.set(group, indices);
  }
  const required = ["idle", "thrust", ...paints];
  return (
    groups.size === required.length &&
    required.every((group) => groups.get(group)?.size === SHIP_HEADINGS)
  );
}
