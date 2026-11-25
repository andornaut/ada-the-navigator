import WHALES from "../../public/art/friendly-whales.json" with { type: "json" };
import { CALF } from "../data/activities.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { PHANTOM_TUNING as T } from "../data/phantom.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { hardpointOffset } from "./enemyAi.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";
export interface PhantomAllySpec {
  id: string;
  galaxy: GalaxyNumber;
  behavior: "escort" | "chase" | "whale";
  song?: boolean;
  radius: number;
}
export interface PhantomAlly extends PhantomAllySpec, Vec {
  velocity: Vec;
  facing: Vec;
  fireIn: number;
  /** Transition age for the existing jump presentation. */
  jumpAge: number;
}
export interface AllyFire {
  from: Vec;
  target: Vec;
  ally: string;
  weapon: "laser";
  level: 2;
}
export interface AllyEligibility {
  galaxy: GalaxyNumber;
  activityCompleted: boolean;
  projects: readonly {
    project: string;
    ally: "chase" | "current" | "escort";
  }[];
}
const gap = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const quests: Partial<Record<GalaxyNumber, Pick<PhantomAllySpec, "id" | "behavior" | "song">>> = {
  1: { behavior: "escort", id: "clover" },
  2: { behavior: "chase", id: "mica" },
  3: { behavior: "whale", id: "marlo", song: true },
  4: { behavior: "escort", id: "reed" },
  5: { behavior: "escort", id: "pip" },
};
/** Eligibility is explicit per galaxy; aggregate historical activity totals do not imply it. */
export function phantomAllyRoster(
  galaxies: readonly AllyEligibility[],
  radius: number,
): PhantomAllySpec[] {
  return galaxies.flatMap(({ activityCompleted, galaxy, projects }) => {
    const quest = quests[galaxy];
    return [
      ...projects.map(({ ally, project }): PhantomAllySpec => ({
        behavior: ally === "current" ? "whale" : ally,
        galaxy,
        id: `project:${galaxy}:${project}`,
        radius,
      })),
      ...(activityCompleted && quest ? [{ ...quest, galaxy, radius }] : []),
    ];
  });
}
/** The first eight slots advance through the roster at each wave boundary. */
export function rotatePhantomAllies(
  roster: readonly PhantomAllySpec[],
  turn: number,
  flight: Pick<FlightState, "player" | "facing">,
): PhantomAlly[] {
  if (!roster.length) {
    return [];
  }
  const count = Math.min(T.allies, roster.length);
  const allies: PhantomAlly[] = Array.from({ length: count }, (_, index) => ({
    ...roster[(turn * T.allies + index) % roster.length]!,
    ...flight.player,
    facing: { x: 0, y: -1 },
    fireIn: 0,
    jumpAge: 0,
    velocity: { x: 0, y: 0 },
  }));
  const restingSlot = phantomAllyFormation(flight, allies);
  for (const ally of allies) {
    Object.assign(ally, restingSlot(ally));
  }
  return allies;
}
/** Equal slots start behind Ada and expand for actual drawn neighbour footprints. */
export function phantomEscortSlot(
  player: Vec,
  heading: Vec,
  hullRadius: number,
  allies: readonly PhantomAlly[],
  index: number,
): Vec {
  const radius = Math.max(...allies.map((ally) => ally.radius), 0);
  const ring = Math.max(
    hullRadius + radius + T.formationGap,
    allies.length > 1 ? (2 * radius + T.neighborGap) / (2 * Math.sin(Math.PI / allies.length)) : 0,
  );
  const angle =
    Math.atan2(heading.y, heading.x) + Math.PI + (index * Math.PI * 2) / Math.max(1, allies.length);
  return { x: player.x + Math.cos(angle) * ring, y: player.y + Math.sin(angle) * ring };
}
/** The whale Art draws for a whale ally (art/allies.md): Marlo, or the nursery's adult. */
export function phantomWhaleKind(ally: Pick<PhantomAllySpec, "id">): "adult" | "whale" {
  return ally.id === "marlo" ? "whale" : "adult";
}

/** A whale kind's drawn reach: its largest footprint radius over every heading, world units. */
export function phantomWhaleReach(kind: "adult" | "whale"): number {
  const art = WHALES.kinds.find((entry) => entry.kind === kind)!;
  return Math.max(...art.headings.map(({ footprintRadius }) => footprintRadius));
}

/**
 * Whale allies side by side across Ada's heading, centred on her track: neighbouring drawn
 * whales stay `neighborGap` world units apart (gameplay/ships.md "Whale").
 */
export function phantomWhaleOffsets(whales: readonly Pick<PhantomAllySpec, "id">[]): number[] {
  const reaches = whales.map((whale) => phantomWhaleReach(phantomWhaleKind(whale)));
  const offsets: number[] = [];
  let at = 0;
  reaches.forEach((reach, index) => {
    at += index === 0 ? 0 : reaches[index - 1]! + T.neighborGap + reach;
    offsets.push(at);
  });
  const centre = ((offsets[0] ?? 0) + (offsets.at(-1) ?? 0)) / 2;
  return offsets.map((offset) => offset - centre);
}

