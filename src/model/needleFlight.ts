import type { GameContent } from "../data/types.ts";
import { type Contact, outlinesContact, type Parts, toScreen } from "./convex.ts";
import { ACTIVE_CHUNK_RADIUS } from "./geography.ts";
import {
  activeNeedleCourses,
  inNeedleChannel,
  type NeedleCourse,
  needleDebris,
  needleRimParts,
} from "./needle.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";

const rims = new WeakMap<NeedleCourse, readonly SpaceObject[]>();
const shapes = new WeakMap<SpaceObject, Parts>();

/** Gate rims are transient collision surfaces, never world objects or saved rewards. */
export function needleRims(flight: FlightState): readonly SpaceObject[] {
  return activeNeedleCourses(flight).flatMap((course) => {
    let objects = rims.get(course);
    if (!objects) {
      objects = course.gates.map((gate, index) => {
        const parts = needleRimParts(gate).map((part) =>
          part.map((point) => toScreen({ x: point.x - gate.point.x, y: point.y - gate.point.y })),
        );
        const object: SpaceObject = {
          ...gate.point,
          hp: 1,
          id: `needle:${course.kind}:rim:${index}`,
          kind: "rock",
          radius: course.width,
        };
        shapes.set(object, parts);
        return object;
      });
      rims.set(course, objects);
    }
    return objects;
  });
}

export function isNeedleRim(object: SpaceObject): boolean {
  return shapes.has(object);
}

/** The gate opening uses Ada's actual projected hull, rather than its enclosing circle. */
export function needleRimContact(
  context: { readonly body: Parts; readonly position: Vec },
  object: SpaceObject,
): Contact | null {
  const parts = shapes.get(object);
  return parts ? outlinesContact(parts, object, context.body, context.position) : null;
}

export function needleChannelContains(
  context: { readonly radius?: number },
  flight: FlightState,
  point: Vec,
): boolean {
  return activeNeedleCourses(flight).some((course) => inNeedleChannel(context, course, point));
}

/** Normal persistent debris uses the canonical descriptors and the existing removal ledger. */
export function ensureNeedleDebris(content: GameContent, flight: FlightState): void {
  const ids = new Set(flight.objects.map((object) => object.id));
  const reach = (ACTIVE_CHUNK_RADIUS + 1) * content.tuning.chunkSize;
  for (const course of activeNeedleCourses(flight)) {
    for (const descriptor of needleDebris(course, flight.seed)) {
      const x = descriptor.x + descriptor.velocity.x * flight.time;
      const y = descriptor.y + descriptor.velocity.y * flight.time;
      if (
        ids.has(descriptor.id) ||
        Object.hasOwn(flight.world.notables, descriptor.id) ||
        Math.abs(x - flight.player.x) > reach ||
        Math.abs(y - flight.player.y) > reach
      ) {
        continue;
      }
      flight.objects.push({
        hp: content.tuning.flight.rockHp,
        id: descriptor.id,
        kind: "debris",
        persistent: true,
        radius: descriptor.radius,
        velocity: { ...descriptor.velocity },
        x,
        y,
      });
      ids.add(descriptor.id);
    }
  }
}
