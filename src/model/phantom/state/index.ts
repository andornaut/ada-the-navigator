import jumpData from "../../../../public/art/quantum-jump.json" with { type: "json" };
import {
  PHANTOM_DESTINATIONS,
  PHANTOM_FINALE_CHATTER,
  PHANTOM_FLAGSHIP,
  PHANTOM_TUNING as T,
} from "../../../data/phantom.ts";
import type { Vec } from "../../types.ts";
import type { PhantomAlly } from "../allies/index.ts";
import { type PendingPhantomEncounter, validPendingPhantomEncounter } from "../pending/index.ts";

export interface PhantomProgress {
  broken: string[];
  freed: string[];
  flagshipKnown: boolean;
  aftermathComplete?: true;
  surrenderAftermathDue?: true;
}
const PHANTOM_CHATTER = [
  "battleAllies",
  "battleAlone",
  "flagshipAttack",
  "flagshipHardpoint",
  "flagshipDisabled",
  ...PHANTOM_FINALE_CHATTER,
] as const;
export type PhantomChatter = (typeof PHANTOM_CHATTER)[number];

export interface PhantomDeparture extends Vec {
  id: string;
  age: number;
  facing?: Vec;
}
export type PhantomSettlement = (typeof PHANTOM_DESTINATIONS)[number];

export type PhantomBlockadePhase =
  | { readonly phase: "warning"; readonly until: number; readonly withdrawal: Vec }
  | { readonly phase: "fighters"; readonly withdrawal: Vec }
  | {
      readonly phase: "recovery";
      readonly until: number;
      readonly withdrawal: Vec;
      cuePending?: true;
    }
  | { readonly phase: "frigate" }
  | { readonly phase: "clear" };

export interface PhantomFlight {
  /** Absent on old flights, which keep their existing combat and progress. */
  blockadePhases?: Partial<Record<PhantomSettlement, PhantomBlockadePhase>>;
  pendingEncounter?: PendingPhantomEncounter;
  departures?: PhantomDeparture[];
  phase: "blockades" | "approach" | "waves" | "flagship" | "salvaged";
  wave: number;
  enemyIds: string[];
  resolvedIds: string[];
  allyTurn: number;
  blockades: Record<string, string[]>;
  waypoint: Vec;
  allies: PhantomAlly[];
  disabledCued: boolean;
  chatter: PhantomChatter[];
}

export const blockadeFrigate = (site: PhantomSettlement): string => `phantom:blockade:${site}:0:0`;

export function blockadeSite(id: string): id is PhantomSettlement {
  return PHANTOM_DESTINATIONS.some((known) => known === id);
}

export function validPhantomProgress(value: unknown): value is PhantomProgress {
  if (!value || typeof value !== "object") {
    return false;
  }
  const state = value as PhantomProgress;
  const ids = (list: unknown): list is string[] =>
    Array.isArray(list) &&
    new Set(list).size === list.length &&
    list.every((id) => PHANTOM_DESTINATIONS.some((known) => known === id));
  return (
    ids(state.broken) &&
    ids(state.freed) &&
    state.freed.every((id) => state.broken.includes(id)) &&
    (state.surrenderAftermathDue === undefined ||
      (state.surrenderAftermathDue === true &&
        state.aftermathComplete === undefined &&
        state.flagshipKnown)) &&
    (state.aftermathComplete === undefined ||
      (state.aftermathComplete === true &&
        state.flagshipKnown &&
        state.freed.length === PHANTOM_DESTINATIONS.length)) &&
    typeof state.flagshipKnown === "boolean" &&
    (!state.flagshipKnown || state.freed.length === PHANTOM_DESTINATIONS.length)
  );
}
function validBlockadePhases(state: PhantomFlight): boolean {
  const phases = state.blockadePhases;
  if (phases === undefined) {
    return true;
  }
  if (!phases || typeof phases !== "object" || Array.isArray(phases)) {
    return false;
  }
  return Object.entries(phases).every(([id, phase]) => {
    if (
      !blockadeSite(id) ||
      !Object.hasOwn(state.blockades, id) ||
      !phase ||
      typeof phase !== "object"
    ) {
      return false;
    }
    const members = state.blockades[id]!;
    const fightersResolved = () =>
      members.every((actor) => actor === blockadeFrigate(id) || state.resolvedIds.includes(actor));
    const keys = Object.keys(phase).length;
    switch (phase.phase) {
      case "clear":
        return keys === 1 && members.every((actor) => state.resolvedIds.includes(actor));
      case "frigate":
        return keys === 1 && fightersResolved();
      case "warning":
      case "fighters":
      case "recovery": {
        const point = phase.withdrawal;
        if (
          !point ||
          typeof point !== "object" ||
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y)
        ) {
          return false;
        }
        if (phase.phase === "fighters") {
          return keys === 2;
        }
        if (!Number.isFinite(phase.until) || phase.until < 0) {
          return false;
        }
        return phase.phase === "warning"
          ? keys === 3
          : (keys === 3 || (keys === 4 && phase.cuePending === true)) && fightersResolved();
      }
      default:
        return false;
    }
  });
}

