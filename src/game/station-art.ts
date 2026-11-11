import type { ObjectKind, Vec } from "../model/types.ts";

/**
 * Placeholder destinations carry an in-world name; a station, an outpost or the holodisk reads
 * from its art alone.
 */
export function nameLabelled(kind: ObjectKind): boolean {
  return kind === "destination";
}

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

/** Both blink frames with a dock entrance, or undefined to keep the placeholder. */
function readBlinkArt<T extends StationFrame>(
  assets: readonly T[],
  idA: string,
  idB: string,
): StationArt<T> | undefined {
  const a = assets.find((asset) => asset.id === idA);
  const b = assets.find((asset) => asset.id === idB);
  if (!a?.dock || !b || !(a.frameMs! > 0) || !(a.width > 0) || !(a.displayWidth! > 0)) {
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
  if (reducedMotion) {
    return art.frames[0];
  }
  return art.frames[Math.floor(timeMs / art.frameMs) % 2 === 0 ? 0 : 1];
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
