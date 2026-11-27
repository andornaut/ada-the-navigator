import type { Vec } from "../model/types.ts";
import type { StationArt, StationFrame } from "./stationArt.ts";

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

export interface PlacedProjectArt<T> {
  readonly frames: readonly [T, T];
  readonly frameMs: number;
  readonly offset: Vec;
}

export interface PathProjectArt<T> {
  readonly frames: readonly [T, T];
  readonly frameMs: number;
  readonly anchors: {
    readonly start: number;
    readonly spacing: number;
    readonly inset: number;
    readonly sides: readonly [-1, 1];
  };
}

export type WorldProjectArt<T extends StationFrame> =
  | { readonly kind: "overlay"; readonly frame: T }
  | ({ readonly kind: "path" } & PathProjectArt<T>)
  | {
      readonly kind: "stationOverlay";
      readonly overlay: Extract<ProjectArt<T>, { kind: "overlay" }>;
    }
  | ({ readonly kind: "placed" } & PlacedProjectArt<T>);

export interface ProjectArtSet<T extends StationFrame = StationFrame> {
  readonly world: ReadonlyMap<string, WorldProjectArt<T>>;
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

function framePair<T extends { readonly id: string; readonly displayWidth?: number }>(
  assets: readonly T[],
  ids: unknown,
): readonly [T, T] | undefined {
  if (!Array.isArray(ids) || ids.length !== 2) {
    return undefined;
  }
  const [a, b] = ids.map((id) => assets.find((asset) => asset.id === id));
  return a && b && a.displayWidth! > 0 && b.displayWidth! > 0 ? [a, b] : undefined;
}

/** A fixed overlay's offset is in world units from its authored reference. */
export function readPlacedProject<
  T extends {
    readonly id: string;
    readonly displayWidth?: number;
    readonly displayHeight?: number;
  },
>(assets: readonly T[], value: unknown): PlacedProjectArt<T> | undefined {
  const entry = fields(value);
  const frames = framePair(assets, entry?.frames);
  const offset = entry?.offset;
  if (
    !frames?.every((frame) => finite(frame.displayHeight) && frame.displayHeight > 0) ||
    !finite(entry?.frameMs) ||
    entry.frameMs <= 0 ||
    !Array.isArray(offset) ||
    offset.length !== 2 ||
    !finite(offset[0]) ||
    !finite(offset[1])
  ) {
    return undefined;
  }
  return { frameMs: entry.frameMs, frames, offset: { x: offset[0], y: offset[1] } };
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
  const anchors = readOverlayAnchors(entry.anchors);
  return entry.kind === "overlay" && anchors
    ? { anchors, frames, kind: "overlay", outpost: entry.outpost as string }
    : undefined;
}

function readOverlayAnchors(value: unknown): readonly OverlayAnchor[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  const anchors = value.map(readAnchor);
  return anchors.every((anchor) => anchor !== undefined) ? anchors : undefined;
}

function readPathProject<T extends StationFrame>(
  frames: readonly [T, T],
  value: unknown,
): PathProjectArt<T> | undefined {
  const anchors = fields(value);
  const frameMs = frames[0].frameMs;
  if (
    !finite(frameMs) ||
    frameMs <= 0 ||
    frames[1].frameMs !== frameMs ||
    !finite(anchors?.start) ||
    anchors.start < 0 ||
    !finite(anchors.spacing) ||
    anchors.spacing <= 0 ||
    !finite(anchors.inset) ||
    anchors.inset < 0 ||
    !Array.isArray(anchors.sides) ||
    anchors.sides.length !== 2 ||
    anchors.sides[0] !== -1 ||
    anchors.sides[1] !== 1 ||
    anchors.phase !== "alternate"
  ) {
    return undefined;
  }
  return {
    anchors: {
      inset: anchors.inset,
      sides: [-1, 1],
      spacing: anchors.spacing,
      start: anchors.start,
    },
    frameMs,
    frames,
  };
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
  const world = new Map<string, WorldProjectArt<T>>();
  for (const [id, entry] of Object.entries(projects)) {
    const spec = fields(entry);
    if (id === "practiceBerth" || id === "routeExchange") {
      const matches =
        spec?.kind === "overlay" &&
        (id === "practiceBerth"
          ? spec.galaxy === "needle" &&
            spec.site === "needlePractice" &&
            spec.reference === undefined
          : spec.galaxy === "andromeda" &&
            spec.site === "pip" &&
            spec.reference === "andromeda.settlement");
      const placed = matches && readPlacedProject(assets, entry);
      if (placed) {
        world.set(id, { kind: "placed", ...placed });
      }
      continue;
    }
    const frames = framePair(assets, spec?.frames);
    if (
      id === "courierSchool" &&
      spec?.station === "settlers" &&
      spec.kind === "overlay" &&
      frames
    ) {
      const anchors = readOverlayAnchors(spec.anchors);
      if (anchors) {
        world.set(id, {
          kind: "stationOverlay",
          overlay: { anchors, frames, kind: "overlay", outpost: "settlers" },
        });
      }
      continue;
    }
    if (
      id === "spareBeacon" &&
      spec?.kind === "overlay" &&
      spec.outpost === undefined &&
      spec.beacon === "guide" &&
      spec.state === "relit" &&
      frames?.[0].id === "beacon-guide-spare-a"
    ) {
      world.set(id, { frame: frames[0], kind: "overlay" });
      continue;
    }
    if (
      id === "channelLights" &&
      spec?.kind === "path" &&
      spec.galaxy === "needle" &&
      spec.path === "practice" &&
      frames
    ) {
      const path = readPathProject(frames, spec.anchors);
      if (path) {
        world.set(id, { ...path, kind: "path" });
      }
      continue;
    }
    const project = readProject(assets, outposts, entry);
    if (project) {
      art.set(id, project);
    }
  }
  return { projects: art, revealMs: reveal.durationMs, world };
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
