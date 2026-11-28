import { MINE_LAYER } from "../../data/enemyCatalog.ts";
import type { GameContent } from "../../data/types.ts";
import { MISSILE_HIT_RADIUS } from "../../data/weaponCatalog.ts";
import type { FireIntent } from "../ai/index.ts";
import { outlineContact, type Parts } from "../convex.ts";
import { MINE_PARTS, MINE_REACH, mineTouches } from "../mineShape.ts";
import { needleChannelContains } from "../needleFlight.ts";
import { impactSurface } from "../projectileImpact.ts";
import { shipBody } from "../shipBody.ts";
import type { FlightEvent, FlightState, Mine, Shot, Vec } from "../types.ts";
import { flightWorldContext, worldPoint } from "../world/index.ts";

interface MineStrike {
  readonly blast: (
    content: GameContent,
    amount: number,
    radius: number,
    at: Vec,
    struck: null,
    flight: FlightState,
    events: FlightEvent[],
  ) => void;
  readonly shotParts: Parts;
  readonly shotRadius: (shot: Shot) => number;
}

/** Lays a mine where the mine layer fires, unless its ship already has its most out. */
export function layMine(
  damage: number,
  fire: Pick<FireIntent, "delay" | "origin">,
  ownerId: string,
  flight: FlightState,
): void {
  const out = flight.mines.filter((mine) => mine.ownerId === ownerId && !mine.end).length;
  if (
    out >= MINE_LAYER.count ||
    needleChannelContains({ radius: MINE_CHANNEL_REACH }, flight, fire.origin)
  ) {
    return;
  }
  flight.mines.push({
    age: -fire.delay,
    damage,
    id: `mine:${flight.nextId++}`,
    ownerId,
    x: fire.origin.x,
    y: fire.origin.y,
  });
}

/** How long a mine's fizzle and pop play (art/weapons.md "Mine"). */
const MINE_END_SECONDS = { fizzle: 0.2, pop: 0.22 } as const;
// The inverse isometric projection stretches a screen-space radius by at most sqrt(2).
const MINE_CHANNEL_REACH = Math.SQRT2 * MINE_REACH;

/** Whether a mine still collides: laid, and neither fizzling nor popped. */
export function armed(mine: Mine): boolean {
  return mine.end === undefined && mine.age >= 0;
}

/**
 * Ages each mine: one touching Ada's drawn ship pops and damages her; one past its life fizzles,
 * harmless. Each goes once its fizzle or pop has played.
 */
export function stepMines(
  damage: (amount: number, flight: FlightState) => void,
  dt: number,
  flight: FlightState,
): void {
  const body = shipBody(flight.facing);
  flight.mines = flight.mines.filter(
    (mine) => !needleChannelContains({ radius: MINE_CHANNEL_REACH }, flight, mine),
  );
  for (const mine of flight.mines) {
    mine.age += dt;
    if (mine.end) {
      mine.end.age += dt;
    } else if (mine.age >= MINE_LAYER.lifeSeconds) {
      mine.end = { age: mine.age - MINE_LAYER.lifeSeconds, kind: "fizzle" };
    } else if (
      armed(mine) &&
      mineTouches(mine, body, worldPoint(flightWorldContext(flight), mine, flight.player))
    ) {
      damage(mine.damage, flight);
      mine.end = { age: 0, kind: "pop" };
    }
  }
  flight.mines = flight.mines.filter(
    (mine) => !mine.end || mine.end.age < MINE_END_SECONDS[mine.end.kind],
  );
}

/** Ada's shot pops each armed mine it touches that it has not; true once the shot is spent. */
export function strikeMines(
  { blast, shotParts, shotRadius }: MineStrike,
  content: GameContent,
  shot: Shot,
  flight: FlightState,
  events: FlightEvent[],
): boolean {
  for (const mine of flight.mines) {
    if (
      armed(mine) &&
      !shot.hitIds.includes(mine.id) &&
      (shot.projectile === "missile"
        ? outlineContact(
            MINE_PARTS,
            mine,
            worldPoint(flightWorldContext(flight), mine, shot),
            MISSILE_HIT_RADIUS,
          ) !== null
        : mineTouches(mine, shotParts, worldPoint(flightWorldContext(flight), mine, shot)))
    ) {
      shot.hitIds.push(mine.id);
      mine.end = { age: 0, kind: "pop" };
      if (shot.blast !== undefined) {
        const contact = outlineContact(
          MINE_PARTS,
          mine,
          worldPoint(flightWorldContext(flight), mine, shot),
          shotRadius(shot),
        );
        const at = contact
          ? impactSurface({ contact, projected: false, radius: shotRadius(shot) }, shot)
          : shot;
        blast(content, shot.damage, shot.blast, at, null, flight, events);
      }
      if (!shot.piercing) {
        shot.life = 0;
        return true;
      }
    }
  }
  return false;
}
