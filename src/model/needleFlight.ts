import type { GameContent } from "../data/types.ts";
import { closestOnSegment, type Contact, outlinesContact, type Parts, toScreen } from "./convex.ts";
import { ACTIVE_CHUNK_RADIUS } from "./geography.ts";
import {
  activeNeedleCourses,
  inNeedleChannel,
  type NeedleCourse,
  needleDebris,
  type NeedleDebrisDescriptor,
  needleRimParts,
} from "./needle.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";

const rims = new WeakMap<NeedleCourse, readonly SpaceObject[]>();
const shapes = new WeakMap<SpaceObject, Parts>();
const debris = new WeakMap<NeedleCourse, readonly NeedleDebrisDescriptor[]>();

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
    let descriptors = debris.get(course);
    if (!descriptors) {
      descriptors = needleDebris(course, flight.seed);
      debris.set(course, descriptors);
    }
    for (const descriptor of descriptors) {
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

/** First swept entry into any channel capsule, including the hostile body's whole radius. */
export function needleChannelEntry(
  context: { readonly radius?: number },
  flight: FlightState,
  from: Vec,
  to: Vec,
): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const square = dx * dx + dy * dy;
  if (needleChannelContains(context, flight, from)) {
    return 0;
  }
  if (!square) {
    return null;
  }
  let entry = Infinity;
  const accept = (value: number) => {
    if (value >= 0 && value <= 1) {
      entry = Math.min(entry, value);
    }
  };
  for (const course of activeNeedleCourses(flight)) {
    const radius = course.width / 2 + (context.radius ?? 0);
    for (let index = 1; index < course.path.length; index++) {
      const a = course.path[index - 1]!;
      const b = course.path[index]!;
      for (const end of [a, b]) {
        const x = from.x - end.x;
        const y = from.y - end.y;
        const along = x * dx + y * dy;
        const discriminant = along * along - square * (x * x + y * y - radius * radius);
        if (discriminant >= 0) {
          accept((-along - Math.sqrt(discriminant)) / square);
        }
      }
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (!length) {
        continue;
      }
      const ux = (b.x - a.x) / length;
      const uy = (b.y - a.y) / length;
      const x = (from.x - a.x) * ux + (from.y - a.y) * uy;
      const y = -(from.x - a.x) * uy + (from.y - a.y) * ux;
      const vx = dx * ux + dy * uy;
      const vy = -dx * uy + dy * ux;
      if (vy) {
        for (const edge of [-radius, radius]) {
          const t = (edge - y) / vy;
          const across = x + vx * t;
          if (across >= 0 && across <= length) {
            accept(t);
          }
        }
      }
    }
  }
  return Number.isFinite(entry) ? entry : null;
}

/** Layout clearance preserves live enemies and their combat identities without a defeat event. */
export function clearNeedleEnemies(flight: FlightState): void {
  const courses = activeNeedleCourses(flight);
  if (!courses.length) {
    return;
  }
  for (const object of flight.objects) {
    if (
      object.kind !== "enemy" ||
      !needleChannelContains({ radius: object.radius }, flight, object)
    ) {
      continue;
    }
    const candidates: Vec[] = [];
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const course of courses) {
      const radius = course.width / 2 + object.radius;
      const skin =
        Number.EPSILON * 32 * Math.max(1, Math.abs(object.x), Math.abs(object.y), radius);
      for (let index = 1; index < course.path.length; index++) {
        const a = course.path[index - 1]!;
        const b = course.path[index]!;
        left = Math.min(left, a.x - radius - skin, b.x - radius - skin);
        right = Math.max(right, a.x + radius + skin, b.x + radius + skin);
        top = Math.min(top, a.y - radius - skin, b.y - radius - skin);
        bottom = Math.max(bottom, a.y + radius + skin, b.y + radius + skin);
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (!length) {
          continue;
        }
        const nearest = closestOnSegment(object, a, b);
        for (const side of [-1, 1]) {
          candidates.push({
            x: nearest.x - ((b.y - a.y) / length) * (radius + skin) * side,
            y: nearest.y + ((b.x - a.x) / length) * (radius + skin) * side,
          });
        }
      }
    }
    candidates.push(
      { x: left, y: object.y },
      { x: right, y: object.y },
      { x: object.x, y: top },
      { x: object.x, y: bottom },
    );
    const target = candidates
      .filter((point) => !needleChannelContains({ radius: object.radius }, flight, point))
      .sort(
        (a, b) =>
          Math.hypot(a.x - object.x, a.y - object.y) - Math.hypot(b.x - object.x, b.y - object.y),
      )[0];
    if (!target) {
      continue;
    }
    object.x = target.x;
    object.y = target.y;
    if (object.enemy) {
      object.enemy.position = { ...target };
      if (needleChannelContains({ radius: object.radius }, flight, object.enemy.home)) {
        object.enemy.home = { ...target };
      }
    }
  }
}
