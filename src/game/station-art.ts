import type { Vec } from "../model/types.ts";

// Art's station (art/station.md) and outposts (art/outposts.md): two fixed-facing blink frames
// and a dock entrance.

export interface StationFrame {
  readonly displayHeight?: number;
  readonly displayWidth?: number;
  readonly dock?: {
    readonly outward: readonly [number, number];
    readonly width: number;
    readonly x: number;
    readonly y: number;
  };
  readonly frameMs?: number;
  readonly height: number;
  readonly id: string;
  readonly pivot: Vec;
  readonly width: number;
}

export interface StationArt<T extends StationFrame = StationFrame> {
  /** Frame A then frame B. */
  readonly frames: readonly [T, T];
  readonly frameMs: number;
}

/** A galaxy station frame: A/B blink frames by id, or animated frames by `frameIndex`. */
export interface GalaxyStationFrame extends StationFrame {
  readonly destination?: string;
  readonly frameIndex?: number;
  readonly overlay?: boolean;
  readonly project?: string;
  readonly station?: string;
}

/** A station's frames in order, shown in turn for frameMs each (art/destinations.md). */
export interface StationLoop<T extends StationFrame = StationFrame> {
  readonly frames: readonly [T, ...T[]];
  readonly frameMs: number;
}

/**
 * A galaxy's own station art: its base loop, and a replacement loop per project that swaps it
 * in once funded (Needle's Loom hall).
 */
export interface GalaxyStationArt<T extends StationFrame = StationFrame> {
  readonly base: StationLoop<T>;
  readonly projects: ReadonlyMap<string, StationLoop<T>>;
}

/**
 * A galaxy manifest's station art, or undefined to draw the shared station: its entries with
 * `destination` "station" or a `station` name, else Cartwheel's mining hub frames (`destination`
 * "hub", the art its seeded stations draw), overlays left out, grouped by `project` (none is the
 * base). A group with `frameIndex` loops its frames in that order (the Eddy, the Bobbin); one
 * without is an A/B blink ordered by id.
 */
export function readGalaxyStationArt<T extends GalaxyStationFrame>(
  assets: readonly T[],
): GalaxyStationArt<T> | undefined {
  return (
    readStationGroups(
      assets,
      (asset) => asset.destination === "station" || asset.station !== undefined,
    ) ?? readStationGroups(assets, (asset) => asset.destination === "hub")
  );
}

function readStationGroups<T extends GalaxyStationFrame>(
  assets: readonly T[],
  station: (asset: T) => boolean,
): GalaxyStationArt<T> | undefined {
  const groups = new Map<string, T[]>();
  for (const asset of assets) {
    if (station(asset) && !asset.overlay) {
      const key = asset.project ?? "";
      groups.set(key, [...(groups.get(key) ?? []), asset]);
    }
  }
  const loop = (frames: readonly T[] | undefined): StationLoop<T> | undefined => {
    if (!frames || frames.length < 2) {
      return undefined;
    }
    const indexed = frames.every((frame) => Number.isInteger(frame.frameIndex));
    const ordered = [...frames].sort((a, b) =>
      indexed ? a.frameIndex! - b.frameIndex! : a.id.localeCompare(b.id),
    );
    const [first, ...rest] = ordered;
    if (
      !first ||
      !(first.frameMs! > 0) ||
      !ordered.every((frame) => frame.width > 0 && frame.displayWidth! > 0) ||
      (indexed && !ordered.every((frame, index) => frame.frameIndex === index))
    ) {
      return undefined;
    }
    return { frameMs: first.frameMs!, frames: [first, ...rest] };
  };
  const base = loop(groups.get(""));
  if (!base) {
    return undefined;
  }
  const projects = new Map<string, StationLoop<T>>();
  for (const [project, frames] of groups) {
    const art = project && loop(frames);
    if (art) {
      projects.set(project, art);
    }
  }
  return { base, projects };
}

/** A station loop's frame: frame k for frameMs each, looping; reduced motion holds frame 0. */
export function stationLoopFrame<T extends StationFrame>(
  art: StationLoop<T>,
  reducedMotion: boolean,
  timeMs: number,
): T {
  const index = reducedMotion ? 0 : Math.floor(timeMs / art.frameMs) % art.frames.length;
  return art.frames[index] ?? art.frames[0];
}

/** Both blink frames, or undefined to keep the placeholder. */
function readBlinkArt<T extends StationFrame>(
  assets: readonly T[],
  idA: string,
  idB: string,
): StationArt<T> | undefined {
  const a = assets.find((asset) => asset.id === idA);
  const b = assets.find((asset) => asset.id === idB);
  if (!a || !b || !(a.frameMs! > 0) || !(a.width > 0) || !(a.displayWidth! > 0)) {
    return undefined;
  }
  return { frameMs: a.frameMs!, frames: [a, b] };
}

export function readStationArt<T extends StationFrame>(
  assets: readonly T[],
): StationArt<T> | undefined {
  return readBlinkArt(assets, "station-a", "station-b");
}

/**
 * Art's sector one outposts (art/outposts.md) in the station schema, keyed by their `outpost`
 * role, which is the destination id. A role missing either frame keeps its placeholder.
 */
export function readOutpostArt<T extends StationFrame & { readonly outpost?: string }>(
  assets: readonly T[],
): ReadonlyMap<string, StationArt<T>> {
  const art = new Map<string, StationArt<T>>();
  for (const role of new Set(assets.flatMap((asset) => asset.outpost ?? []))) {
    const blink = readBlinkArt(assets, `outpost-${role}-a`, `outpost-${role}-b`);
    if (blink) {
      art.set(role, blink);
    }
  }
  return art;
}

/** The blink alternates A and B each frameMs; reduced motion holds A. */
export function stationFrame<T extends StationFrame>(
  art: StationArt<T>,
  reducedMotion: boolean,
  timeMs: number,
): T {
  return art.frames[stationFrameIndex(art, reducedMotion, timeMs)];
}

/** The blink's frame index: 0 for A, 1 for B. */
export function stationFrameIndex(
  art: Pick<StationArt, "frameMs">,
  reducedMotion: boolean,
  timeMs: number,
): 0 | 1 {
  return reducedMotion || Math.floor(timeMs / art.frameMs) % 2 === 0 ? 0 : 1;
}

/** Screen display px to world units under the view's 2:1 projection. */
function screenToWorld(screen: Vec): Vec {
  return { x: screen.y + screen.x / 2, y: screen.y - screen.x / 2 };
}

/**
 * The dock entrance as a world offset from the station's pivot, a world unit outward
 * direction and the mouth circle's world radius, from the frame-px dock point and mouth
 * width scaled by the display size. The mouth lies on the world plane, so its drawn width is
 * a world circle's screen width, 2 sqrt 2 times its radius under the 2:1 projection.
 */
export function stationDockWorld(
  frame: StationFrame,
): { mouthRadius: number; offset: Vec; outward: Vec } | undefined {
  if (!frame.dock) {
    return undefined;
  }
  const scale = (frame.displayWidth ?? frame.width) / frame.width;
  const offset = screenToWorld({
    x: (frame.dock.x - frame.pivot.x * frame.width) * scale,
    y: (frame.dock.y - frame.pivot.y * frame.height) * scale,
  });
  const out = screenToWorld({ x: frame.dock.outward[0], y: frame.dock.outward[1] });
  const length = Math.hypot(out.x, out.y);
  const mouthRadius = (frame.dock.width * scale) / (2 * Math.SQRT2);
  return { mouthRadius, offset, outward: { x: out.x / length, y: out.y / length } };
}
