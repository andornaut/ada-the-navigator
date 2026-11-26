import { shipDirection } from "../art/shipArt.ts";
import type { StationFrame } from "../art/stationArt.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { Vec } from "../model/types.ts";
import { ENEMY_HEADINGS } from "./enemyArt.ts";

// Art's stranded craft and tow line (art/cartwheel-props.md "Stranded craft", "Tow line"): each
// galaxy's craft drawn at the 16 enemy headings, facing Ada, from that galaxy's tow.json, and a
// steel cable with a clamp block at the craft end that Tech draws from core's tow.json.

/**
 * Each galaxy's rescue pool items (gameplay/quests.md "Job pool") to Art's stranded craft ids,
 * by galaxy since one item names a different craft in each ("a pod").
 */
export const STRANDED_CRAFT: Readonly<
  Partial<Record<GalaxyNumber, Readonly<Record<string, string>>>>
> = {
  1: { "a scrap barge": "stranded-scrap-barge", "a seed pod": "stranded-seed-pod" },
  2: { "a stuck hauler": "stranded-hauler", "an ore pod": "stranded-ore-pod" },
  3: { "a current skimmer": "stranded-current-skimmer", "a pod": "stranded-whirlpool-pod" },
  4: { "a pod": "stranded-needle-pod", "a stuck glider": "stranded-glider" },
  5: { "a drifting lamp buoy": "stranded-lamp-buoy", "a lost courier": "stranded-courier" },
  6: { "a traveler's pod": "stranded-traveler-pod" },
};

/** The stranded craft id for a galaxy's rescue item, or undefined. */
export function strandedCraftId(galaxy: GalaxyNumber, item: string): string | undefined {
  const craft = STRANDED_CRAFT[galaxy];
  return craft && Object.hasOwn(craft, item) ? craft[item] : undefined;
}

export interface TowFrame extends StationFrame {
  readonly blink?: string;
  readonly craft?: string;
  readonly directionIndex?: number;
}

export interface TowLine {
  /**
   * The block at the craft end: `before` px toward Ada and `after` px past the tow point along
   * the line, `across` px wide, with a lit `face` band `depth` px deep along its upper edge.
   */
  readonly clamp: {
    readonly across: number;
    readonly after: number;
    readonly before: number;
    readonly color: string;
    readonly face: { readonly color: string; readonly depth: number };
  };
  /** Outer stroke first, then the core. */
  readonly layers: readonly { readonly color: string; readonly width: number }[];
  /** The ink stroke width under the cable on a light field. */
  readonly lightInk: number;
}

export interface StrandedCraftArt<T extends TowFrame = TowFrame> {
  /** Per heading `k`: its blink pair (lit, dim), or its one frame. */
  readonly frames: readonly (readonly T[])[];
  readonly frameMs: number;
  /** Per heading `k`: the tow point in that frame's px. */
  readonly tow: readonly Vec[];
}

export interface TowArt<T extends TowFrame = TowFrame> {
  readonly craft: ReadonlyMap<string, StrandedCraftArt<T>>;
  readonly line: TowLine;
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;

/** The tow line from `tow.json` (version 1), or undefined to keep the placeholder line. */
export function readTowLine(value: unknown): TowLine | undefined {
  const root = fields(value);
  const line = fields(root?.line);
  const clamp = fields(line?.clamp);
  const face = fields(clamp?.face);
  const layers = line?.layers;
  if (
    root?.version !== 1 ||
    !Array.isArray(layers) ||
    layers.length === 0 ||
    !layers.every(
      (layer) => typeof fields(layer)?.color === "string" && positive(fields(layer)?.width),
    ) ||
    !positive(line?.lightInk) ||
    typeof clamp?.color !== "string" ||
    !finite(clamp.before) ||
    !finite(clamp.after) ||
    !(clamp.before + clamp.after > 0) ||
    !positive(clamp.across) ||
    typeof face?.color !== "string" ||
    !positive(face.depth) ||
    face.depth > clamp.across
  ) {
    return undefined;
  }
  return {
    clamp: {
      across: clamp.across,
      after: clamp.after,
      before: clamp.before,
      color: clamp.color,
      face: { color: face.color, depth: face.depth },
    },
    layers: (layers as { color: string; width: number }[]).map(({ color, width }) => ({
      color,
      width,
    })),
    lightInk: line.lightInk,
  };
}

/**
 * Each stranded craft with all 16 headings loaded and a tow point per heading; a craft missing
 * a frame or its `tow.json` entry is left out and keeps the placeholder.
 */
export function readStrandedCraft<T extends TowFrame>(
  value: unknown,
  assets: readonly T[],
): Map<string, StrandedCraftArt<T>> {
  const craft = new Map<string, StrandedCraftArt<T>>();
  const entries = fields(value)?.craft;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const spec = fields(entry);
    if (!spec) {
      continue;
    }
    const id = spec.id;
    const headings = spec.headings;
    if (typeof id !== "string" || !Array.isArray(headings)) {
      continue;
    }
    const blink = Array.isArray(spec.blink) ? (spec.blink as unknown[]) : null;
    const tow: Vec[] = [];
    const frames: T[][] = [];
    for (let k = 0; k < ENEMY_HEADINGS; k++) {
      const point = fields(headings.find((heading) => fields(heading)?.index === k))?.tow;
      const own = assets.filter((asset) => asset.craft === id && asset.directionIndex === k);
      const set = blink
        ? blink.map((name) => own.find((asset) => asset.blink === name))
        : own.slice(0, 1);
      if (
        !Array.isArray(point) ||
        !finite(point[0]) ||
        !finite(point[1]) ||
        set.length === 0 ||
        !set.every((frame): frame is T => frame !== undefined && frame.width > 0)
      ) {
        break;
      }
      tow.push({ x: point[0], y: point[1] });
      frames.push(set);
    }
    const frameMs = finite(spec.frameMs) && spec.frameMs > 0 ? spec.frameMs : 0;
    if (frames.length === ENEMY_HEADINGS && (!blink || frameMs > 0)) {
      craft.set(id, { frameMs, frames, tow });
    }
  }
  return craft;
}

