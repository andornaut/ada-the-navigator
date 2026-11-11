import type { SectorId } from "../data/types.ts";
import { ENEMY_HEADINGS, type EnemyArt, type EnemyFrame, enemyPartFrame } from "./enemy-art.ts";
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
 * story craft, ore nugget, traveling debris and claim jumper hulls, and Whirlpool's whale
 * frames and river debris. Claim part frames load when their craft first appears. Cartwheel's
 * stranded craft load with it, for its rescue jobs.
 */
export function galaxyAsset(asset: CartwheelAsset): SectorId | null {
  if (
    asset.id.startsWith("craft-stranded-") ||
    asset.destination === "hub" ||
    asset.id.startsWith("mooring-buoy-") ||
    STORY_CRAFT_FRAME.test(asset.id) ||
    asset.id === "ore-nugget" ||
    asset.id.startsWith("cartwheel-debris-") ||
    (asset.family === "claim" && !enemyPartFrame(asset))
  ) {
    return 2;
  }
  return whaleFrameAsset(asset) || asset.id.startsWith("whirlpool-") ? 3 : null;
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

/**
 * Cartwheel's project ids, as saved progress stores them, to the `project` keys on Art's hub
 * entries (art/cartwheel.md "Placement anchors").
 */
export const HUB_PROJECT_ART = {
  dockingBay: "second-docking-bay",
  hubRepairs: "hub-repairs",
} as const satisfies Readonly<Record<string, string>>;

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
  const repaired = pair(
    (asset) => asset.variant === "repaired" && asset.project === HUB_PROJECT_ART.hubRepairs,
  );
  const bay = pair(
    (asset) => asset.overlay === true && asset.project === HUB_PROJECT_ART.dockingBay,
  );
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
