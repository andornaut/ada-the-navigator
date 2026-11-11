import { CALF } from "../data/activities.ts";
import { CURRENTS } from "../data/galaxy-features.ts";
import type { SectorId } from "../data/types.ts";
import { flowAt, inCurrent } from "./currents.ts";
import { dropRandom } from "./drops.ts";
import type { GuidedCalf, Vec } from "./types.ts";

// Guide a calf (gameplay/quests.md "Repeatable activities"): a whale calf waits at a seeded spot
// across a current from its family, follows Ada while she stays close, drifts with currents and
// completes the guide once it is home. Drones ignore it and it takes no damage: it is no flight
// object, only this state beside the flight.

const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** Whether the straight line between two points crosses a current's band. */
export function crossesCurrent(sector: SectorId, from: Vec, to: Vec): boolean {
  const step = CURRENTS.width[0] / 2;
  const count = Math.ceil(distance(from, to) / step);
  for (let index = 0; index <= count; index++) {
    const t = index / count;
    if (
      inCurrent(sector, 0, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
    ) {
      return true;
    }
  }
  return false;
}

/**
 * The next guide's calf start as an offset from the family: chosen by the galaxy and its count
 * of guides, 5000 to 8000 away with the line home crossing a current. Null when no tried spot
 * qualifies for the family where it is this flight.
 */
export function calfStart(sector: SectorId, family: Vec, guides: number): Vec | null {
  const next = dropRandom(guides, `calf:${sector}`);
  const [near, far] = CALF.distance;
  for (let attempt = 0; attempt < CALF.tries; attempt++) {
    const reach = near + next() * (far - near);
    const angle = next() * Math.PI * 2;
    const offset = { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
    if (crossesCurrent(sector, { x: family.x + offset.x, y: family.y + offset.y }, family)) {
      return offset;
    }
  }
  return null;
}

/** A calf waiting at its start, the family's position plus its offset. */
export function placedCalf(family: Vec, start: Vec): GuidedCalf {
  return {
    following: false,
    velocity: { x: 0, y: 0 },
    x: family.x + start.x,
    y: family.y + start.y,
  };
}

/** The midpoint of the calf's straight line home, where its hunter pack waits. */
export function calfRouteMidpoint(family: Vec, start: Vec): Vec {
  return { x: family.x + start.x / 2, y: family.y + start.y / 2 };
}

/**
 * One step of the calf: a waiting calf follows once Ada is within `follow` and a following one
 * waits beyond `release`. Following, it closes on a point `stop` short of Ada at up to
 * `speedFraction` of her base top speed, gathering and shedding speed over her acceleration
 * time; waiting, it slows to rest. It drifts with the currents as Ada does.
 */
export function stepCalf(
  sector: SectorId,
  ship: { readonly accelerationSeconds: number; readonly maxSpeed: number },
  dt: number,
  player: Vec,
  calf: GuidedCalf,
): void {
  const gap = distance(calf, player);
  if (!calf.following && gap <= CALF.follow) {
    calf.following = true;
  } else if (calf.following && gap > CALF.release) {
    calf.following = false;
  }
  const cap = CALF.speedFraction * ship.maxSpeed;
  let desired = { x: 0, y: 0 };
  if (calf.following && gap > CALF.stop) {
    // Arrives at the stop point without overshooting: speed falls off over the last second.
    const speed = Math.min(cap, gap - CALF.stop);
    desired = { x: ((player.x - calf.x) / gap) * speed, y: ((player.y - calf.y) / gap) * speed };
  }
  const change = { x: desired.x - calf.velocity.x, y: desired.y - calf.velocity.y };
  const most = (cap / ship.accelerationSeconds) * dt;
  const size = Math.hypot(change.x, change.y);
  const scale = size > most ? most / size : 1;
  calf.velocity = { x: calf.velocity.x + change.x * scale, y: calf.velocity.y + change.y * scale };
  const drift = flowAt(sector, calf);
  calf.x += (calf.velocity.x + drift.x) * dt;
  calf.y += (calf.velocity.y + drift.y) * dt;
}

/** Whether the calf is home: within `home` of its family. */
export function calfHome(family: Vec, calf: Vec): boolean {
  return distance(calf, family) <= CALF.home;
}
