import type { ExplorationRenewal } from "./explorationRenewal.ts";
import { worldGrid } from "./worldCells.ts";
import { canonicalCell } from "./worldGeometry.ts";

export interface ExplorationState {
  version: 1;
  renewals: Record<string, ExplorationRenewal>;
}

export interface ExplorationStateContext {
  readonly worldSide: number;
  readonly chunkSize: number;
  readonly validRoleId: (id: string) => boolean;
}

function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(value).every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      return typeof key === "string" && Object.hasOwn(descriptor, "value");
    })
  );
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const found = Reflect.ownKeys(value);
  return found.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Saved renewal roles and footprints must already have their canonical identities. */
export function validExplorationState(
  context: ExplorationStateContext,
  value: unknown,
): value is ExplorationState {
  if (
    !record(value) ||
    !exact(value, ["version", "renewals"]) ||
    value.version !== 1 ||
    !record(value.renewals)
  ) {
    return false;
  }
  let period: number;
  try {
    period = worldGrid(context, context.chunkSize).periodCells!;
    if (!Number.isSafeInteger(period) || period < 1) {
      return false;
    }
  } catch {
    return false;
  }
  const renewals = value.renewals;
  return Object.getOwnPropertyNames(renewals).every((id) => {
    const renewal = renewals[id];
    if (
      !context.validRoleId(id) ||
      !record(renewal) ||
      !exact(renewal, ["footprint", "departed", "seconds", "distance"]) ||
      !record(renewal.footprint) ||
      !exact(renewal.footprint, ["x", "y"]) ||
      typeof renewal.departed !== "boolean" ||
      !nonnegative(renewal.seconds) ||
      !nonnegative(renewal.distance) ||
      (!renewal.departed && (renewal.seconds !== 0 || renewal.distance !== 0))
    ) {
      return false;
    }
    const { x, y } = renewal.footprint;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y)
    ) {
      return false;
    }
    const canonical = canonicalCell(period, { x, y });
    return Object.is(canonical.x, x) && Object.is(canonical.y, y);
  });
}
