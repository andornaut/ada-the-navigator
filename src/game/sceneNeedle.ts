import { NEEDLE } from "../data/needle.ts";
import {
  type NeedleCourse,
  type NeedleDebrisDescriptor,
  needleGateOrientation,
} from "../model/needle.ts";
import type { SpaceObject, Vec } from "../model/types.ts";
import { playDepth } from "./asteroidArt.ts";

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
}

export interface NeedleRenderContext {
  readonly add: { image(x: number, y: number, texture: string): NeedleImage };
  readonly ink: {
    lineBetween(x1: number, y1: number, x2: number, y2: number): unknown;
    lineStyle(width: number, color: number, alpha: number): unknown;
  };
  /** The caller supplies one coherent world image for each course, including at a seam. */
  readonly project: (position: Vec) => Vec;
  readonly textures: { exists(key: string): boolean };
  readonly viewport: { readonly width: number; readonly height: number };
}

export interface NeedleRenderFrame {
  readonly courses: readonly NeedleCourse[];
  readonly debris: readonly {
    readonly object: SpaceObject;
    readonly descriptor: NeedleDebrisDescriptor;
  }[];
  readonly lit: (course: NeedleCourse) => number;
  readonly player: Vec;
  readonly playerDepth: number;
  readonly reducedMotion: boolean;
  readonly slow: boolean;
  /** Paused flight time, not wall time, in milliseconds. */
  readonly timeMs: number;
}

interface GateFade {
  from: number;
  started: number;
  target: number;
}

const fadeAlpha = (now: number, fade: GateFade): number => {
  const t = Math.min(1, Math.max(0, (now - fade.started) / NEEDLE.gate.light.fadeMs));
  return fade.from + (fade.target - fade.from) * (1 - (1 - t) ** 3);
};

/** Own only current visible sprites and one fade record per current gate; the caller owns physics. */
export function createNeedleRenderer(context: NeedleRenderContext) {
  const images = new Map<string, NeedleImage>();
  const fades = new Map<string, GateFade>();
  let disposed = false;
  const clear = () => {
    for (const image of images.values()) {
      image.destroy();
    }
    images.clear();
    fades.clear();
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
      const currentGates = new Set<string>();
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
          const key = `${course.kind}:${index}`;
          currentGates.add(key);
          const target = index < lit || frame.slow ? 1 : 0;
          let fade = fades.get(key);
          if (!fade || frame.timeMs < fade.started) {
            fade = { from: target, started: frame.timeMs, target };
            fades.set(key, fade);
          } else if (fade.target !== target) {
            fade = { from: fadeAlpha(frame.timeMs, fade), started: frame.timeMs, target };
            fades.set(key, fade);
          }
          if (frame.reducedMotion) {
            fade.from = target;
            fade.started = frame.timeMs;
          }
          const alpha = frame.reducedMotion ? target : fadeAlpha(frame.timeMs, fade);
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
          for (const state of ["dark", "lit"] as const) {
            // Art's lit pair fades over the opaque dark pair, without fading out its support.
            const opacity = state === "lit" ? alpha : 1;
            if (opacity <= 0) {
              continue;
            }
            for (const layer of ["back", "front"] as const) {
              const texture = orientation.files[state][layer];
              if (!context.textures.exists(texture)) {
                continue;
              }
              const depth = threading
                ? frame.playerDepth + (layer === "front" ? 1e-6 : -5e-6)
                : playDepth(at.y) + (layer === "front" ? 1e-7 : -1e-7);
              place(
                `gate:${key}:${state}:${layer}`,
                texture,
                at,
                size,
                size,
                { x: 0.5, y: 0.5 },
                depth,
                opacity,
              );
            }
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
          place(
            `debris:${object.id}`,
            texture,
            at,
            piece.display,
            piece.display,
            { x: piece.pivot[0]!, y: piece.pivot[1]! },
            playDepth(at.y),
            1,
          );
        }
      }
      for (const [key, image] of images) {
        if (!used.has(key)) {
          image.destroy();
          images.delete(key);
        }
      }
      for (const key of fades.keys()) {
        if (!currentGates.has(key)) {
          fades.delete(key);
        }
      }
      return handled;
    },
  };
}
