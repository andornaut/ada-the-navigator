import { ECONOMY } from "../../data/economy.ts";
import type { Vec } from "../../data/types.ts";
import { namesSavedStation, settlementById } from "../stations/index.ts";

export const PATH_HALF_WIDTH = 100;
export const FIRST_RELEASE = 3;
export const LAST_PURSUIT = FIRST_RELEASE + 12;

export interface CourierAmbushPair {
  readonly centre: Vec;
  readonly members: readonly [Vec, Vec];
}

export interface CourierAmbushPlan {
  readonly forward: Vec;
  readonly warning: Vec;
  readonly escape: { readonly from: Vec; readonly to: Vec; readonly halfWidth: number };
  readonly pairs: readonly [CourierAmbushPair, CourierAmbushPair];
}

export type CourierAmbushState =
  | { readonly phase: "armed" }
  | { readonly phase: "warned"; readonly elapsed: number }
  | { readonly phase: "ended" };

export type LegIdentity = { readonly station: string; readonly settlement: string };

/** Store beside the retained story endpoints. Undefined is the only unattempted state. */
export type CourierAmbushAttempt = LegIdentity &
  (
    | { readonly state: { readonly phase: "skipped" } }
    | { readonly plan: CourierAmbushPlan; readonly state: CourierAmbushState }
  );

/** Captured destinations remain stable through Continue and subsequent chapter visits. */
export interface AndromedaProgress {
  station?: string;
  settlement?: string;
  courierAmbush?: CourierAmbushAttempt;
}

/** Only real seeded destination ids enter saved story targets. */
export function validAndromedaProgress(value: unknown): value is AndromedaProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const state = value as Record<string, unknown>;
  return (
    Object.keys(state).every(
      (key) => key === "station" || key === "settlement" || key === "courierAmbush",
    ) &&
    (state.courierAmbush === undefined ||
      (validCourierAmbushAttempt(state.courierAmbush) &&
        state.courierAmbush.station === state.station &&
        state.courierAmbush.settlement === state.settlement)) &&
    (state.station === undefined ||
      (typeof state.station === "string" && namesSavedStation(ECONOMY, 5, state.station))) &&
    (state.settlement === undefined ||
      (typeof state.settlement === "string" && settlementById(ECONOMY, state.settlement) !== null))
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function point(value: unknown): value is Vec {
  return (
    record(value) &&
    [value.x, value.y].every(
      (axis) => typeof axis === "number" && Math.abs(axis) <= Number.MAX_SAFE_INTEGER / 2,
    )
  );
}

/** Store validation keeps malformed phase, timer or marker geometry from acting on Continue. */
export function validCourierAmbushAttempt(value: unknown): value is CourierAmbushAttempt {
  if (
    !record(value) ||
    typeof value.station !== "string" ||
    !value.station ||
    typeof value.settlement !== "string" ||
    !value.settlement ||
    !record(value.state)
  ) {
    return false;
  }
  const { plan, state } = value;
  if (state.phase === "skipped") {
    return plan === undefined;
  }
  if (
    state.phase !== "armed" &&
    state.phase !== "ended" &&
    (state.phase !== "warned" ||
      typeof state.elapsed !== "number" ||
      !Number.isFinite(state.elapsed) ||
      state.elapsed < 0 ||
      state.elapsed >= LAST_PURSUIT)
  ) {
    return false;
  }
  return (
    record(plan) &&
    point(plan.forward) &&
    Math.abs(Math.hypot(plan.forward.x, plan.forward.y) - 1) < 1e-8 &&
    point(plan.warning) &&
    record(plan.escape) &&
    point(plan.escape.from) &&
    point(plan.escape.to) &&
    plan.escape.halfWidth === PATH_HALF_WIDTH &&
    Array.isArray(plan.pairs) &&
    plan.pairs.length === 2 &&
    plan.pairs.every(
      (pair: unknown) =>
        record(pair) &&
        point(pair.centre) &&
        Array.isArray(pair.members) &&
        pair.members.length === 2 &&
        pair.members.every(point),
    )
  );
}
