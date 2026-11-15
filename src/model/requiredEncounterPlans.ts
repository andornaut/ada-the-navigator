import { FRIGATE_ESCORT_ROLE, requiredFrigateEscortId } from "./frigateEscorts.ts";
import { escortPackId } from "./geography.ts";
import type {
  AnyRequiredEncounterPlan,
  FlightState,
  GalaxyProgress,
  RequiredEncounterPlan,
  SpaceObject,
  Vec,
} from "./types.ts";

/** Existing canonical coordinates always win over a later planning proposal. */
export function rememberRequiredSite(progress: GalaxyProgress, id: string, point: Vec): Vec {
  if (
    !id ||
    ["__proto__", "prototype", "constructor"].includes(id) ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  ) {
    throw new RangeError("Invalid required site");
  }
  const sites = (progress.requiredSites ??= {});
  if (!Object.hasOwn(sites, id)) {
    sites[id] = { x: point.x, y: point.y };
  }
  return sites[id]!;
}

export function readRequiredPlan(flight: FlightState, id: string): RequiredEncounterPlan | null {
  const plan =
    flight.requiredPlans && Object.hasOwn(flight.requiredPlans, id)
      ? flight.requiredPlans[id]
      : undefined;
  return plan && !("role" in plan) ? plan : null;
}

/** Identity and role constraints shared by the trusted writer and the save boundary. */
export function requiredPlanConsistent(plan: RequiredEncounterPlan): boolean {
  const { leader, site, support } = plan;
  const ids = [site.id, leader.id, ...support.map(({ id }) => id)];
  return (
    site.kind === "destination" &&
    site.hp > 0 &&
    leader.kind === "enemy" &&
    leader.hp > 0 &&
    leader.enemy?.hp !== undefined &&
    leader.enemy.hp > 0 &&
    leader.enemy.archetype === "frigate" &&
    leader.enemy.escortOf === null &&
    leader.enemy.packId === null &&
    leader.persistent === true &&
    leader.routeId === site.id &&
    leader.id === `route:${site.id}` &&
    !leader.enemy.salvaged &&
    !leader.enemy.disabled &&
    support.length <= 2 &&
    new Set(ids).size === ids.length &&
    support.every(
      (actor) =>
        actor.kind === "enemy" &&
        actor.hp > 0 &&
        actor.enemy?.archetype === "fighter" &&
        actor.enemy.hp > 0 &&
        !actor.enemy.salvaged &&
        actor.enemy.escortOf === leader.id &&
        actor.enemy.packId === escortPackId(leader.id) &&
        actor.role === FRIGATE_ESCORT_ROLE &&
        actor.persistent === true &&
        actor.routeId === undefined &&
        [0, 1].some((index) => actor.id === requiredFrigateEscortId(leader.id, index)),
    )
  );
}

/** Store exact full states without exposing them to active-world or knowledge consumers. */
export function storeRequiredPlan(
  progress: GalaxyProgress,
  flight: FlightState,
  plan: RequiredEncounterPlan,
): RequiredEncounterPlan {
  const existing = readRequiredPlan(flight, plan.site.id);
  if (existing) {
    return existing;
  }
  if (!requiredPlanConsistent(plan)) {
    throw new RangeError("Invalid required encounter plan");
  }
  const ids = new Set([plan.site.id, plan.leader.id, ...plan.support.map(({ id }) => id)]);
  const pending = Object.values(flight.requiredPlans ?? {}).flatMap(requiredPlanObjects);
  if (
    flight.combat?.routeEncounters.includes(plan.site.id) ||
    [...flight.objects, ...pending].some(({ id }) => ids.has(id)) ||
    [...ids].some((id) => Object.hasOwn(flight.world.notables, id))
  ) {
    throw new RangeError("Required encounter already owned");
  }
  const point = rememberRequiredSite(progress, plan.site.id, plan.site);
  if (point.x !== plan.site.x || point.y !== plan.site.y) {
    throw new RangeError("Required site coordinate mismatch");
  }
  const stored = structuredClone(plan);
  (flight.requiredPlans ??= {})[plan.site.id] = stored;
  return stored;
}

/** The materialization caller transfers these same objects and initializes existing pack ledgers. */
export function takeRequiredPlan(flight: FlightState, id: string): RequiredEncounterPlan | null {
  const plan = readRequiredPlan(flight, id);
  if (plan) {
    delete flight.requiredPlans![id];
  }
  return plan;
}

/** One actor view for typed role plans and the existing Sunflower formation schema. */
export function requiredPlanActors(plan: AnyRequiredEncounterPlan): readonly SpaceObject[] {
  return "role" in plan ? plan.actors : [plan.leader, ...plan.support];
}

/** Full-state ownership includes the site without assigning it enemy or route semantics. */
export function requiredPlanObjects(plan: AnyRequiredEncounterPlan): SpaceObject[] {
  return [plan.site, ...requiredPlanActors(plan)];
}
