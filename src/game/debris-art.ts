import type { Vec } from "../model/types.ts";

// Art's traveling debris (art/cartwheel-props.md, art/whirlpool.md "River debris"): one
// `debris.json` layout per galaxy, each with one or more tumbling pieces.

export interface DebrisPiece {
  readonly display: { readonly height: number; readonly width: number };
  readonly frame: { readonly height: number; readonly width: number };
  /** Frame k's texture is the manifest entry `{id}-{k}`. */
  readonly frames: readonly {
    readonly bounds: readonly [number, number, number, number];
    readonly file: string;
  }[];
  readonly id: string;
  readonly pivot: Vec;
}

export interface DebrisArt {
  readonly contour: { readonly color: string; readonly width: number };
  readonly displayScale: number;
  readonly marks: {
    readonly color: string;
    readonly dashes: readonly { alpha: number; behind: number; length: number; side: number }[];
    readonly width: number;
  };
  readonly pieces: readonly DebrisPiece[];
  readonly tumble: { readonly degPerSecond: readonly [number, number] };
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;

function readPiece(value: unknown): DebrisPiece | undefined {
  const entry = fields(value);
  const frame = fields(entry?.frame);
  const display = fields(entry?.display);
  const pivot = entry?.pivot;
  const frames = Array.isArray(entry?.frames) ? (entry.frames as unknown[]).map(fields) : [];
  if (
    typeof entry?.id !== "string" ||
    !positive(frame?.width) ||
    !positive(frame.height) ||
    !positive(display?.width) ||
    !positive(display.height) ||
    !Array.isArray(pivot) ||
    pivot.length !== 2 ||
    !pivot.every(finite) ||
    !frames.length ||
    frames.some(
      (item) =>
        typeof item?.file !== "string" ||
        !Array.isArray(item.bounds) ||
        item.bounds.length !== 4 ||
        !item.bounds.every(finite),
    )
  ) {
    return undefined;
  }
  return {
    display: { height: display.height, width: display.width },
    frame: { height: frame.height, width: frame.width },
    frames: frames.map((item) => ({
      bounds: item!.bounds as [number, number, number, number],
      file: item!.file as string,
    })),
    id: entry.id,
    pivot: { x: pivot[0] as number, y: pivot[1] as number },
  };
}

/** A galaxy's traveling debris (`debris.json`, version 1), or undefined for the placeholder. */
export function readDebrisArt(value: unknown): DebrisArt | undefined {
  const root = fields(value);
  const marks = fields(root?.marks);
  const contour = fields(root?.contour);
  const rate = fields(root?.tumble)?.degPerSecond;
  const pieces = Array.isArray(root?.debris) ? (root.debris as unknown[]).map(readPiece) : [];
  const dashes = Array.isArray(marks?.dashes) ? (marks.dashes as unknown[]).map(fields) : [];
  if (
    root?.version !== 1 ||
    !positive(root.displayScale) ||
    typeof marks?.color !== "string" ||
    !positive(marks.width) ||
    !dashes.length ||
    dashes.some(
      (dash) => !dash || ![dash.alpha, dash.behind, dash.length, dash.side].every(finite),
    ) ||
    typeof contour?.color !== "string" ||
    !Array.isArray(rate) ||
    rate.length !== 2 ||
    !rate.every(positive) ||
    !pieces.length ||
    pieces.some((piece) => !piece)
  ) {
    return undefined;
  }
  return {
    contour: { color: contour.color, width: finite(contour.width) ? contour.width : 0 },
    displayScale: root.displayScale,
    marks: {
      color: marks.color,
      dashes: dashes.map((dash) => ({
        alpha: dash!.alpha as number,
        behind: dash!.behind as number,
        length: dash!.length as number,
        side: dash!.side as number,
      })),
      width: marks.width,
    },
    pieces: pieces as DebrisPiece[],
    tumble: { degPerSecond: [rate[0] as number, rate[1] as number] },
  };
}

function unit(id: string, salt: number): number {
  let n = salt;
  for (let i = 0; i < id.length; i++) {
    n = Math.imul(n ^ id.charCodeAt(i), 2654435761);
  }
  n = Math.imul(n ^ (n >>> 15), 2246822519);
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
}

/** A debris object's piece, chosen from its id so it keeps it through paging and saves. */
export function debrisPiece(art: DebrisArt, id: string): DebrisPiece {
  return art.pieces[Math.floor(unit(id, 0x2d6e) * art.pieces.length)]!;
}

/**
 * The tumble frame a piece shows `seconds` into flight: frame k is the piece turned
 * 360k / frames degrees, at a per-object rate within Art's range from a per-object phase.
 * Reduced motion shows frame 0.
 */
export function debrisFrame(
  art: DebrisArt,
  piece: DebrisPiece,
  id: string,
  reducedMotion: boolean,
  seconds: number,
): number {
  if (reducedMotion) {
    return 0;
  }
  const [slow, fast] = art.tumble.degPerSecond;
  const rate = slow + unit(id, 0x7a3b) * (fast - slow);
  const angle = unit(id, 0x19c4) * 360 + rate * seconds;
  const step = 360 / piece.frames.length;
  return Math.floor((((angle % 360) + 360) % 360) / step) % piece.frames.length;
}

/**
 * The direction mark's dashes in display px from the piece's pivot, along the reverse of its
 * screen velocity: each dash's centre sits its `behind` distance past the edge of the ellipse
 * with the current frame's bounds' half extents, `side` px to the left of travel.
 */
export function debrisMarks(
  art: DebrisArt,
  piece: DebrisPiece,
  frame: number,
  velocity: Vec,
): { alpha: number; from: Vec; to: Vec }[] {
  const length = Math.hypot(velocity.x, velocity.y);
  if (length === 0) {
    return [];
  }
  const back = { x: -velocity.x / length, y: -velocity.y / length };
  const left = { x: velocity.y / length, y: -velocity.x / length };
  const [minX, minY, maxX, maxY] = piece.frames[frame]!.bounds;
  const scale = art.displayScale;
  const centre = {
    x: ((minX + maxX) / 2 - piece.pivot.x * piece.frame.width) * scale,
    y: ((minY + maxY) / 2 - piece.pivot.y * piece.frame.height) * scale,
  };
  const a = ((maxX - minX) / 2) * scale;
  const b = ((maxY - minY) / 2) * scale;
  const edge = 1 / Math.hypot(back.x / a, back.y / b);
  return art.marks.dashes.map((dash) => {
    const middle = {
      x: centre.x + back.x * (edge + dash.behind) + left.x * dash.side,
      y: centre.y + back.y * (edge + dash.behind) + left.y * dash.side,
    };
    return {
      alpha: dash.alpha,
      from: { x: middle.x - (back.x * dash.length) / 2, y: middle.y - (back.y * dash.length) / 2 },
      to: { x: middle.x + (back.x * dash.length) / 2, y: middle.y + (back.y * dash.length) / 2 },
    };
  });
}
