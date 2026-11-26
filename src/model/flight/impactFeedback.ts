import type { Vec } from "../../data/types.ts";
import { BEAM } from "../../data/weaponCatalog.ts";
import { magnitude as length } from "../ai/course.ts";
import { nosePoint } from "../nose.ts";
import type { FlightState } from "../types.ts";
import type { ImpactFamily, WeaponImpact } from "../weaponImpacts.ts";

/**
 * A hitscan beam's visible flash, view-only and never saved: `from` and `to` are the fire-time
 * line, where the hit landed; a hit also shows a spark at `to`.
 */
export interface BeamFlash {
  from: Vec;
  to: Vec;
  hit: boolean;
  age: number;
}

/**
 * Ada's beam as drawn now: it stays on her nose and turns with her aim, at the length it fired
 * with (gameplay/rules.md, Phaser).
 */
export function drawnBeamFlash(flight: FlightState, flash: BeamFlash): { from: Vec; to: Vec } {
  const span = length(flight.facing);
  const reach = length({ x: flash.to.x - flash.from.x, y: flash.to.y - flash.from.y });
  if (!span) {
    return { from: flash.from, to: flash.to };
  }
  const from = nosePoint(flight.facing, flight.player);
  return {
    from,
    to: {
      x: from.x + (flight.facing.x / span) * reach,
      y: from.y + (flight.facing.y / span) * reach,
    },
  };
}
const beamFlashes = new WeakMap<FlightState, BeamFlash[]>();

/** A missile blast's visible flash at its impact, view-only and never saved. */
export interface BlastFlash extends Vec {
  radius: number;
  age: number;
}
export interface ProjectileImpact extends Vec {
  readonly family?: ImpactFamily;
  readonly direction?: Vec;
  readonly id: string;
  readonly targetId: string;
  age: number;
}
const projectileImpacts = new WeakMap<FlightState, ProjectileImpact[]>();
/** Short-lived contact records survive consumed shots so feedback retains the actual hit point. */
export function activeProjectileImpacts(flight: FlightState): readonly ProjectileImpact[] {
  return projectileImpacts.get(flight) ?? [];
}
const blastFlashes = new WeakMap<FlightState, BlastFlash[]>();
/** How long a blast shows: the longest blast effect, the Heavy Missile's 340 ms. */
export const BLAST_FLASH_SECONDS = 0.34;

/** The flight's beam flashes still showing. */
export function activeBeamFlashes(flight: FlightState): readonly BeamFlash[] {
  return beamFlashes.get(flight) ?? [];
}

const impactViewIds = new WeakMap<object, string>();
let nextImpactViewId = 0;
function impactViewId(entry: object): string {
  let id = impactViewIds.get(entry);
  if (id === undefined) {
    id = `impact:${nextImpactViewId++}`;
    impactViewIds.set(entry, id);
  }
  return id;
}

/** Explicit family snapshots for the existing contact renderer and Art's procedural fixture. */
export function activeWeaponImpacts(flight: FlightState): readonly WeaponImpact[] {
  return [
    ...activeProjectileImpacts(flight).flatMap((impact): WeaponImpact[] =>
      impact.family && impact.family !== "missile" ? [{ ...impact, family: impact.family }] : [],
    ),
    ...activeBlastFlashes(flight).map((flash): WeaponImpact => ({
      ...flash,
      blastRadius: flash.radius,
      family: "missile",
      id: impactViewId(flash),
    })),
    ...activeBeamFlashes(flight).flatMap((flash): WeaponImpact[] =>
      flash.hit
        ? [
            {
              ...flash.to,
              age: flash.age,
              direction: { x: flash.to.x - flash.from.x, y: flash.to.y - flash.from.y },
              family: "phaserRings",
              id: impactViewId(flash),
            },
          ]
        : [],
    ),
  ];
}

/** The flight's blast flashes still showing. */
export function activeBlastFlashes(flight: FlightState): readonly BlastFlash[] {
  return blastFlashes.get(flight) ?? [];
}

export function ageFlashes(dt: number, flight: FlightState): void {
  const impacts = projectileImpacts.get(flight) ?? [];
  for (const impact of impacts) {
    impact.age += dt;
  }
  projectileImpacts.set(
    flight,
    impacts.filter((impact) => impact.age < 0.65),
  );
  const beams = beamFlashes.get(flight);
  if (beams) {
    beams.forEach((flash) => (flash.age += dt));
    beamFlashes.set(
      flight,
      beams.filter((flash) => flash.age < Math.max(BEAM.flashSeconds, BEAM.sparkSeconds)),
    );
  }
  const blasts = blastFlashes.get(flight);
  if (blasts) {
    blasts.forEach((flash) => (flash.age += dt));
    blastFlashes.set(
      flight,
      blasts.filter((flash) => flash.age < BLAST_FLASH_SECONDS),
    );
  }
}

export function recordProjectileImpact(flight: FlightState, impact: ProjectileImpact): void {
  const impacts = projectileImpacts.get(flight) ?? [];
  impacts.push(impact);
  projectileImpacts.set(flight, impacts);
}

export function recordBlastFlash(flight: FlightState, flash: BlastFlash): void {
  const blasts = blastFlashes.get(flight) ?? [];
  blasts.push(flash);
  blastFlashes.set(flight, blasts);
}

export function recordBeamFlash(flight: FlightState, flash: BeamFlash): void {
  const flashes = beamFlashes.get(flight) ?? [];
  flashes.push(flash);
  beamFlashes.set(flight, flashes);
}
