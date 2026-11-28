import type { GameContent } from "../../data/types.ts";
import { outlineContact, type Parts } from "../convex.ts";
import { worldRecordObjectRemoval } from "../geography.ts";
import { impactSurface } from "../projectileImpact.ts";
import { shipBody } from "../shipBody.ts";
import type { FlightEvent, FlightState, Shot, Vec } from "../types.ts";
import { canonicalPosition, flightWorldContext } from "../world/index.ts";
import { blastCoversAda, touchesAda } from "./adaContactQueries.ts";
import { recordBlastFlash, recordProjectileImpact } from "./impactFeedback.ts";
import { arrivalGraceActive as adaProtected } from "./lifecycle.ts";
import { strikeMines } from "./mines.ts";
import { projectileContact, projectileSceneryContact, shotRadius } from "./projectileContact.ts";

interface ProjectileStepContext {
  readonly blast: Parameters<typeof strikeMines>[0]["blast"];
  readonly damage: (amount: number, flight: FlightState) => void;
  readonly scenery: Parameters<typeof projectileContact>[0] & { readonly kinds: readonly string[] };
  readonly strike: (
    content: GameContent,
    shot: Shot,
    flight: FlightState,
    events: FlightEvent[],
    from: Vec,
  ) => void;
}

const length = (v: Vec) => Math.hypot(v.x, v.y);

/** A shot's strike against a mine's drawn silhouette: a 6 px square about the shot. */
const SHOT_PARTS: Parts = [
  [
    { x: -3, y: -3 },
    { x: 3, y: -3 },
    { x: 3, y: 3 },
    { x: -3, y: 3 },
  ],
];

export function createProjectileStep({
  blast,
  damage,
  scenery: projectileScenery,
  strike,
}: ProjectileStepContext) {
  const { kinds: SCENERY } = projectileScenery;
  const mineStrike = { blast, shotParts: SHOT_PARTS, shotRadius };

  /**
   * An enemy shot spent on Ada, an obstacle or the end of its reach: a missile's blast shows and
   * damages Ada within its radius, and a direct hit damages her; either way, once.
   */
  function enemyImpact(shot: Shot, struck: boolean, flight: FlightState): void {
    if (shot.blast === undefined && shot.effectFamily && shot.life <= 0) {
      recordProjectileImpact(flight, {
        ...shot,
        age: 0,
        direction: { ...shot.velocity },
        family: shot.effectFamily,
        id: shot.id,
        targetId: "",
      });
    }
    if (shot.blast !== undefined) {
      recordBlastFlash(flight, { age: 0, radius: shot.blast, x: shot.x, y: shot.y });
    }
    if (struck || (shot.blast !== undefined && blastCoversAda(flight, shot, shot.blast))) {
      damage(shot.damage, flight);
    }
  }

  return function shots(
    content: GameContent,
    dt: number,
    flight: FlightState,
    events: FlightEvent[],
    shotDelays: ReadonlyMap<string, number>,
  ): void {
    for (const shot of flight.shots) {
      const elapsed = Math.max(0, dt - (shotDelays.get(shot.id) ?? 0));
      if (elapsed === 0) {
        continue;
      }
      const travelTime = Math.min(elapsed, Math.max(0, shot.life));
      const steps = Math.max(1, Math.ceil((length(shot.velocity) * travelTime) / 5));
      for (let i = 0; i < steps && shot.life > 0; i++) {
        const from = { x: shot.x, y: shot.y };
        const radius = shotRadius(shot);
        const next = {
          x: shot.x + (shot.velocity.x * travelTime) / steps,
          y: shot.y + (shot.velocity.y * travelTime) / steps,
        };
        shot.x = next.x;
        shot.y = next.y;
        canonicalPosition(flight, shot);
        if (shot.enemy) {
          const struck = touchesAda(flight, shot, radius);
          if (struck && adaProtected(flight)) {
            shot.life = 0;
            continue;
          }
          const blocked = flight.objects.find(
            (object) =>
              SCENERY.includes(object.kind) &&
              object.hp > 0 &&
              projectileSceneryContact(projectileScenery, flight, object, shot, radius),
          );
          if (!struck && !blocked) {
            continue;
          }
          const bodyContact = outlineContact(shipBody(flight.facing), flight.player, shot, radius);
          const point = blocked
            ? projectileContact(projectileScenery, flight, blocked, shot, radius, from)
            : bodyContact
              ? impactSurface({ contact: bodyContact, projected: false, radius }, shot)
              : shot;
          shot.x = point.x;
          shot.y = point.y;
          shot.life = 0;
          enemyImpact(shot, struck, flight);
          continue;
        }
        if (shot.damage === undefined) {
          shot.life = 0;
          continue;
        }
        if (strikeMines(mineStrike, content, shot, flight, events)) {
          continue;
        }
        strike(content, shot, flight, events, from);
      }
      // A missile still flying at the end of its reach explodes where it is.
      const reachEnd = shot.life > 0 && shot.life <= elapsed;
      shot.life = Math.max(0, shot.life - elapsed);
      if (reachEnd && shot.blast !== undefined) {
        if (shot.enemy) {
          enemyImpact(shot, false, flight);
        } else {
          blast(content, shot.damage, shot.blast, shot, null, flight, events);
        }
      }
    }
    flight.shots = flight.shots.filter((s) => s.life > 0);
    for (const object of flight.objects) {
      if (object.hp <= 0) {
        worldRecordObjectRemoval(flightWorldContext(flight), content, object, flight);
      }
    }
    flight.objects = flight.objects.filter((o) => o.hp > 0);
  };
}
