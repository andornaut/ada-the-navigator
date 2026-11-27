import { driftChipsFromBounds, playDepth } from "../art/index.ts";
import { NEEDLE } from "../data/needle.ts";
import { toScreen } from "../model/convex.ts";
import { flightWorldContext } from "../model/flightTopology.ts";
import {
  activeNeedleCourses,
  type NeedleCourse,
  needleDebris,
  type NeedleDebrisDescriptor,
  needleGateOrientation,
  needleGateReadiness,
  type NeedleProgress,
  unfinishedNeedleCourse,
} from "../model/needle.ts";
import type { FlightState, SpaceObject, Vec } from "../model/types.ts";
import { type WorldContext, worldPoint } from "../model/worldContacts.ts";
import { COLOURS, UNLISTED_COLOURS } from "../ui/layout/colours.ts";

/** A course uses one local world image for every gate, stitch and lamp. */
export function needleCourseOffset(
  course: Pick<NeedleCourse, "path">,
  player: Vec,
  world: WorldContext,
): Vec {
  const start = course.path[0];
  if (!start) {
    return { x: 0, y: 0 };
  }
  const local = worldPoint(world, player, start);
  return { x: local.x - start.x, y: local.y - start.y };
}

export interface NeedleStitch {
  readonly from: Vec;
  readonly to: Vec;
}

function visibleStitchSpan(
  from: Vec,
  to: Vec,
  viewport: { readonly width: number; readonly height: number },
  padding: number,
): readonly [number, number] | null {
  let first = 0;
  let last = 1;
  for (const [start, end, limit] of [
    [from.x, to.x, viewport.width],
    [from.y, to.y, viewport.height],
  ] as const) {
    const delta = end - start;
    if (delta === 0) {
      if (start < -padding || start > limit + padding) {
        return null;
      }
      continue;
    }
    const a = (-padding - start) / delta;
    const b = (limit + padding - start) / delta;
    first = Math.max(first, Math.min(a, b));
    last = Math.min(last, Math.max(a, b));
    if (first >= last) {
      return null;
    }
  }
  return [first, last];
}

/** Edge dashes use projected logical lengths and keep their phase across polyline vertices. */
export function needleStitches(
  context: {
    readonly project: (point: Vec) => Vec;
    readonly viewport?: { readonly width: number; readonly height: number };
  },
  course: NeedleCourse,
): readonly NeedleStitch[] {
  const marks: NeedleStitch[] = [];
  const {
    dash: [on, off],
    inset,
    keyline,
  } = NEEDLE.channels.stitch;
  const period = on! + off!;
  for (const side of [-1, 1]) {
    const edge = course.path.map((point, index) => {
      const before = course.path[Math.max(0, index - 1)]!;
      const after = course.path[Math.min(course.path.length - 1, index + 1)]!;
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      const length = Math.hypot(dx, dy);
      const across = side * (course.width / 2 - inset);
      return context.project({
        x: point.x - (length ? dy / length : 0) * across,
        y: point.y + (length ? dx / length : 0) * across,
      });
    });
    let arc = 0;
    for (let index = 1; index < edge.length; index++) {
      const a = edge[index - 1]!;
      const b = edge[index]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const span = context.viewport
        ? visibleStitchSpan(a, b, context.viewport, keyline.width / 2)
        : ([0, 1] as const);
      if (!length || !span) {
        arc += length;
        continue;
      }
      const start = span[0] * length;
      const end = span[1] * length;
      for (
        let dash = Math.floor((arc + start) / period) * period;
        dash < arc + end;
        dash += period
      ) {
        const from = Math.max(start, dash - arc);
        const to = Math.min(end, dash + on! - arc);
        if (to > from) {
          marks.push({
            from: { x: a.x + (dx * from) / length, y: a.y + (dy * from) / length },
            to: { x: a.x + (dx * to) / length, y: a.y + (dy * to) / length },
          });
        }
      }
      arc += length;
    }
  }
  return marks;
}

/** Structural Phaser image surface, so the renderer needs no runtime scene import. */
export interface NeedleImage {
  destroy(): void;
  setAlpha(alpha: number): this;
  setDepth(depth: number): this;
  setDisplaySize(width: number, height: number): this;
  setOrigin(x: number, y: number): this;
  setPosition(x: number, y: number): this;
  setTexture(texture: string): this;
  setTint(colour: number): this;
}

export interface NeedleRenderContext {
  readonly add: { image(x: number, y: number, texture: string): NeedleImage };
  /** The scene's current canonical stone chip colour. */
  readonly chipColor: number;
  readonly ink: {
    fillRect(x: number, y: number, width: number, height: number): unknown;
    fillStyle(color: number, alpha: number): unknown;
    lineBetween(x1: number, y1: number, x2: number, y2: number): unknown;
    lineStyle(width: number, color: number, alpha: number): unknown;
  };
  /**
   * Records a drawn image of a keylined kind for this frame's light-field keyline; each gate
   * layer and channel debris piece keylines in its own depth slot.
   */
  readonly keyline?: (kind: "debris" | "needleGate", key: string, image: NeedleImage) => void;
  /** The caller supplies one coherent world image for each course, including at a seam. */
  readonly project: (position: Vec) => Vec;
  readonly textures: { exists(key: string): boolean };
  readonly viewport: { readonly width: number; readonly height: number };
}

