import { LANCE_TELL, PHASER_AIM_SECONDS } from "../../data/enemyCatalog.ts";
import type { GameContent } from "../../data/types.ts";
import { BEAM, LANCE_HIT_RADIUS } from "../../data/weaponCatalog.ts";
import { enemyFireLine, type FireIntent, magnitude as length } from "../ai/index.ts";
import {
  advanceHammerTutorial,
  authoredLanceAction,
  crossbowAllowsAttack,
  type CrossbowSector,
} from "../earlyEncounterPatterns.ts";
import {
  EARLY_LANCE_MOUNT,
  EARLY_LANCE_SECONDS,
  pendingEarlyLance,
} from "../earlyEncounterRuntime.ts";
import { enemyEquipmentDefinition } from "../enemyEquipment.ts";
import { shipBody } from "../shipBody.ts";
import type { FlightState, SpaceObject, Vec } from "../types.ts";
import { flightWorldContext, worldDelta, worldPoint } from "../world/index.ts";
import { beamPoint, outlineBeamStrike, sampleBeam } from "./beamContact.ts";

/**
 * An enemy Phaser or charged lance shot and its tell: a Phaser's aim line is fixed where it
 * started; a lance's line follows its ship and tracks Ada, then holds still. The beam fires
 * along the line. Only the lance can stop early. A Phaser keeps its impact separate.
 * Pending ordinary attacks resume from the flight queue. Authored tells restore from actor state.
 */
export interface EnemyBeam {
  /** Seconds since the tell appeared. */
  age: number;
  damage: number;
  direction: Vec;
  /**
   * A fired Phaser's visible beam this step: from its ship's current muzzle along the weapon's
   * current aim at the length it fired with. `muzzle` and `end` keep the fire-time line.
   * Null before it fires, and always for a lance.
   */
  drawn: { from: Vec; to: Vec } | null;
  end: Vec;
  fired: boolean;
  hardpointId: string | null;
  impact?: Vec;
  kind: "lance" | "phaser";
  muzzle: Vec;
  /** The muzzle's offset from its ship, which a lance's line follows while it tracks. */
  offset: Vec;
  ownerId: string;
  range: number;
  /** Whether an obstacle, or Ada on firing, stopped the line short of its range. */
  stopped: boolean;
  /** The named encounter owns this pending tell across Continue. */
  authored?: true;
  /** The volley that picked the drawn barrel it fired from. */
  volley: number;
}
/** When each beam fires after its tell begins, and how long its beam then shows. */
export const BEAM_TIMING = {
  // art/weapons.md "Charged lance": the beam shows for 300 ms.
  lance: {
    fires: LANCE_TELL.trackSeconds + LANCE_TELL.lockSeconds,
    shows: Math.max(0.3, BEAM.sparkSeconds),
  },
  phaser: { fires: PHASER_AIM_SECONDS, shows: Math.max(BEAM.flashSeconds, BEAM.sparkSeconds) },
} as const;

/** A unit world heading's length on screen. */
export function projectedLength(heading: Vec): number {
  return Math.hypot(heading.x - heading.y, (heading.x + heading.y) / 2);
}

export function rememberEarlyLance(
  owner: SpaceObject,
  beam: EnemyBeam,
  kind: "started" | "updated" | "fired" | "cancelled",
): void {
  const enemy = owner.enemy;
  const state = enemy?.earlyEncounter;
  if (!enemy || (state?.kind !== "hammer" && state?.kind !== "crossbow")) {
    return;
  }
  if (kind === "fired" || kind === "cancelled") {
    enemy.earlyEncounter =
      state.kind === "hammer"
        ? { ...advanceHammerTutorial(state, { kind }).state, kind: "hammer" }
        : { elapsed: state.elapsed, kind: state.kind };
    return;
  }
  beam.authored = true;
  const tell = {
    age: beam.age,
    damage: beam.damage,
    direction: { ...beam.direction },
    muzzle: { ...beam.muzzle },
    offset: { ...beam.offset },
    volley: beam.volley,
  };
  enemy.earlyEncounter =
    state.kind === "hammer"
      ? { ...advanceHammerTutorial(state, { kind, tell }).state, kind: "hammer" }
      : { ...state, pendingLance: tell };
}

