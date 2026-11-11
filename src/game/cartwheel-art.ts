import type { SectorId } from "../data/types.ts";
import type { Vec } from "../model/types.ts";
import { ENEMY_HEADINGS, type EnemyArt, type EnemyFrame } from "./enemy-art.ts";
import { readShipJets } from "./ship-jets.ts";
import type { StationArt, StationFrame } from "./station-art.ts";
import { whaleFrameAsset } from "./whale-art.ts";

// Art's Cartwheel hub, mooring buoy, story craft and props (art/cartwheel.md,
// art/cartwheel-props.md), and which galaxy's flights load each asset.

export interface CartwheelAsset
  extends Omit<StationFrame, "displayHeight" | "displayWidth" | "id" | "pivot">, EnemyFrame {
  readonly craft?: string;
  readonly debris?: string;
  readonly destination?: string;
  readonly kind?: unknown;
  readonly moorings?: unknown;
  readonly overlay?: boolean;
  readonly path: string;
  readonly project?: string;
  readonly variant?: string;
}

/** A story craft heading frame: `craft-{craft}-{k}`, heading `k` of 16. */
export const STORY_CRAFT_FRAME = /^craft-([a-z][a-z0-9]*)-(\d+)$/;

/**
 * The galaxy whose flights load an asset, or null for the boot set: Cartwheel's hub, buoy,
 * story craft, ore nugget and traveling debris, and Whirlpool's whale frames. The stranded
 * craft load with the tow jobs that draw them, so neither set holds them yet.
 */
export function galaxyAsset(asset: CartwheelAsset): SectorId | "unused" | null {
  if (asset.id.startsWith("craft-stranded-")) {
    return "unused";
  }
  if (
    asset.destination === "hub" ||
    asset.id.startsWith("mooring-buoy-") ||
    STORY_CRAFT_FRAME.test(asset.id) ||
    asset.id === "ore-nugget" ||
    asset.debris !== undefined
  ) {
    return 2;
  }
  return whaleFrameAsset(asset) ? 3 : null;
}

/** Both blink frames of a fixed-facing prop, or undefined to keep its placeholder. */
function readBlink<T extends StationFrame>(
  a: T | undefined,
  b: T | undefined,
): StationArt<T> | undefined {
  if (!a || !b || !(a.frameMs! > 0) || !(a.width > 0) || !(a.displayWidth! > 0)) {
    return undefined;
  }
  return { frameMs: a.frameMs!, frames: [a, b] };
}

export interface HubArt<T extends StationFrame = StationFrame> {
  readonly bay?: StationArt<T>;
  readonly repaired?: StationArt<T>;
  readonly worn: StationArt<T>;
}

/**
 * The hub's frames, read by destination: the worn pair, the Hub repairs pair that replaces it
 * and the second docking bay overlay. Without the worn pair the hub keeps its placeholder.
 */
export function readHubArt<T extends CartwheelAsset>(assets: readonly T[]): HubArt<T> | undefined {
  const hub = assets.filter((asset) => asset.destination === "hub");
  const pair = (match: (asset: T) => boolean) => {
    const frames = hub.filter(match).sort((a, b) => a.id.localeCompare(b.id));
    return frames.length === 2 ? readBlink(frames[0], frames[1]) : undefined;
  };
  const worn = pair((asset) => asset.variant === "worn");
  if (!worn) {
    return undefined;
  }
  const repaired = pair((asset) => asset.variant === "repaired");
  const bay = pair((asset) => asset.overlay === true && asset.project === "second-docking-bay");
  return { worn, ...(repaired ? { repaired } : {}), ...(bay ? { bay } : {}) };
}

/** The hub's layers to draw, base then overlay, for its funded projects. */
export function hubLayers<T extends StationFrame>(
  art: HubArt<T>,
  worn: boolean,
  bay: boolean,
): StationArt<T>[] {
  const base = worn || !art.repaired ? art.worn : art.repaired;
  return bay && art.bay ? [base, art.bay] : [base];
}

/** The mooring buoy's blink pair, or undefined to draw none. */
export function readBuoyArt<T extends CartwheelAsset>(
  assets: readonly T[],
): StationArt<T> | undefined {
  const find = (id: string) => assets.find((asset) => asset.id === id);
  return readBlink(find("mooring-buoy-a"), find("mooring-buoy-b"));
}

/** Each story craft's 16 heading frames in heading order; a craft missing one is left out. */
export function craftFrameSets<T extends CartwheelAsset>(assets: readonly T[]): Map<string, T[]> {
  const sets = new Map<string, T[]>();
  for (const asset of assets) {
    const match = STORY_CRAFT_FRAME.exec(asset.id);
    if (!match || asset.directionIndex !== Number(match[2])) {
      continue;
    }
    const frames = sets.get(match[1]!) ?? [];
    frames[Number(match[2])] = asset;
    sets.set(match[1]!, frames);
  }
  for (const [craft, frames] of sets) {
    const holes = Array.from({ length: ENEMY_HEADINGS }, (_, k) => frames[k]).some(
      (frame) => !frame,
    );
    if (holes || frames.length !== ENEMY_HEADINGS) {
      sets.delete(craft);
    }
  }
  return sets;
}

