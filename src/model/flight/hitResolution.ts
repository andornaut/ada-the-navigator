import { ANDROMEDA_REDACT, CARTWHEEL_CLAIM, NEEDLE_CADENCE } from "../../data/capitalBosses.ts";
import { ROUTE_POSITION } from "../../data/galaxies.ts";
import { PHANTOM_FLAGSHIP } from "../../data/phantom.ts";
import type { GameContent } from "../../data/types.ts";
import { damageEnemy, enemyDefeated } from "../enemyAi.ts";
import { enemyEquipmentDefinition } from "../enemyEquipment.ts";
import { queueHostileStationReward } from "../hostileStationReward.ts";
import { MOVING_ROCK_PREFIX } from "../rockRicochet.ts";
import type { FlightEvent, FlightState, Shot, SpaceObject, Vec } from "../types.ts";
import { destroyEnemy, dropFromRock, markBlasted } from "./destruction.ts";
import { blastCover, enemyTouched, hitPart, partReach, screenGap } from "./enemyHitGeometry.ts";
import { recordBlastFlash, recordProjectileImpact } from "./impactFeedback.ts";
import { armed } from "./mines.ts";
import { projectileContact, projectileSceneryContact, shotRadius } from "./projectileContact.ts";
import { blastCoversRock } from "./rockBlastCoverage.ts";

/** Damages an enemy (at a hardpoint, or its hull for null) or scenery, then resolves its loss. */
export function hit(
  content: GameContent,
  amount: number,
  part: string | null,
  object: SpaceObject,
  flight: FlightState,
  events: FlightEvent[],
): void {
  if (object.hp <= 0) {
    return;
  }
  if (object.kind === "enemy" && object.enemy) {
    const before = object.enemy;
    const definition = enemyEquipmentDefinition(flight.galaxy, before);
    const after = damageEnemy(definition, { amount, hardpointId: part }, before);
    object.enemy = after;
    object.hp = enemyDefeated(after) ? 0 : Math.max(1, after.hp);
    if ((!before.disabled && after.disabled) || object.hp <= 0) {
      queueHostileStationReward(flight, events, object);
    }
    if (object.hp > 0 && !before.disabled && after.disabled) {
      events.push({ id: object.id, type: "enemyDisabled" });
    } else if (
      (object.id === PHANTOM_FLAGSHIP ||
        object.id === CARTWHEEL_CLAIM.id ||
        object.id === NEEDLE_CADENCE.id ||
        object.id === ANDROMEDA_REDACT.id) &&
      part !== null &&
      object.hp > 0 &&
      !before.disabled &&
      !after.disabled &&
      before.hardpoints.every(({ hp }) => hp > 0) &&
      after.hardpoints.some(({ hp, id }) => id === part && hp === 0)
    ) {
      events.push({ id: object.id, type: "enemyFirstHardpointLost" });
    }
    if (
      object.id === CARTWHEEL_CLAIM.id &&
      part !== null &&
      object.hp > 0 &&
      !before.disabled &&
      !after.disabled &&
      definition.hardpoints.some(
        (mount) =>
          mount.id === part && mount.kind === "weapon" && mount.fire.weapon === "mineLayer",
      ) &&
      before.hardpoints.some(({ hp, id }) => id === part && hp > 0) &&
      after.hardpoints.some(({ hp, id }) => id === part && hp === 0)
    ) {
      events.push({ hardpointId: part, id: object.id, type: "enemyMineLayerDisabled" });
    }
  } else {
    object.hp -= amount;
  }
  if (object.hp > 0) {
    return;
  }
  if (object.kind === "enemy") {
    destroyEnemy(object, flight);
    events.push({ id: object.id, type: "enemyDestroyed" });
  }
  if (object.asteroid) {
    events.push({
      asteroid: object.asteroid,
      ...(object.crystals ? { crystals: object.crystals } : {}),
      id: object.id,
      type: "asteroidDestroyed",
      x: object.x,
      y: object.y,
    });
  }
  if (object.kind === "debris") {
    events.push({ id: object.id, type: "debrisCleared" });
  }
  // A planned moving rock drops loot like the static rock it was chosen from.
  if (object.kind === "rock" || object.id.startsWith(MOVING_ROCK_PREFIX)) {
    dropFromRock(content, object, flight);
  }
}

