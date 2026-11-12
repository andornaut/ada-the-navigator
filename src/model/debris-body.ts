import cartwheel from "../../public/art/cartwheel/debris.json" with { type: "json" };
import whirlpool from "../../public/art/whirlpool/debris.json" with { type: "json" };
import type { SectorId } from "../data/types.ts";
import type { Silhouette } from "./asteroids.ts";
import { partsReach } from "./convex.ts";
import type { SpaceObject } from "./types.ts";

// Art's traveling debris as drawn (art/cartwheel-props.md, art/whirlpool.md "River debris"):
// each piece's tumble frames carry their silhouettes as convex parts in the piece's frame px.

/** A stable value in [0, 1) for an id and a salt. */
function unit(id: string, salt: number): number {
  let n = salt;
  for (let i = 0; i < id.length; i++) {
    n = Math.imul(n ^ id.charCodeAt(i), 2654435761);
  }
  n = Math.imul(n ^ (n >>> 15), 2246822519);
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
}

/** The piece of `count` a debris object draws, chosen from its id. */
export function debrisPieceIndex(count: number, id: string): number {
  return Math.floor(unit(id, 0x2d6e) * count);
}

/**
 * The tumble frame of `count` a piece shows `seconds` into flight: frame k is the piece turned
 * 360k / count degrees, at a per-object rate within `degPerSecond` from a per-object phase.
 * Reduced motion shows frame 0.
 */
export function debrisFrameIndex(
  degPerSecond: readonly [number, number],
  count: number,
  id: string,
  reducedMotion: boolean,
  seconds: number,
): number {
  if (reducedMotion) {
    return 0;
  }
  const [slow, fast] = degPerSecond;
  const rate = slow + unit(id, 0x7a3b) * (fast - slow);
  const angle = unit(id, 0x19c4) * 360 + rate * seconds;
  const step = 360 / count;
  return Math.floor((((angle % 360) + 360) % 360) / step) % count;
}

interface DebrisFile {
  displayScale: number;
  tumble: { degPerSecond: number[] };
  debris: {
    frame: { width: number; height: number };
    display: { width: number; height: number };
    pivot: number[];
    frames: { collision?: number[][][] }[];
  }[];
}

interface DebrisOutlines {
  readonly degPerSecond: readonly [number, number];
  readonly pieces: readonly Silhouette[];
}

/** A galaxy's debris pieces as silhouettes in display px from the pivot, or undefined. */
function readOutlines(file: DebrisFile): DebrisOutlines | undefined {
  const pieces: Silhouette[] = [];
  for (const piece of file.debris) {
    const scaleX = piece.display.width / piece.frame.width;
    const scaleY = piece.display.height / piece.frame.height;
    const originX = piece.pivot[0]! * piece.frame.width;
    const originY = piece.pivot[1]! * piece.frame.height;
    if (!piece.frames.length || piece.frames.some((frame) => !frame.collision?.length)) {
      return undefined;
    }
    const frames = piece.frames.map((frame) =>
      frame.collision!.map((part) =>
        part.map(([x, y]) => ({ x: (x! - originX) * scaleX, y: (y! - originY) * scaleY })),
      ),
    );
    pieces.push({ frames, reach: Math.max(...frames.map(partsReach)) });
  }
  const [slow, fast] = file.tumble.degPerSecond;
  return pieces.length && slow !== undefined && fast !== undefined
    ? { degPerSecond: [slow, fast], pieces }
    : undefined;
}

const OUTLINES = new Map<SectorId, DebrisOutlines>();
for (const [sector, file] of [
  [2, cartwheel],
  [3, whirlpool],
] as const) {
  const outlines = readOutlines(file as DebrisFile);
  if (outlines) {
    OUTLINES.set(sector, outlines);
  }
}

/**
 * The silhouette a traveling debris object is drawn with in its galaxy, its piece's; null for a
 * galaxy without debris art, which keeps the debris circle.
 */
export function debrisSilhouette(sector: SectorId, object: SpaceObject): Silhouette | null {
  const outlines = OUTLINES.get(sector);
  if (
    !outlines ||
    object.kind !== "debris" ||
    object.asteroid ||
    !object.velocity ||
    object.orbit
  ) {
    return null;
  }
  return outlines.pieces[debrisPieceIndex(outlines.pieces.length, object.id)] ?? null;
}

/** The tumble frame a traveling debris object shows and collides with now. */
export function debrisFrameOf(
  sector: SectorId,
  object: SpaceObject,
  reducedMotion: boolean,
  seconds: number,
): number {
  const outlines = OUTLINES.get(sector);
  const piece = debrisSilhouette(sector, object);
  return outlines && piece
    ? debrisFrameIndex(
        outlines.degPerSecond,
        piece.frames.length,
        object.id,
        reducedMotion,
        seconds,
      )
    : 0;
}
