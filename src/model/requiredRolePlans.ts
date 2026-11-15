import { FRIGATE_ESCORT_COUNT } from "../data/enemyCatalog.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { FRIGATE_ESCORT_ROLE, requiredFrigateEscortId } from "./frigateEscorts.ts";
import { escortPackId } from "./geography.ts";
import { rememberRequiredSite, requiredPlanObjects } from "./requiredEncounterPlans.ts";
import type {
  FlightState,
  GalaxyProgress,
  RequiredRoleEncounterPlan,
  SpaceObject,
} from "./types.ts";

function pendingActor(actor: SpaceObject): boolean {
  return (
    actor.kind === "enemy" &&
    actor.hp > 0 &&
    actor.enemy !== undefined &&
    actor.enemy.id === actor.id &&
    actor.enemy.hp > 0 &&
    !actor.enemy.disabled &&
    !actor.enemy.salvaged
  );
}

/** Only the existing G3 capital routes and authored holodisk formation belong to this port. */
export function requiredRolePlanConsistent(
  galaxy: number,
  plan: RequiredRoleEncounterPlan,
): boolean {
  if (
    galaxy !== 3 ||
    plan.site.kind !== "destination" ||
    plan.site.hp <= 0 ||
    !plan.actors.length ||
    !plan.actors.every(pendingActor)
  ) {
    return false;
  }
  const [leader] = plan.actors;
  if (
    !leader?.enemy ||
    leader.id !== `route:${plan.site.id}` ||
    leader.routeId !== plan.site.id ||
    leader.enemy.escortOf !== null ||
    leader.enemy.packId !== null ||
    new Set(requiredPlanObjects(plan).map(({ id }) => id)).size !== plan.actors.length + 1
  ) {
    return false;
  }
  if (plan.role === "whirlpool-capital") {
    return (
      ["whale", "family"].includes(plan.site.id) &&
      plan.actors.length === 1 &&
      leader.enemy.archetype === "capital"
    );
  }
  if (
    plan.role !== "whirlpool-holodisk" ||
    plan.site.id !== "holodisk" ||
    leader.enemy.archetype !== HOLODISKS.guard.leader ||
    plan.actors.length !== 1 + FRIGATE_ESCORT_COUNT + HOLODISKS.guard.packSize
  ) {
    return false;
  }
  const peers = new Map(plan.actors.slice(1).map((actor) => [actor.id, actor]));
  for (let index = 0; index < FRIGATE_ESCORT_COUNT; index++) {
    const actor = peers.get(requiredFrigateEscortId(leader.id, index));
    if (
      !actor?.enemy ||
      actor.enemy.archetype !== "fighter" ||
      actor.enemy.escortOf !== leader.id ||
      actor.enemy.packId !== escortPackId(leader.id) ||
      actor.routeId !== undefined ||
      actor.role !== FRIGATE_ESCORT_ROLE ||
      actor.persistent !== true
    ) {
      return false;
    }
  }
  const pack = "route:holodisk:pack";
  for (let index = 0; index < HOLODISKS.guard.packSize; index++) {
    const actor = peers.get(`${pack}:${index}`);
    if (
      !actor?.enemy ||
      actor.enemy.archetype !== HOLODISKS.guard.pack ||
      actor.enemy.packId !== pack ||
      actor.enemy.escortOf !== null ||
      actor.routeId !== undefined ||
      actor.persistent !== true
    ) {
      return false;
    }
  }
  return true;
}

export function readRequiredRolePlan(
  flight: FlightState,
  id: string,
): RequiredRoleEncounterPlan | null {
  const plan =
    flight.requiredPlans && Object.hasOwn(flight.requiredPlans, id)
      ? flight.requiredPlans[id]
      : undefined;
  return plan && "role" in plan ? plan : null;
}

function unshared(
  progress: GalaxyProgress,
  flight: FlightState,
  plan: RequiredRoleEncounterPlan,
): void {
  if (!requiredRolePlanConsistent(flight.galaxy, plan)) {
    throw new RangeError("Invalid required role plan");
  }
  const ids = new Set(requiredPlanObjects(plan).map(({ id }) => id));
  const others = Object.entries(flight.requiredPlans ?? {}).flatMap(([id, entry]) =>
    id === plan.site.id ? [] : requiredPlanObjects(entry),
  );
  if (
    flight.combat?.routeEncounters.includes(plan.site.id) ||
    [...flight.objects, ...others].some(({ id }) => ids.has(id)) ||
    [...ids].some((id) => Object.hasOwn(flight.world.notables, id)) ||
    [...ids].some((id) => Object.hasOwn(flight.markerActors?.knowledge ?? {}, id))
  ) {
    throw new RangeError("Required role plan already owned");
  }
  const point = progress.requiredSites?.[plan.site.id];
  if (point && (point.x !== plan.site.x || point.y !== plan.site.y)) {
    throw new RangeError("Required site coordinate mismatch");
  }
}

export function storeRequiredRolePlan(
  progress: GalaxyProgress,
  flight: FlightState,
  plan: RequiredRoleEncounterPlan,
): RequiredRoleEncounterPlan {
  const existing = readRequiredRolePlan(flight, plan.site.id);
  if (existing) {
    return existing;
  }
  if (flight.requiredPlans && Object.hasOwn(flight.requiredPlans, plan.site.id)) {
    throw new RangeError("Required role plan already owned");
  }
  unshared(progress, flight, plan);
  rememberRequiredSite(progress, plan.site.id, plan.site);
  const stored = structuredClone(plan);
  (flight.requiredPlans ??= {})[plan.site.id] = stored;
  return stored;
}

/** The caller proves authored eligibility and geometry before this exact ownership transfer. */
export function takeRequiredRolePlan(
  progress: GalaxyProgress,
  flight: FlightState,
  id: string,
): RequiredRoleEncounterPlan | null {
  const plan = readRequiredRolePlan(flight, id);
  if (!plan) {
    return null;
  }
  if (!progress.requiredSites?.[id]) {
    throw new RangeError("Required site coordinate missing");
  }
  unshared(progress, flight, plan);
  delete flight.requiredPlans![id];
  return plan;
}