export function createHitResolution(
  projectileScenery: Parameters<typeof projectileContact>[0] & {
    readonly kinds: readonly string[];
  },
) {
  const { frameOf, kinds: SCENERY } = projectileScenery;

  /**
   * Ada's shot strikes every enemy and obstacle it touches at its position that it has not struck,
   * until it is spent; a large hull only takes it at a live hardpoint.
   */
  function strike(
    content: GameContent,
    shot: Shot,
    flight: FlightState,
    events: FlightEvent[],
    from?: Vec,
  ): void {
    if (shot.damage === undefined) {
      return;
    }
    for (const object of flight.objects) {
      if (
        !["enemy", ...SCENERY].includes(object.kind) ||
        object.hp <= 0 ||
        object.enemy?.salvaged ||
        shot.hitIds.includes(object.id) ||
        (object.kind === "enemy"
          ? !enemyTouched(flight, ROUTE_POSITION[flight.galaxy], object, shot, shotRadius(shot))
          : !projectileSceneryContact(projectileScenery, flight, object, shot, shotRadius(shot)))
      ) {
        continue;
      }
      shot.hitIds.push(object.id);
      const part = hitPart(content, flight, partReach(content), shotRadius(shot), shot, object);
      const at = projectileContact(
        projectileScenery,
        flight,
        object,
        shot,
        shotRadius(shot),
        from,
        part,
      );
      recordProjectileImpact(flight, {
        ...at,
        age: 0,
        id: `${shot.id}:${object.id}`,
        targetId: object.id,
        ...(shot.effectFamily
          ? { direction: { ...shot.velocity }, family: shot.effectFamily }
          : {}),
      });
      hit(content, shot.damage, part, object, flight, events);
      if (shot.blast !== undefined) {
        blast(content, shot.damage, shot.blast, at, object, flight, events);
      }
      if (!shot.piercing) {
        shot.life = 0;
      }
      if (shot.life <= 0) {
        break;
      }
    }
  }

  /**
   * A missile's blast is a circle on screen of radius `radius` about the impact (gameplay/rules.md
   * "Missiles"): it deals full damage to every other live enemy or rock whose drawn shape
   * overlaps it. A multipart ship takes it at the live hardpoint it covers deepest. Armed mines
   * whose centre it covers pop. The blast shows one flash, which stands in for
   * the destruction flash of every enemy the impact destroys, the struck one included. `struck`,
   * damaged directly by its hit, is null for a missile that exploded at the end of its reach.
   */
  function blast(
    content: GameContent,
    amount: number,
    radius: number,
    at: Vec,
    struck: SpaceObject | null,
    flight: FlightState,
    events: FlightEvent[],
  ): void {
    recordBlastFlash(flight, { age: 0, radius, x: at.x, y: at.y });
    for (const mine of flight.mines) {
      if (armed(mine) && screenGap(flight, at, mine) <= radius) {
        mine.end = { age: 0, kind: "pop" };
      }
    }
    for (const object of [...flight.objects]) {
      if (object === struck || object.hp <= 0 || object.enemy?.salvaged) {
        continue;
      }
      if (object.kind !== "enemy") {
        if (
          (object.kind === "rock" || (object.kind === "debris" && object.asteroid)) &&
          blastCoversRock(frameOf, flight, radius, at, object)
        ) {
          hit(content, amount, null, object, flight, events);
        }
        continue;
      }
      const covered = blastCover(content, flight, radius, at, object);
      if (covered === null) {
        continue;
      }
      hit(content, amount, covered.part, object, flight, events);
      markBlasted(object, flight);
    }
    if (struck) {
      markBlasted(struck, flight);
    }
  }

  return { blast, strike };
}