export function restoreEarlyLance(flight: FlightState, owner: SpaceObject | undefined): void {
  const tell = pendingEarlyLance(owner?.enemy?.earlyEncounter);
  if (!owner || !tell) {
    return;
  }
  const beams = flight.enemyBeams ?? [];
  if (!beams.some((beam) => beam.ownerId === owner.id && beam.authored && !beam.fired)) {
    beams.push({
      ...tell,
      authored: true,
      drawn: null,
      end: { ...tell.muzzle },
      fired: false,
      hardpointId: EARLY_LANCE_MOUNT,
      kind: "lance",
      ownerId: owner.id,
      range: 0,
      stopped: false,
    });
    flight.enemyBeams = beams;
  }
}

export function activeEnemyBeams(flight: FlightState): readonly EnemyBeam[] {
  return flight.enemyBeams ?? [];
}

interface EnemyBeamContact {
  readonly crossbowFrame: (
    flight: FlightState,
    actor: SpaceObject,
    elapsed: number,
  ) => CrossbowSector | undefined;
  readonly damage: (amount: number, flight: FlightState) => void;
  readonly obstacleStop: (
    origin: Vec,
    direction: Vec,
    range: number,
    flight: FlightState,
    halfWidth: number,
  ) => number;
  readonly touchesAda: (flight: FlightState, point: Vec, radius: number) => boolean;
}

/**
 * Starts an enemy Phaser's or lance's tell along its aim from the muzzle; its delay counts
 * toward the tell. `ship` is where the ship was when it fired.
 */
export function chargeEnemyBeam(
  damage: number,
  range: number,
  ship: Vec,
  fire: Pick<FireIntent, "aim" | "delay" | "hardpointId" | "origin" | "volley" | "weapon">,
  ownerId: string,
  flight: FlightState,
): EnemyBeam | undefined {
  const span = length(fire.aim);
  const kind = fire.weapon === "chargedLance" ? "lance" : "phaser";
  if (!span || (kind === "phaser" && range <= 0)) {
    return undefined;
  }
  const beams = flight.enemyBeams ?? [];
  const beam: EnemyBeam = {
    age: -fire.delay,
    damage,
    direction: { x: fire.aim.x / span, y: fire.aim.y / span },
    drawn: null,
    end: { ...fire.origin },
    fired: false,
    hardpointId: fire.hardpointId,
    kind,
    muzzle: { ...fire.origin },
    offset: { x: fire.origin.x - ship.x, y: fire.origin.y - ship.y },
    ownerId,
    range,
    stopped: false,
    volley: fire.volley,
  };
  beams.push(beam);
  flight.enemyBeams = beams;
  return beam;
}

/**
 * Moves a fired Phaser's visible beam onto its ship's current muzzle and aim at its fire-time
 * length; the beam holds where it last was once its ship or weapon can no longer aim.
 */
function followEnemyBeam(
  content: GameContent,
  flight: FlightState,
  beam: EnemyBeam,
  owner = flight.objects.find((object) => object.id === beam.ownerId),
): void {
  const line =
    owner?.enemy && owner.hp > 0
      ? enemyFireLine(
          enemyEquipmentDefinition(flight.galaxy, owner.enemy),
          content.tuning.flight.shipRadius * 2,
          beam.hardpointId,
          beam.volley,
          owner.enemy,
        )
      : null;
  if (!line) {
    return;
  }
  const reach = length({ x: beam.end.x - beam.muzzle.x, y: beam.end.y - beam.muzzle.y });
  beam.drawn = {
    from: line.origin,
    to: { x: line.origin.x + line.aim.x * reach, y: line.origin.y + line.aim.y * reach },
  };
}

/** Whether a lance's ship and mount can still fire it: alive, armed and powered. */
function lanceHolds(beam: EnemyBeam, flight: FlightState): SpaceObject | undefined {
  const owner = flight.objects.find((object) => object.id === beam.ownerId);
  const enemy = owner?.enemy;
  return owner &&
    owner.hp > 0 &&
    enemy &&
    !enemy.disabled &&
    !enemy.salvaged &&
    enemy.hardpoints.some((part) => part.id === beam.hardpointId)
    ? owner
    : undefined;
}

/**
 * Ages each enemy Phaser and lance shot. A lance's line follows its ship and aims at Ada while
 * it tracks, then holds still, and runs as far as the game area is wide on screen; it goes out
 * if its ship or mount can no longer fire. Only the lance stops at an obstacle. Each beam
 * checks Ada once when the tell ends and keeps its fire-time impact fixed.
 */