export interface NeedleRenderFrame {
  readonly activeCourse: ReturnType<typeof unfinishedNeedleCourse>;
  readonly courses: readonly NeedleCourse[];
  readonly debris: readonly {
    readonly object: SpaceObject;
    readonly descriptor: NeedleDebrisDescriptor;
  }[];
  readonly lit: (course: NeedleCourse) => number;
  readonly player: Vec;
  readonly playerDepth: number;
  readonly readiness: ReturnType<typeof needleGateReadiness>;
  readonly reducedMotion: boolean;
  readonly seed: number;
  /** Paused flight time, not wall time, in milliseconds. */
  readonly timeMs: number;
  readonly world?: WorldContext;
}

const debrisByCourse = new WeakMap<
  NeedleCourse,
  { readonly seed: number; readonly descriptors: ReadonlyMap<string, NeedleDebrisDescriptor> }
>();

/** Join authored descriptors to live bodies without reviving destroyed or unloaded debris. */
export function needleRenderFrame(
  context: {
    readonly activityLit: number;
    readonly playerDepth: number;
    readonly progress: Readonly<NeedleProgress> | undefined;
    readonly reducedMotion: boolean;
    readonly topSpeed: number;
  },
  flight: FlightState,
): NeedleRenderFrame | null {
  const courses = flight.galaxy === 4 ? activeNeedleCourses(flight) : [];
  if (!courses.length) {
    return null;
  }
  const rosters = courses.map((course) => {
    let held = debrisByCourse.get(course);
    if (!held || held.seed !== flight.seed) {
      held = {
        descriptors: new Map(needleDebris(course, flight.seed).map((entry) => [entry.id, entry])),
        seed: flight.seed,
      };
      debrisByCourse.set(course, held);
    }
    return held.descriptors;
  });
  const debris: NeedleRenderFrame["debris"][number][] = [];
  for (const object of flight.objects) {
    if (object.kind !== "debris") {
      continue;
    }
    for (const roster of rosters) {
      const descriptor = roster.get(object.id);
      if (descriptor) {
        debris.push({ descriptor, object });
        break;
      }
    }
  }
  return {
    activeCourse: unfinishedNeedleCourse(context.progress),
    courses,
    debris,
    lit: (course) =>
      course.kind === "practice"
        ? (context.progress?.practiceLit ?? 0)
        : course.kind === "eye"
          ? (context.progress?.eyeLit ?? 0)
          : context.activityLit,
    player: flight.player,
    playerDepth: context.playerDepth,
    readiness: needleGateReadiness({ topSpeed: context.topSpeed, velocity: flight.velocity }),
    reducedMotion: context.reducedMotion,
    seed: flight.seed,
    timeMs: flight.time * 1000,
    world: flightWorldContext(flight),
  };
}

const hex = (colour: string) => Number.parseInt(colour.slice(1), 16);
const gateTint = {
  green: hex(COLOURS.momTab),
  red: hex(COLOURS.refusalRed),
  yellow: hex(UNLISTED_COLOURS.mapWorkshop),
};
const untinted = hex(COLOURS.white);

