import { ROUTE_POSITION } from "../../data/galaxies.ts";
import type { GameContent } from "../../data/types.ts";
import { BEAM, type WeaponDefinition } from "../../data/weaponCatalog.ts";
import { type Parts, rayCircle } from "../convex.ts";
import { enemyHull, enemyPartOutline } from "../enemyBody.ts";
import { MINE_PARTS } from "../mineShape.ts";
import { playerWeaponCoverage, type PlayerWeaponCoverageContext } from "../playerWeaponCoverage.ts";
import { direction } from "../shipPhysics.ts";
import type { FlightEvent, FlightState, SpaceObject, Vec } from "../types.ts";
import { flightWorldContext, worldPoint } from "../world/index.ts";
import { beamPoint, outlineBeamStrike, sceneryEntry } from "./beamContact.ts";
import { liveParts, partReach } from "./enemyHitGeometry.ts";
import { recordBeamFlash } from "./impactFeedback.ts";
import { armed } from "./mines.ts";
import { projectileContact } from "./projectileContact.ts";
import type { SceneryResolution } from "./sceneryResolution.ts";

interface PlayerBeamContact {
  readonly hit: (
    content: GameContent,
    amount: number,
    part: string | null,
    object: SpaceObject,
    flight: FlightState,
    events: FlightEvent[],
  ) => void;
  readonly scenery: SceneryResolution;
}

const length = (v: Vec) => Math.hypot(v.x, v.y);

export function fireBeam(
  { hit, scenery: projectileScenery }: PlayerBeamContact,
  coverage: PlayerWeaponCoverageContext,
  content: GameContent,
  definition: WeaponDefinition,
  aim: Vec,
  origin: Vec,
  flight: FlightState,
  events: FlightEvent[],
): void {
  const { drawnOf, frameOf, kinds: SCENERY } = projectileScenery;
  const span = length(aim);
  const range = playerWeaponCoverage(coverage, { direction: aim, origin });
  if (!span || range <= 0) {
    return;
  }
  const heading = { x: aim.x / span, y: aim.y / span };
  const world = flightWorldContext(flight);
  const halfWidth = BEAM.halfWidth;
  type Contact = { at: number; part: string | null; point: Vec };
  const line = { halfWidth, heading, origin, range };
  const outlineStrike = (center: Vec, outline: Parts) =>
    outlineBeamStrike(line, worldPoint(world, origin, center), outline);
  const circleStrike = (center: Vec, radius: number) => {
    const image = worldPoint(world, origin, center);
    const at = rayCircle(origin, heading, range, image, radius + halfWidth);
    if (at === null) {
      return null;
    }
    const point = beamPoint(origin, heading, at);
    const normal = { x: point.x - image.x, y: point.y - image.y };
    return { at, point: beamPoint(image, length(normal) ? direction(normal) : heading, radius) };
  };
  const strikes: (Contact & { object: SpaceObject })[] = [];
  for (const object of flight.objects) {
    if (object.hp <= 0) {
      continue;
    }
    if (SCENERY.includes(object.kind)) {
      const at = sceneryEntry(
        flight,
        origin,
        heading,
        range,
        frameOf(flight, object),
        drawnOf(flight, object),
        object,
      );
      if (at !== null) {
        const sample = beamPoint(origin, heading, at);
        const point = projectileContact(projectileScenery, flight, object, sample, halfWidth);
        strikes.push({ at, object, part: null, point });
      }
    } else if (object.kind === "enemy" && object.enemy && !object.enemy.salvaged) {
      const position = ROUTE_POSITION[flight.galaxy];
      const hull = enemyHull(object.enemy, position);
      const body = hull ? outlineStrike(object, hull) : circleStrike(object, object.radius);
      let first: Contact | null = body && { ...body, part: null };
      for (const part of liveParts(content, flight.galaxy, object)) {
        const outline = enemyPartOutline(position, object.enemy, part.id);
        const strike = outline
          ? outlineStrike(object, outline)
          : circleStrike(part, partReach(content));
        // A live hardpoint wins a tie with its hull, as for the original beam.
        if (
          strike &&
          (!first || strike.at < first.at || (strike.at === first.at && first.part === null))
        ) {
          first = { ...strike, part: part.id };
        }
      }
      if (first) {
        strikes.push({ ...first, object });
      }
    }
  }
  const impacts = [];
  for (const mine of flight.mines) {
    const strike = armed(mine) && outlineStrike(mine, MINE_PARTS);
    if (strike) {
      mine.end = { age: 0, kind: "pop" };
      impacts.push({ ...strike.point, targetId: mine.id });
    }
  }
  const amount = content.tuning.flight.playerShotDamage * definition.damageRatio;
  for (const strike of strikes.sort((a, b) => a.at - b.at)) {
    impacts.push({ ...strike.point, targetId: strike.object.id });
    hit(content, amount, strike.part, strike.object, flight, events);
  }
  recordBeamFlash(flight, {
    age: 0,
    from: origin,
    impacts,
    to: beamPoint(origin, heading, range),
  });
}
