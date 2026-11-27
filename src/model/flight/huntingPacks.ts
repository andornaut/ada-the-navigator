import { HUNTING_PACKS } from "../../data/galaxyFeatures.ts";
import type { GameContent } from "../../data/types.ts";
import { flightWorldContext } from "../flightTopology.ts";
import { worldActivateFlightRegion } from "../geography.ts";
import type { FlightState, SpaceObject, Vec } from "../types.ts";
import { worldDistance } from "../worldContacts.ts";

interface HuntingPackContext {
  combat: (flight: FlightState) => NonNullable<FlightState["combat"]>;
  hash: (seed: number, x: number, y: number) => number;
  random: (seed: number) => () => number;
  spawnEnemy: (
    content: GameContent,
    flight: FlightState,
    archetype: typeof HUNTING_PACKS.archetype,
    id: string,
    point: Vec,
    packId: string,
    phase: number,
  ) => SpaceObject;
}

/**
 * A Whirlpool hunting pack of `count` fighters around a centre, kept with the flight. A pack
 * placed again under its id replaces its members.
 */
export function placeHuntingPack(
  { combat, spawnEnemy }: Pick<HuntingPackContext, "combat" | "spawnEnemy">,
  content: GameContent,
  packId: string,
  centre: Vec,
  count: number,
  flight: FlightState,
): void {
  flight.objects = flight.objects.filter(
    (object) => object.kind !== "enemy" || object.enemy?.packId !== packId,
  );
  worldActivateFlightRegion(flightWorldContext(flight), content, centre, flight);
  for (let i = 0; i < count; i++) {
    const phase = (i * Math.PI * 2) / count;
    const member = spawnEnemy(
      content,
      flight,
      HUNTING_PACKS.archetype,
      `${packId}:${i}`,
      {
        x: centre.x + Math.cos(phase) * HUNTING_PACKS.spread,
        y: centre.y + Math.sin(phase) * HUNTING_PACKS.spread,
      },
      packId,
      phase,
    );
    member.persistent = true;
    flight.objects.push(member);
  }
  combat(flight).initialPackSizes[packId] = count;
}

/**
 * Places a hunting pack near each whale destination within `placeRange` of Ada, once per
 * flight: hunters on a seeded side of the destination, or its far side when that side holds
 * the route guard. Members are retained like route guards and chase as one pack.
 */
export function ensureHuntingPacks(
  context: HuntingPackContext,
  content: GameContent,
  flight: FlightState,
): void {
  const { combat, hash, random } = context;
  if (!HUNTING_PACKS.galaxies.includes(flight.galaxy)) {
    return;
  }
  const placed = (combat(flight).huntingPacks ??= []);
  for (const destination of flight.objects.filter(
    (object) =>
      object.kind === "destination" &&
      HUNTING_PACKS.destinations.includes(object.id) &&
      !placed.includes(object.id) &&
      worldDistance(flightWorldContext(flight), object, flight.player) <= HUNTING_PACKS.placeRange,
  )) {
    const next = random(
      hash(flight.seed ^ 0x4a7e, destination.id.length, destination.id.charCodeAt(0)),
    );
    const [fewest, most] = HUNTING_PACKS.count;
    const count = fewest + Math.floor(next() * (most - fewest + 1));
    let angle = next() * Math.PI * 2;
    const at = (turn: number) => ({
      x: destination.x + Math.cos(turn) * HUNTING_PACKS.distance,
      y: destination.y + Math.sin(turn) * HUNTING_PACKS.distance,
    });
    const guard = flight.objects.find(
      (object) => object.kind === "enemy" && object.routeId === destination.id,
    );
    if (
      guard &&
      worldDistance(flightWorldContext(flight), guard, at(angle)) < HUNTING_PACKS.guardGap
    ) {
      angle += Math.PI;
    }
    placeHuntingPack(context, content, `hunt:${destination.id}`, at(angle), count, flight);
    placed.push(destination.id);
  }
}