export function stepEnemyBeams(
  contact: EnemyBeamContact,
  content: GameContent,
  dt: number,
  viewportWidth: number,
  flight: FlightState,
): void {
  const beams = flight.enemyBeams;
  if (!beams) {
    return;
  }
  const out = new Set<EnemyBeam>();
  for (const beam of beams) {
    beam.age += dt;
    if (beam.fired) {
      if (beam.kind === "phaser") {
        followEnemyBeam(content, flight, beam);
      }
      continue;
    }
    if (beam.kind === "lance") {
      const owner = lanceHolds(beam, flight);
      if (!owner) {
        const retained = beam.authored
          ? (flight.objects.find(({ id }) => id === beam.ownerId) ??
            flight.world.notables[beam.ownerId])
          : undefined;
        if (retained) {
          rememberEarlyLance(retained, beam, "cancelled");
        }
        out.add(beam);
        continue;
      }
      if (beam.age < LANCE_TELL.trackSeconds) {
        beam.muzzle = { x: owner.x + beam.offset.x, y: owner.y + beam.offset.y };
        const toward = worldDelta(flightWorldContext(flight), beam.muzzle, flight.player);
        const span = length(toward);
        if (span) {
          beam.direction = { x: toward.x / span, y: toward.y / span };
        }
      }
      beam.range = viewportWidth / projectedLength(beam.direction);
      if (beam.authored) {
        const enemy = owner.enemy!;
        const early = enemy.earlyEncounter;
        // A due beam can fire before the end of this slice, even when the sector closes later in it.
        const at = dt - Math.max(0, beam.age - EARLY_LANCE_SECONDS);
        const sector =
          early?.kind === "crossbow"
            ? contact.crossbowFrame(flight, owner, early.elapsed + at)
            : undefined;
        const action = authoredLanceAction(
          {
            age: beam.age,
            owner: {
              disabled: enemy.disabled,
              hp: owner.hp,
              mountHp: enemy.hardpoints.some(({ id }) => id === beam.hardpointId) ? 1 : null,
              salvaged: enemy.salvaged,
            },
          },
          early?.kind !== "crossbow" ||
            Boolean(
              sector &&
              crossbowAllowsAttack(flightWorldContext(flight), sector, {
                fireBy: 0,
                paths: [
                  {
                    from: beam.muzzle,
                    screenRadius: LANCE_HIT_RADIUS,
                    travel: { x: beam.direction.x * beam.range, y: beam.direction.y * beam.range },
                  },
                ],
              }),
            ),
        );
        if (action === "cancel") {
          rememberEarlyLance(owner, beam, "cancelled");
          out.add(beam);
          continue;
        }
        rememberEarlyLance(owner, beam, action === "fire" ? "fired" : "updated");
      }
    }
    const halfWidth = beam.kind === "lance" ? LANCE_HIT_RADIUS : BEAM.halfWidth;
    const stop =
      beam.kind === "lance"
        ? contact.obstacleStop(beam.muzzle, beam.direction, beam.range, flight, halfWidth)
        : beam.range;
    let reach = stop;
    if (beam.age >= BEAM_TIMING[beam.kind].fires) {
      beam.fired = true;
      if (beam.kind === "lance") {
        const strike = sampleBeam(beam.muzzle, beam.direction, 0, stop, (point) =>
          contact.touchesAda(flight, point, halfWidth) ? true : null,
        );
        if (strike) {
          reach = strike.at;
          contact.damage(beam.damage, flight);
        }
      } else {
        const world = flightWorldContext(flight);
        const ship = worldPoint(world, beam.muzzle, flight.player);
        const body = shipBody(flight.facing);
        const strike = outlineBeamStrike(
          { halfWidth, heading: beam.direction, origin: beam.muzzle, range: stop },
          ship,
          body,
        );
        if (strike) {
          beam.impact = strike.point;
          contact.damage(beam.damage, flight);
        }
      }
    }
    beam.stopped = reach < beam.range;
    beam.end = beamPoint(beam.muzzle, beam.direction, reach);
    if (beam.fired && beam.kind === "phaser") {
      beam.drawn = { from: { ...beam.muzzle }, to: { ...beam.end } };
      // Spear's visible shot follows its flush emitter from the first drawn frame. The
      // collision above still uses the locked tell's muzzle, direction and length.
      const owner = flight.objects.find((object) => object.id === beam.ownerId);
      if (beam.hardpointId === null && owner?.enemy?.archetype === "interceptor") {
        followEnemyBeam(content, flight, beam, owner);
      }
    }
  }
  const remaining = beams.filter(
    (beam) =>
      !out.has(beam) && beam.age < BEAM_TIMING[beam.kind].fires + BEAM_TIMING[beam.kind].shows,
  );
  if (remaining.length) {
    flight.enemyBeams = remaining;
  } else {
    delete flight.enemyBeams;
  }
}