/** The craft's heading toward Ada: k faces world angle 22.5k degrees. */
export function craftHeading(craft: Vec, player: Vec): number {
  return shipDirection(ENEMY_HEADINGS, { x: player.x - craft.x, y: player.y - craft.y });
}

/** The heading's frame: the lit frame, then the dim one, each `frameMs`; reduced motion lit. */
export function craftFrame<T extends TowFrame>(
  art: StrandedCraftArt<T>,
  heading: number,
  reducedMotion: boolean,
  timeMs: number,
): T {
  const set = art.frames[heading]!;
  const dim = !reducedMotion && set.length > 1 && Math.floor(timeMs / art.frameMs) % 2 === 1;
  return set[dim ? 1 : 0]!;
}

/** The tow point's offset from the craft's pivot in display px. */
export function towOffset(art: StrandedCraftArt, frame: TowFrame, heading: number): Vec {
  const point = art.tow[heading]!;
  const scale = frame.displayWidth! / frame.width;
  return {
    x: (point.x - frame.pivot.x * frame.width) * scale,
    y: (point.y - frame.pivot.y * frame.height) * scale,
  };
}

/**
 * The line's world points from Ada to the craft: straight when taut, else a quadratic whose
 * middle sags sqrt(3 d (L - d) / 8) from the chord, on the side away from Ada's sideways
 * velocity, or toward screen-down (world +x +y) when she has none.
 */
export function towCurve(
  length: number,
  velocity: Vec,
  player: Vec,
  craft: Vec,
  count = 16,
): Vec[] {
  const dx = craft.x - player.x;
  const dy = craft.y - player.y;
  const chord = Math.hypot(dx, dy);
  const sag = chord > 0 && chord < length ? Math.sqrt((3 * chord * (length - chord)) / 8) : 0;
  let normal = chord > 0 ? { x: -dy / chord, y: dx / chord } : { x: 0, y: 0 };
  const sideways = velocity.x * normal.x + velocity.y * normal.y;
  // Screen y grows with world x + y.
  const away = sideways !== 0 ? -Math.sign(sideways) : normal.x + normal.y >= 0 ? 1 : -1;
  normal = { x: normal.x * away, y: normal.y * away };
  const control = {
    x: (player.x + craft.x) / 2 + normal.x * 2 * sag,
    y: (player.y + craft.y) / 2 + normal.y * 2 * sag,
  };
  return Array.from({ length: count + 1 }, (_, index) => {
    const t = index / count;
    const a = (1 - t) ** 2;
    const b = 2 * t * (1 - t);
    const c = t ** 2;
    return {
      x: a * player.x + b * control.x + c * craft.x,
      y: a * player.y + b * control.y + c * craft.y,
    };
  });
}

/**
 * The clamp block at the craft end of a screen polyline from Ada to the craft, and its lit face
 * along the block's screen-upper edge, each as four screen points.
 */
export function towClamp(
  clamp: TowLine["clamp"],
  points: readonly Vec[],
): { block: Vec[]; face: Vec[] } {
  const end = points[points.length - 1] ?? { x: 0, y: 0 };
  const from = [...points].reverse().find((point) => point.x !== end.x || point.y !== end.y);
  const length = from ? Math.hypot(end.x - from.x, end.y - from.y) : 0;
  const along =
    from && length > 0
      ? { x: (end.x - from.x) / length, y: (end.y - from.y) / length }
      : { x: 1, y: 0 };
  // The across direction that points screen-up (or left, for a vertical line).
  let up = { x: along.y, y: -along.x };
  if (up.y > 0 || (up.y === 0 && up.x > 0)) {
    up = { x: -up.x, y: -up.y };
  }
  const at = (u: number, v: number): Vec => ({
    x: end.x + along.x * u + up.x * v,
    y: end.y + along.y * u + up.y * v,
  });
  const half = clamp.across / 2;
  const rect = (low: number, high: number) => [
    at(-clamp.before, low),
    at(clamp.after, low),
    at(clamp.after, high),
    at(-clamp.before, high),
  ];
  return { block: rect(-half, half), face: rect(half - clamp.face.depth, half) };
}