/** A craft's frames and speed jets, in the enemy heading convention and jets schema. */
export function craftArt<T extends CartwheelAsset>(
  jets: (craft: string) => unknown,
  sets: ReadonlyMap<string, readonly T[]>,
): Map<string, EnemyArt<T>> {
  const art = new Map<string, EnemyArt<T>>();
  for (const [craft, frames] of sets) {
    const parsed = readShipJets(jets(craft));
    art.set(craft, {
      frames,
      jets: parsed?.headings.length === ENEMY_HEADINGS ? parsed : undefined,
    });
  }
  return art;
}

export interface DebrisArt {
  readonly contour: { readonly color: string; readonly width: number };
  readonly display: { readonly height: number; readonly width: number };
  readonly displayScale: number;
  readonly frame: { readonly height: number; readonly width: number };
  readonly frames: readonly {
    readonly bounds: readonly [number, number, number, number];
    readonly file: string;
  }[];
  readonly marks: {
    readonly color: string;
    readonly dashes: readonly { alpha: number; behind: number; length: number; side: number }[];
    readonly width: number;
  };
  readonly pivot: Vec;
  readonly tumble: { readonly degPerSecond: readonly [number, number] };
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;

/** Art's traveling debris (`debris.json`, version 1), or undefined to keep the placeholder. */
export function readDebrisArt(value: unknown): DebrisArt | undefined {
  const root = fields(value);
  const marks = fields(root?.marks);
  const tumble = fields(root?.tumble);
  const contour = fields(root?.contour);
  const entry = Array.isArray(root?.debris) ? fields(root.debris[0]) : undefined;
  const frame = fields(entry?.frame);
  const display = fields(entry?.display);
  const pivot = entry?.pivot;
  const rate = tumble?.degPerSecond;
  if (
    root?.version !== 1 ||
    !positive(root.displayScale) ||
    !marks ||
    !Array.isArray(marks.dashes) ||
    typeof marks.color !== "string" ||
    !positive(marks.width) ||
    !contour ||
    typeof contour.color !== "string" ||
    !Array.isArray(rate) ||
    !rate.every(positive) ||
    !frame ||
    !positive(frame.width) ||
    !positive(frame.height) ||
    !display ||
    !positive(display.width) ||
    !positive(display.height) ||
    !Array.isArray(pivot) ||
    !pivot.every(finite) ||
    !Array.isArray(entry?.frames) ||
    !entry.frames.length
  ) {
    return undefined;
  }
  const frames = (entry.frames as unknown[]).map(fields);
  const dashes = (marks.dashes as unknown[]).map(fields);
  if (
    frames.some(
      (item) =>
        typeof item?.file !== "string" ||
        !Array.isArray(item.bounds) ||
        item.bounds.length !== 4 ||
        !item.bounds.every(finite),
    ) ||
    dashes.some((dash) => !dash || ![dash.alpha, dash.behind, dash.length, dash.side].every(finite))
  ) {
    return undefined;
  }
  return {
    contour: { color: contour.color, width: finite(contour.width) ? contour.width : 0 },
    display: { height: display.height as number, width: display.width as number },
    displayScale: root.displayScale,
    frame: { height: frame.height as number, width: frame.width as number },
    frames: frames.map((item) => ({
      bounds: item!.bounds as [number, number, number, number],
      file: item!.file as string,
    })),
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
    pivot: { x: pivot[0] as number, y: pivot[1] as number },
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

/**
 * The tumble frame a piece shows `seconds` into flight: frame k is the plate turned 45k
 * degrees, at a per-piece rate within Art's range from a per-piece phase. Reduced motion shows
 * frame 0.
 */
export function debrisFrame(
  art: DebrisArt,
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
  const step = 360 / art.frames.length;
  return Math.floor((((angle % 360) + 360) % 360) / step) % art.frames.length;
}

/**
 * The direction mark's dashes in display px from the piece's pivot, along the reverse of its
 * screen velocity: each dash starts its `behind` distance past the edge of the ellipse with
 * the current frame's bounds' half extents (art/cartwheel-props.md "Direction mark").
 */
export function debrisMarks(
  art: DebrisArt,
  frame: number,
  velocity: Vec,
): { alpha: number; from: Vec; to: Vec }[] {
  const length = Math.hypot(velocity.x, velocity.y);
  if (length === 0) {
    return [];
  }
  const back = { x: -velocity.x / length, y: -velocity.y / length };
  const left = { x: velocity.y / length, y: -velocity.x / length };
  const [minX, minY, maxX, maxY] = art.frames[frame]!.bounds;
  const scale = art.displayScale;
  const centre = {
    x: ((minX + maxX) / 2 - art.pivot.x * art.frame.width) * scale,
    y: ((minY + maxY) / 2 - art.pivot.y * art.frame.height) * scale,
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
