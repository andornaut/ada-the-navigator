import type { Vec } from "../model/types.ts";

// Art's station sprite (art/station.md): two fixed-facing blink frames and a dock entrance.

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
export function readStationArt<T extends StationFrame>(
  assets: readonly T[],
): StationArt<T> | undefined {
  const a = assets.find((asset) => asset.id === "station-a");
  const b = assets.find((asset) => asset.id === "station-b");
  if (!a?.dock || !b || !(a.frameMs! > 0) || !(a.width > 0) || !(a.displayWidth! > 0)) {
    return undefined;
  }
  return { frameMs: a.frameMs!, frames: [a, b] };
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
 * The dock entrance as a world offset from the station's pivot and a world unit outward
 * direction, from the frame-px dock point scaled by the display size.
 */
export function stationDockWorld(frame: StationFrame): { offset: Vec; outward: Vec } | undefined {
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
  return { offset, outward: { x: out.x / length, y: out.y / length } };
}
