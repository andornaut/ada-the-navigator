import type { Vec } from "../model/types.ts";
import type { StationArt, StationFrame } from "./station-art.ts";

// Art's community-project world changes (art/projects.md "World changes"), placed by
// public/art/projects.json at the outposts. A replacement swaps the outpost's blink pair for its
// own; an overlay draws one small sprite at each anchor, behind or in front of the outpost. Every
// part blinks on the outpost's clock and keylines with it as one silhouette.

export type OverlayLayer = "behind" | "front";

export interface OverlayAnchor {
  readonly layer: OverlayLayer;
  /** 0 shows frame A while the outpost shows A; 1 shows the other frame. */
  readonly phase: 0 | 1;
  /** Frame px from the outpost's pivot. */
  readonly x: number;
  readonly y: number;
}

export type ProjectArt<T extends StationFrame = StationFrame> =
  | { readonly frames: readonly [T, T]; readonly kind: "replace"; readonly outpost: string }
  | {
      readonly anchors: readonly OverlayAnchor[];
      readonly frames: readonly [T, T];
      readonly kind: "overlay";
      readonly outpost: string;
    };

export interface ProjectArtSet<T extends StationFrame = StationFrame> {
  readonly projects: ReadonlyMap<string, ProjectArt<T>>;
  /** The reveal's fade length; its easing is cubicOut. */
  readonly revealMs: number;
}

/** One sprite of an outpost as drawn: its frame, its display px offset and its draw order. */
export interface OutpostPart<T extends StationFrame = StationFrame> {
  readonly frame: T;
  readonly offset: Vec;
  /** Negative draws behind the outpost, 0 is the outpost and positive draws in front. */
  readonly order: number;
}

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function framePair<T extends StationFrame>(
  assets: readonly T[],
  ids: unknown,
): readonly [T, T] | undefined {
  if (!Array.isArray(ids) || ids.length !== 2) {
    return undefined;
  }
  const [a, b] = ids.map((id) => assets.find((asset) => asset.id === id));
  return a && b && a.displayWidth! > 0 && b.displayWidth! > 0 ? [a, b] : undefined;
}

function readAnchor(value: unknown): OverlayAnchor | undefined {
  const anchor = fields(value);
  if (
    !anchor ||
    !finite(anchor.x) ||
    !finite(anchor.y) ||
    (anchor.layer !== "behind" && anchor.layer !== "front") ||
    (anchor.phase !== 0 && anchor.phase !== 1)
  ) {
    return undefined;
  }
  return { layer: anchor.layer, phase: anchor.phase, x: anchor.x, y: anchor.y };
}

function readProject<T extends StationFrame>(
  assets: readonly T[],
  outposts: ReadonlyMap<string, StationArt<T>>,
  value: unknown,
): ProjectArt<T> | undefined {
  const entry = fields(value);
  const outpost = typeof entry?.outpost === "string" ? outposts.get(entry.outpost) : undefined;
  const frames = framePair(assets, entry?.frames);
  if (!entry || !outpost || !frames) {
    return undefined;
  }
  if (entry.kind === "replace") {
    const replaces = entry.replaces;
    const matches =
      Array.isArray(replaces) &&
      replaces.length === 2 &&
      replaces[0] === outpost.frames[0].id &&
      replaces[1] === outpost.frames[1].id;
    return matches ? { frames, kind: "replace", outpost: entry.outpost as string } : undefined;
  }
  if (entry.kind === "overlay" && Array.isArray(entry.anchors) && entry.anchors.length > 0) {
    const anchors = entry.anchors.map(readAnchor);
    return anchors.every((anchor) => anchor !== undefined)
      ? { anchors, frames, kind: "overlay", outpost: entry.outpost as string }
      : undefined;
  }
  return undefined;
}

/**
 * projects.json's world changes for the outposts with art and loaded frames. A malformed project,
 * or one whose outpost keeps its placeholder, has no world art; a malformed or unsupported reveal
 * has none at all.
 */
export function readProjectArt<T extends StationFrame>(
  assets: readonly T[],
  outposts: ReadonlyMap<string, StationArt<T>>,
  value: unknown,
): ProjectArtSet<T> | undefined {
  const file = fields(value);
  const reveal = fields(file?.reveal);
  const projects = fields(file?.projects);
  if (
    !projects ||
    !finite(reveal?.durationMs) ||
    !(reveal.durationMs > 0) ||
    reveal.easing !== "cubicOut"
  ) {
    return undefined;
  }
  const art = new Map<string, ProjectArt<T>>();
  for (const [id, entry] of Object.entries(projects)) {
    const project = readProject(assets, outposts, entry);
    if (project) {
      art.set(id, project);
    }
  }
  return { projects: art, revealMs: reveal.durationMs };
}

/**
 * The outpost's sprites with the given changes, for blink frame `index` (0 is A): a replacement's
 * frame in place of the outpost's, then each overlay anchor's frame at its offset, scaled from
 * frame px by the outpost's display size. Behind parts come first and front parts last.
 */
export function outpostParts<T extends StationFrame>(
  outpost: StationArt<T>,
  changes: readonly ProjectArt<T>[],
  index: 0 | 1,
): OutpostPart<T>[] {
  const replacement = changes.find((change) => change.kind === "replace");
  const base = (replacement?.frames ?? outpost.frames)[index];
  const scale = outpost.frames[0].displayWidth! / outpost.frames[0].width;
  const behind: OutpostPart<T>[] = [];
  const front: OutpostPart<T>[] = [];
  for (const change of changes) {
    if (change.kind !== "overlay") {
      continue;
    }
    for (const anchor of change.anchors) {
      const part = {
        frame: change.frames[anchor.phase === 0 ? index : index === 0 ? 1 : 0],
        offset: { x: anchor.x * scale, y: anchor.y * scale },
      };
      (anchor.layer === "behind" ? behind : front).push({ ...part, order: 0 });
    }
  }
  return [
    ...behind.map((part, at) => ({ ...part, order: at - behind.length })),
    { frame: base, offset: { x: 0, y: 0 }, order: 0 },
    ...front.map((part, at) => ({ ...part, order: at + 1 })),
  ];
}

export interface Bounds {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

/** The parts' drawn extent in display px around the outpost's pivot. */
export function partsBounds(parts: readonly OutpostPart[]): Bounds {
  let bounds = { bottom: -Infinity, left: Infinity, right: -Infinity, top: Infinity };
  for (const { frame, offset } of parts) {
    const left = offset.x - frame.pivot.x * frame.displayWidth!;
    const top = offset.y - frame.pivot.y * frame.displayHeight!;
    bounds = {
      bottom: Math.max(bounds.bottom, top + frame.displayHeight!),
      left: Math.min(bounds.left, left),
      right: Math.max(bounds.right, left + frame.displayWidth!),
      top: Math.min(bounds.top, top),
    };
  }
  return bounds;
}

/** Whether any of the bounds around `point` overlaps the screen. */
export function boundsOnScreen(
  screen: { height: number; width: number },
  point: Vec,
  bounds: Bounds,
): boolean {
  return (
    point.x + bounds.right > 0 &&
    point.x + bounds.left < screen.width &&
    point.y + bounds.bottom > 0 &&
    point.y + bounds.top < screen.height
  );
}

/** The after state's opacity `elapsedMs` into the reveal: cubicOut, `1 - (1 - t)^3`. */
export function revealAlpha(revealMs: number, elapsedMs: number): number {
  const t = Math.min(1, Math.max(0, elapsedMs / revealMs));
  return 1 - (1 - t) ** 3;
}
