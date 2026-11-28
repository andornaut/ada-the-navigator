import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import type { GameContent } from "../data/types.ts";
import { createEnemy } from "./ai/index.ts";
import { liveEnemy } from "./geography.ts";
import { readPendingPhantomEncounter } from "./phantomRequiredPlans.ts";
import { requiredWorldOccupantsPopulation } from "./requiredWorldReservations.ts";
import type { FlightState, SpaceObject } from "./types.ts";

/** Current authored membership and its installed followers share one full-state geometry view. */
export function phantomRequiredActors(flight: FlightState): readonly SpaceObject[] {
  const state = flight.galaxy === 6 ? flight.phantom : undefined;
  if (!state) {
    return [];
  }
  const pending = readPendingPhantomEncounter(flight)?.actors ?? [];
  const ids = new Set([
    ...(state.phase === "salvaged" ? [PHANTOM_FLAGSHIP] : []),
    ...state.enemyIds,
    ...Object.values(state.blockades).flat(),
    ...pending.map(({ id }) => id),
  ]);
  return requiredWorldOccupantsPopulation(flight, pending).filter(
    (actor) =>
      (liveEnemy(actor) ||
        (state.phase === "salvaged" && actor.id === PHANTOM_FLAGSHIP && actor.hp > 0)) &&
      (ids.has(actor.id) ||
        (actor.enemy?.escortOf !== null && ids.has(actor.enemy?.escortOf ?? ""))),
  );
}

/** Optional generation cannot precede a still-required next phase's concrete reservation. */
export function nextPhantomBatchReserved(flight: FlightState): boolean {
  const state = flight.galaxy === 6 ? flight.phantom : undefined;
  return (
    !state ||
    state.phase === "flagship" ||
    state.phase === "salvaged" ||
    readPendingPhantomEncounter(flight) !== null
  );
}

const fixedGeometry = new WeakMap<
  FlightState,
  {
    content: GameContent;
    point: { x: number; y: number };
    radius: number;
    body: SpaceObject;
  }
>();

/** The authored fixed waypoint reserves geometry, never actor ownership, population or knowledge. */
export function phantomFutureFlagshipGeometry(
  content: GameContent,
  flight: FlightState,
): readonly SpaceObject[] {
  const state = flight.galaxy === 6 ? flight.phantom : undefined;
  if (
    !state ||
    state.phase === "flagship" ||
    state.phase === "salvaged" ||
    readPendingPhantomEncounter(flight)?.kind === "flagship"
  ) {
    return [];
  }
  const point = state.waypoint;
  const cached = fixedGeometry.get(flight);
  if (
    cached?.content === content &&
    cached.radius === content.tuning.flight.shipRadius &&
    cached.point.x === point.x &&
    cached.point.y === point.y
  ) {
    return [cached.body];
  }
  // Shared weapon levels change bolts rather than this fixed actor's assembled geometry.
  const definition = enemyActorDefinition(6, "capital", PHANTOM_FLAGSHIP, 1);
  const enemy = createEnemy(
    definition,
    {
      archetype: "capital",
      id: PHANTOM_FLAGSHIP,
      packId: null,
      phase: 0,
      weaponLevel: 1,
    },
    { x: point.x, y: point.y },
  );
  const body: SpaceObject = {
    enemy,
    hp: definition.hp,
    id: PHANTOM_FLAGSHIP,
    kind: "enemy",
    radius: definition.sizeRatio * content.tuning.flight.shipRadius,
    x: point.x,
    y: point.y,
  };
  fixedGeometry.set(flight, {
    body,
    content,
    point: { x: point.x, y: point.y },
    radius: content.tuning.flight.shipRadius,
  });
  return [body];
}
