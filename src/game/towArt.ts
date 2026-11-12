import type { GalaxyNumber } from "../data/types.ts";
import type { Vec } from "../model/types.ts";
import { ENEMY_HEADINGS } from "./enemyArt.ts";
import { shipDirection } from "./shipArt.ts";
import type { StationFrame } from "./stationArt.ts";

// Art's stranded craft and tow line (art/cartwheel-props.md "Stranded craft", "Tow line"): each
// galaxy's craft drawn at the 16 enemy headings, facing Ada, from that galaxy's tow.json, and a
// steel cable Tech draws from core's tow.json.

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
  readonly beads: {
    readonly color: string;
    readonly radius: number;
    readonly spacing: number;
    readonly start: number;
  };
  readonly cap: readonly { readonly color: string; readonly radius: number }[];
  /** Outer stroke first, then the core. */
  readonly layers: readonly { readonly color: string; readonly width: number }[];
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
const disc = (value: unknown): value is { color: string; radius: number } =>
  typeof fields(value)?.color === "string" && finite(fields(value)?.radius);

/** The tow line from `tow.json` (version 1), or undefined to keep the placeholder line. */
export function readTowLine(value: unknown): TowLine | undefined {
  const root = fields(value);
  const line = fields(root?.line);
  const beads = fields(line?.beads);
  const layers = line?.layers;
  const cap = line?.cap;
  if (
    root?.version !== 1 ||
    !Array.isArray(layers) ||
    layers.length === 0 ||
    !layers.every(
      (layer) => typeof fields(layer)?.color === "string" && finite(fields(layer)?.width),
    ) ||
    !Array.isArray(cap) ||
    !cap.every(disc) ||
    typeof beads?.color !== "string" ||
    !finite(beads.radius) ||
    !finite(beads.spacing) ||
    !(beads.spacing > 0) ||
    !finite(beads.start)
  ) {
    return undefined;
  }
  return {
    beads: { color: beads.color, radius: beads.radius, spacing: beads.spacing, start: beads.start },
    cap: cap.map(({ color, radius }) => ({ color, radius })),
    layers: (layers as { color: string; width: number }[]).map(({ color, width }) => ({
      color,
      width,
    })),
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

/** Bead centres along a screen polyline from Ada to the craft: every spacing from the craft end. */
export function towBeads(beads: TowLine["beads"], points: readonly Vec[]): Vec[] {
  const from = [...points].reverse();
  const result: Vec[] = [];
  let next = beads.start;
  let travelled = 0;
  for (let index = 1; index < from.length; index++) {
    const a = from[index - 1]!;
    const b = from[index]!;
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    const end = travelled + segment;
    if (segment === 0) {
      continue;
    }
    while (next <= end) {
      const t = (next - travelled) / segment;
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      next += beads.spacing;
    }
    travelled += segment;
  }
  return result;
}