/** Own only current visible sprites; the caller owns physics. */
export function createNeedleRenderer(context: NeedleRenderContext) {
  const images = new Map<string, NeedleImage>();
  let disposed = false;
  const clear = () => {
    for (const image of images.values()) {
      image.destroy();
    }
    images.clear();
  };
  const visible = (position: Vec, radius: number): boolean =>
    position.x + radius >= 0 &&
    position.y + radius >= 0 &&
    position.x - radius <= context.viewport.width &&
    position.y - radius <= context.viewport.height;

  return {
    clear,
    dispose(): void {
      clear();
      disposed = true;
    },
    draw(frame: NeedleRenderFrame): ReadonlySet<string> {
      const handled = new Set<string>();
      if (disposed) {
        return handled;
      }
      const used = new Set<string>();
      const place = (
        key: string,
        texture: string,
        at: Vec,
        width: number,
        height: number,
        pivot: Vec,
        depth: number,
        alpha: number,
      ) => {
        used.add(key);
        let image = images.get(key);
        if (!image) {
          image = context.add.image(at.x, at.y, texture);
          images.set(key, image);
        }
        image
          .setTexture(texture)
          .setPosition(at.x, at.y)
          .setDisplaySize(width, height)
          .setOrigin(pivot.x, pivot.y)
          .setDepth(depth)
          .setAlpha(alpha);
        return image;
      };
      const stitch = NEEDLE.channels.stitch;
      const shifts = new Map(
        frame.courses.map((course) => [
          course,
          needleCourseOffset(course, frame.player, frame.world ?? {}),
        ]),
      );
      const coursePoint = (course: NeedleCourse, point: Vec): Vec => {
        const offset = shifts.get(course)!;
        return { x: point.x + offset.x, y: point.y + offset.y };
      };
      const dashes = frame.courses.flatMap((course) =>
        needleStitches(
          {
            project: (point) => context.project(coursePoint(course, point)),
            viewport: context.viewport,
          },
          course,
        ),
      );
      if (dashes.length) {
        for (const [width, colour, alpha] of [
          [stitch.keyline.width, stitch.keyline.color, 1],
          [stitch.width, stitch.color, stitch.alpha],
        ] as const) {
          context.ink.lineStyle(width, hex(colour), alpha);
          for (const { from, to } of dashes) {
            context.ink.lineBetween(from.x, from.y, to.x, to.y);
          }
        }
      }
      for (const course of frame.courses) {
        const lit = frame.lit(course);
        course.gates.forEach((gate, index) => {
          const point = coursePoint(course, gate.point);
          const at = context.project(point);
          const size = NEEDLE.gate.frame * NEEDLE.gate.displayScale;
          if (!visible(at, size / 2)) {
            return;
          }
          const orientation = NEEDLE.gate.orientations.find(
            (o) => o.index === needleGateOrientation(gate),
          )!;
          const threading =
            Math.hypot(frame.player.x - point.x, frame.player.y - point.y) <= NEEDLE.gate.rim.outer;
          const next =
            index === lit && (course.kind === frame.activeCourse || course.kind === "activity");
          const { dark, lit: litPair } = orientation.files;
          const useLit =
            (next || index < lit) &&
            context.textures.exists(litPair.back) &&
            context.textures.exists(litPair.front);
          const pair = useLit ? litPair : dark;
          const tint = next && useLit ? gateTint[frame.readiness] : untinted;
          for (const layer of ["back", "front"] as const) {
            const texture = pair[layer];
            if (!context.textures.exists(texture)) {
              continue;
            }
            const depth = threading
              ? frame.playerDepth + (layer === "front" ? 1e-6 : -5e-6)
              : playDepth(at.y) + (layer === "front" ? 1e-7 : -1e-7);
            const id = `gate:${course.kind}:${index}:${layer}`;
            const image = place(id, texture, at, size, size, { x: 0.5, y: 0.5 }, depth, 1);
            image.setTint(tint);
            context.keyline?.("needleGate", `needle:${id}`, image);
          }
        });
      }
      for (const { descriptor, object } of frame.debris) {
        const piece = NEEDLE.channels.debris.pieces.find((p) => p.id === descriptor.piece);
        if (!piece) {
          continue;
        }
        const angle =
          descriptor.tumblePhase + (descriptor.tumbleDegreesPerSecond * frame.timeMs) / 1000;
        const index = frame.reducedMotion
          ? 0
          : Math.floor(((((angle % 360) + 360) % 360) * piece.frames.length) / 360);
        const texture = `${piece.id}-${index}`;
        if (!context.textures.exists(texture)) {
          continue;
        }
        handled.add(object.id);
        const point = object.id.startsWith("needle:activity:")
          ? worldPoint(frame.world ?? {}, frame.player, object)
          : object;
        const at = context.project(point);
        if (visible(at, piece.display / 2)) {
          if (NEEDLE.channels.debris.cue === "asteroid" && object.velocity) {
            const [left, top, right, bottom] = piece.frames[index]!.bounds;
            const scale = piece.display / piece.frame;
            const bounds = {
              bottom: (bottom! - piece.pivot[1]! * piece.frame) * scale,
              left: (left! - piece.pivot[0]! * piece.frame) * scale,
              right: (right! - piece.pivot[0]! * piece.frame) * scale,
              top: (top! - piece.pivot[1]! * piece.frame) * scale,
            };
            const behind = toScreen({ x: -object.velocity.x, y: -object.velocity.y });
            for (const chip of driftChipsFromBounds(
              { behind, id: object.id, seed: frame.seed },
              bounds,
            )) {
              context.ink.fillStyle(context.chipColor, chip.alpha);
              context.ink.fillRect(
                at.x + chip.x - chip.size / 2,
                at.y + chip.y - chip.size / 2,
                chip.size,
                chip.size,
              );
            }
          }
          const image = place(
            `debris:${object.id}`,
            texture,
            at,
            piece.display,
            piece.display,
            { x: piece.pivot[0]!, y: piece.pivot[1]! },
            playDepth(at.y),
            1,
          );
          context.keyline?.("debris", `needle:debris:${object.id}`, image);
        }
      }
      for (const [key, image] of images) {
        if (!used.has(key)) {
          image.destroy();
          images.delete(key);
        }
      }
      return handled;
    },
  };
}