/** Chapter-local state is finite and references only its authored encounters. */
export function validPhantomFlight(value: unknown): value is PhantomFlight {
  if (!value || typeof value !== "object") {
    return false;
  }
  const state = value as PhantomFlight;
  const point = (p: unknown): p is Vec =>
    Boolean(p) &&
    typeof p === "object" &&
    Number.isFinite((p as Vec).x) &&
    Number.isFinite((p as Vec).y);
  const id = (value: unknown) =>
    typeof value === "string" &&
    (value === PHANTOM_FLAGSHIP ||
      /^phantom:(blockade:phantomSettlement[123]:[012]|wave:[123]:[01]|flagship:escorts):\d+$/.test(
        value,
      ));
  const ids = (value: unknown): value is string[] =>
    Array.isArray(value) &&
    value.length <= 200 &&
    value.every(id) &&
    new Set(value).size === value.length;
  return (
    ["blockades", "approach", "waves", "flagship", "salvaged"].includes(state.phase) &&
    Number.isInteger(state.wave) &&
    state.wave >= 0 &&
    state.wave <= T.waves &&
    Number.isInteger(state.allyTurn) &&
    state.allyTurn >= 0 &&
    state.allyTurn <= T.waves &&
    (state.departures === undefined ||
      (Array.isArray(state.departures) &&
        state.departures.length <= T.allies * 4 &&
        new Set(state.departures.map((ally) => ally.id)).size === state.departures.length &&
        state.departures.every(
          (ally) =>
            point(ally) &&
            (ally.facing === undefined || point(ally.facing)) &&
            typeof ally.id === "string" &&
            ally.id.length > 0 &&
            ally.id.length <= 100 &&
            Number.isFinite(ally.age) &&
            ally.age >= 0 &&
            ally.age * 1000 < jumpData.durationMs,
        ))) &&
    (state.pendingEncounter === undefined ||
      validPendingPhantomEncounter(state, state.pendingEncounter)) &&
    ids(state.enemyIds) &&
    ids(state.resolvedIds) &&
    point(state.waypoint) &&
    Boolean(state.blockades) &&
    typeof state.blockades === "object" &&
    Object.entries(state.blockades).every(
      ([key, members]) => PHANTOM_DESTINATIONS.some((id) => id === key) && ids(members),
    ) &&
    validBlockadePhases(state) &&
    typeof state.disabledCued === "boolean" &&
    Array.isArray(state.chatter) &&
    state.chatter.length <= 4 &&
    state.chatter.every((key) => PHANTOM_CHATTER.includes(key)) &&
    Array.isArray(state.allies) &&
    state.allies.length <= T.allies &&
    new Set(state.allies.map((ally) => ally.id)).size === state.allies.length &&
    state.allies.every(
      (ally) =>
        point(ally) &&
        point(ally.velocity) &&
        point(ally.facing) &&
        typeof ally.id === "string" &&
        ally.id.length > 0 &&
        ally.id.length <= 100 &&
        Number.isInteger(ally.galaxy) &&
        ally.galaxy >= 1 &&
        ally.galaxy <= 5 &&
        ["escort", "chase", "whale"].includes(ally.behavior) &&
        Number.isFinite(ally.radius) &&
        ally.radius > 0 &&
        Number.isFinite(ally.fireIn) &&
        ally.fireIn >= 0 &&
        Number.isFinite(ally.jumpAge) &&
        ally.jumpAge >= 0 &&
        (ally.song === undefined || typeof ally.song === "boolean"),
    )
  );
}