/** The same role slots place arriving allies and receive them when they have no target. */
function phantomAllyFormation(
  flight: Pick<FlightState, "player" | "facing">,
  allies: readonly PhantomAlly[],
): (ally: PhantomAlly) => Vec {
  const escorts = allies.filter((ally) => ally.behavior !== "whale");
  const whales = allies.filter((ally) => ally.behavior === "whale");
  const heading = Math.hypot(flight.facing.x, flight.facing.y) ? flight.facing : { x: 0, y: -1 };
  return (ally) => {
    if (ally.behavior !== "whale") {
      return phantomEscortSlot(flight.player, heading, ally.radius, escorts, escorts.indexOf(ally));
    }
    const offset = phantomWhaleOffsets(whales)[whales.indexOf(ally)]!;
    return {
      x: flight.player.x - heading.x * T.whaleFollow - heading.y * offset,
      y: flight.player.y - heading.y * T.whaleFollow + heading.x * offset,
    };
  };
}
function liveEnemy(object: SpaceObject): boolean {
  return (
    object.kind === "enemy" &&
    object.hp > 0 &&
    Boolean(object.enemy) &&
    !object.enemy?.disabled &&
    !object.enemy?.fleeing
  );
}
function targetFor(ally: PhantomAlly, flight: FlightState): Vec | undefined {
  const enemies = flight.objects.filter(liveEnemy).sort((a, b) => gap(a, ally) - gap(b, ally));
  if (ally.behavior === "escort") {
    return enemies.find((enemy) => gap(enemy, flight.player) <= T.allyIntercept);
  }
  for (const object of enemies) {
    const state = object.enemy!;
    const definition = enemyDefinition(flight.galaxy, state.archetype, object.id);
    const weapons = definition.hardpoints.filter(
      (part) =>
        part.kind === "weapon" &&
        state.hardpoints.some((held) => held.id === part.id && held.hp > 0),
    );
    const points = weapons
      .map((part) => {
        const offset = hardpointOffset(
          definition,
          (object.radius * 2) / definition.sizeRatio,
          state.facing,
          part,
        );
        return { x: object.x + offset.x, y: object.y + offset.y };
      })
      .sort((a, b) => gap(a, ally) - gap(b, ally));
    if (points.length) {
      return points[0];
    }
  }
  return undefined;
}
/** Allies live outside collision and targeting object lists; the engine owns their projectiles. */
export function stepPhantomAllies(
  ship: {
    maxSpeed: number;
    accelerationSeconds: number;
  },
  dt: number,
  flight: FlightState,
  allies: PhantomAlly[],
): AllyFire[] {
  const shots: AllyFire[] = [];
  const restingSlot = phantomAllyFormation(flight, allies);
  for (const ally of allies) {
    ally.jumpAge += dt;
    ally.fireIn = Math.max(0, ally.fireIn - dt);
    const target = ally.behavior === "whale" ? undefined : targetFor(ally, flight);
    const destination = target ?? restingSlot(ally);
    const distance = gap(ally, destination);
    const cap = ship.maxSpeed * (ally.behavior === "whale" ? CALF.speedFraction : 1);
    const speed = Math.min(cap, distance);
    const desired = distance
      ? {
          x: ((destination.x - ally.x) * speed) / distance,
          y: ((destination.y - ally.y) * speed) / distance,
        }
      : { x: 0, y: 0 };
    const change = { x: desired.x - ally.velocity.x, y: desired.y - ally.velocity.y };
    const size = Math.hypot(change.x, change.y);
    const scale = size ? Math.min(1, (cap * dt) / ship.accelerationSeconds / size) : 0;
    ally.velocity.x += change.x * scale;
    ally.velocity.y += change.y * scale;
    ally.x += ally.velocity.x * dt;
    ally.y += ally.velocity.y * dt;
    if (Math.hypot(ally.velocity.x, ally.velocity.y) > 0.01) {
      ally.facing = {
        x: ally.velocity.x / Math.hypot(ally.velocity.x, ally.velocity.y),
        y: ally.velocity.y / Math.hypot(ally.velocity.x, ally.velocity.y),
      };
    }
    if (target && !ally.fireIn) {
      shots.push({
        ally: ally.id,
        from: { x: ally.x, y: ally.y },
        level: 2,
        target: { x: target.x, y: target.y },
        weapon: "laser",
      });
      ally.fireIn = T.allyFireSeconds;
    }
  }
  return shots;
}
export interface PhantomSong {
  readonly center: Vec;
  readonly radius: number;
}

/** Only the current roster can provide Marlo's field or widen it. */
export function activePhantomSong(allies: readonly PhantomAlly[]): PhantomSong | undefined {
  const center = allies.find((ally) => ally.id === "marlo" && ally.song);
  if (!center) {
    return undefined;
  }
  const nursery = allies.some(
    (ally) => ally.id === "project:3:nurseryBeacon" && ally.behavior === "whale",
  );
  return { center, radius: T.songRadius * (nursery ? T.songNurseryScale : 1) };
}

/** Multiplies this frame's physics input without changing a catalog or a saved archetype. */
export function phantomSongSpeed(song: PhantomSong | undefined, point: Vec): number {
  return song && gap(song.center, point) <= song.radius ? T.songSpeed : 1;
}
