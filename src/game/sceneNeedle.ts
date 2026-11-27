import { driftChipsFromBounds, playDepth } from "../art/index.ts";
import { NEEDLE } from "../data/needle.ts";
import { toScreen } from "../model/convex.ts";
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
import { COLOURS, UNLISTED_COLOURS } from "../ui/layout/colours.ts";

export interface NeedleStitch {
  readonly from: Vec;
  readonly to: Vec;
}

/** Edge dashes use projected logical lengths and keep their phase across polyline vertices. */
export function needleStitches(
  context: { readonly project: (point: Vec) => Vec },
  course: NeedleCourse,
): readonly NeedleStitch[] {
  const marks: NeedleStitch[] = [];
  const [on, off] = NEEDLE.channels.stitch.dash;
  const period = on! + off!;
  for (const side of [-1, 1]) {
    const edge = course.path.map((point, index) => {
      const before = course.path[Math.max(0, index - 1)]!;
      const after = course.path[Math.min(course.path.length - 1, index + 1)]!;
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      const length = Math.hypot(dx, dy);
      const across = side * (course.width / 2 - NEEDLE.channels.stitch.inset);
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
      for (let dash = Math.floor(arc / period) * period; dash < arc + length; dash += period) {
        const from = Math.max(0, dash - arc);
        const to = Math.min(length, dash + on! - arc);
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
      for (const course of frame.courses) {
        const stitch = NEEDLE.channels.stitch;
        context.ink.lineStyle(
          stitch.width,
          Number.parseInt(stitch.color.slice(1), 16),
          stitch.alpha,
        );
        for (const { from, to } of needleStitches(context, course)) {
          // Keep dashes crossing the viewport even when both endpoints lie just outside it.
          if (
            Math.max(from.x, to.x) >= 0 &&
            Math.max(from.y, to.y) >= 0 &&
            Math.min(from.x, to.x) <= context.viewport.width &&
            Math.min(from.y, to.y) <= context.viewport.height
          ) {
            context.ink.lineBetween(from.x, from.y, to.x, to.y);
          }
        }
        const lit = frame.lit(course);
        course.gates.forEach((gate, index) => {
          const at = context.project(gate.point);
          const size = NEEDLE.gate.frame * NEEDLE.gate.displayScale;
          if (!visible(at, size / 2)) {
            return;
          }
          const orientation = NEEDLE.gate.orientations.find(
            (o) => o.index === needleGateOrientation(gate),
          )!;
          const threading =
            Math.hypot(frame.player.x - gate.point.x, frame.player.y - gate.point.y) <=
            NEEDLE.gate.rim.outer;
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
        const at = context.project(object);
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
