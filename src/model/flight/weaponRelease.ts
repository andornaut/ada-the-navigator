import type { GameContent } from "../../data/types.ts";
import { weaponAt, type WeaponDefinition } from "../../data/weaponCatalog.ts";
import { nosePoint } from "../nose.ts";
import { planPlayerVolley, type PlayerVolley } from "../playerProjectiles.ts";
import type { PlayerWeaponCoverageContext } from "../playerWeaponCoverage.ts";
import type { FlightEvent, FlightState, Shot, Vec } from "../types.ts";
import { impactFamily, type ImpactFamily } from "../weaponImpacts.ts";
import { ensureOwnedWeapons, spendAmmo } from "../weapons.ts";

type Strike = (
  content: GameContent,
  shot: Shot,
  flight: FlightState,
  events: FlightEvent[],
) => void;

interface WeaponReleaseContact {
  readonly fireBeam: (
    coverage: PlayerWeaponCoverageContext,
    content: GameContent,
    definition: WeaponDefinition,
    aim: Vec,
    origin: Vec,
    flight: FlightState,
    events: FlightEvent[],
  ) => void;
  readonly strike: Strike;
}

export function firePlayerWeapon(
  contact: WeaponReleaseContact,
  content: GameContent,
  viewportWidth: number,
  viewportHeight: number,
  aim: Vec,
  flight: FlightState,
  events: FlightEvent[],
): void {
  ensureOwnedWeapons(flight);
  const weapon = flight.weapon;
  const definition = weaponAt(weapon, flight.levels.weapons[weapon]);
  const family = impactFamily(weapon);
  if ((weapon === "multiLaser" || weapon === "scattershot") && flight.ammo[weapon] === 0) {
    spendAmmo(flight, 0);
    events.push({ type: "outOfAmmo" });
    return;
  }
  if (weapon !== "multiLaser" && spendAmmo(flight, 1)) {
    events.push({ type: "outOfAmmo" });
  }
  // Every shot and beam leaves the ship's nose for its heading; ranges run from there.
  const origin = nosePoint(flight.facing, flight.player);
  const coverage = { centre: { ...flight.player }, viewportHeight, viewportWidth };
  if (definition.projectileKind === "beam") {
    contact.fireBeam(coverage, content, definition, aim, origin, flight, events);
    flight.fireCooldown += definition.intervalSeconds;
    return;
  }
  const volley = releaseFriendlyVolley(
    contact.strike,
    coverage,
    flight.velocity,
    family,
    content,
    definition,
    origin,
    aim,
    viewportWidth,
    flight,
    events,
  );
  flight.fireCooldown += volley.interval;
  // Release the full fan before spending its unit and potentially switching to Laser.
  if (weapon === "multiLaser" && spendAmmo(flight, 1)) {
    events.push({ type: "outOfAmmo" });
  }
}

/** The player's and an ally's shots share canonical damage, range and collision handling. */
export function releaseFriendlyVolley(
  strike: Strike,
  coverage: PlayerWeaponCoverageContext | undefined,
  inheritedVelocity: Vec | undefined,
  family: ImpactFamily,
  content: GameContent,
  definition: WeaponDefinition,
  origin: Vec,
  aim: Vec,
  viewportWidth: number,
  flight: FlightState,
  events: FlightEvent[],
): PlayerVolley {
  const volley = planPlayerVolley(definition, {
    ...(coverage === undefined ? {} : { coverage }),
    ...(inheritedVelocity === undefined ? {} : { inheritedVelocity }),
    aim,
    baseDamage: content.tuning.flight.playerShotDamage,
    baseLifetime: content.tuning.flight.projectileLifetime,
    baseSpeed: content.tuning.flight.projectileSpeed,
    origin,
    viewportWidth,
  });
  for (const { delay, ...projectile } of volley.projectiles) {
    const shot: Shot = {
      ...projectile,
      effectFamily: family,
      enemy: false,
      hitIds: [],
      id: `shot:${flight.nextId++}`,
      piercing: false,
    };
    if (delay) {
      (flight.pendingPellets ??= []).push({ delay, shot });
    } else {
      flight.shots.push(shot);
      // A shot that starts inside an obstacle Ada is touching strikes it at once.
      strike(content, shot, flight, events);
    }
  }
  return volley;
}

/** Release committed Scattershot rows on the flight clock, with the rest of their slice to fly. */
export function releasePendingPellets(
  strike: Strike,
  content: GameContent,
  dt: number,
  flight: FlightState,
  events: FlightEvent[],
  shotDelays: Map<string, number>,
): void {
  if (!flight.pendingPellets) {
    return;
  }
  const waiting = [];
  for (const { delay, shot } of flight.pendingPellets) {
    if (delay - dt > 1e-9) {
      waiting.push({ delay: delay - dt, shot });
      continue;
    }
    flight.shots.push(shot);
    shotDelays.set(shot.id, Math.min(delay, dt));
    if (!shot.enemy) {
      strike(content, shot, flight, events);
    }
  }
  if (waiting.length) {
    flight.pendingPellets = waiting;
  } else {
    delete flight.pendingPellets;
  }
}
