import ring from "../../public/art/andromeda/enemies/hostileStation-andromeda-hardpoints.json" with { type: "json" };
import platform from "../../public/art/cartwheel/enemies/platform-hardpoints.json" with { type: "json" };
import capital from "../../public/art/enemies/fleetCapital-hardpoints.json" with { type: "json" };
import capitalBroad from "../../public/art/enemies/fleetCapitalBroad-hardpoints.json" with { type: "json" };
import capitalCrossbow from "../../public/art/enemies/fleetCapitalCrossbow-hardpoints.json" with { type: "json" };
import capitalForked from "../../public/art/enemies/fleetCapitalForked-hardpoints.json" with { type: "json" };
import capitalManta from "../../public/art/enemies/fleetCapitalManta-hardpoints.json" with { type: "json" };
import capitalOutrigger from "../../public/art/enemies/fleetCapitalOutrigger-hardpoints.json" with { type: "json" };
import frigate from "../../public/art/enemies/fleetFrigate-hardpoints.json" with { type: "json" };
import frigateTwin from "../../public/art/enemies/fleetFrigateTwin-hardpoints.json" with { type: "json" };
import retaliator from "../../public/art/enemies/fleetRetaliator-hardpoints.json" with { type: "json" };
import cargo from "../../public/art/enemies/fleetRetaliatorCargoHauler-hardpoints.json" with { type: "json" };
import mining from "../../public/art/enemies/fleetRetaliatorMiningFreighter-hardpoints.json" with { type: "json" };
import gadget from "../../public/art/enemies/gadget-hardpoints.json" with { type: "json" };
import station from "../../public/art/enemies/hostileStation-hardpoints.json" with { type: "json" };
import phantomStation from "../../public/art/enemies/hostileStation-phantom-hardpoints.json" with { type: "json" };
import type { EnemyDefinition, Point } from "./enemyCatalog.ts";
import { type EnemyGeometryKey } from "./enemyIdentity.ts";

/** One turret's drawn pivot per hull heading and its top design's barrel tips. */
export interface MuzzleTurret {
  /** The top holds aim `(k + 8) mod 16` at hull heading k rather than turning with the aim. */
  aft: boolean;
  /** Projected top pivot per hull heading, hull frame px about the hull's centre. */
  pivots: readonly Point[];
  /** Barrel tips per aim index, frame px relative to the pivot. */
  tips: readonly (readonly Point[])[];
}

/** An archetype's drawn turrets in hull frame px; display px are `frame * ENEMY_DISPLAY_SCALE`. */
export interface MuzzleLayout {
  frame: number;
  primary?: MuzzleTurret;
  turrets: ReadonlyMap<string, MuzzleTurret>;
}

/** The top a mount draws for a weapon, and whether it holds the aft aim. */
interface CarriedTop {
  aft: boolean;
  top: string;
}

/**
 * An archetype's drawn mounts from Art's hardpoints file: each turret's pivots, each top design's
 * tips, each hardpoint's own top and the top each weapon draws on an armed mount.
 */
export interface MuzzleArt {
  anchors: ReadonlyMap<string, readonly Point[]>;
  frame: number;
  own: ReadonlyMap<string, CarriedTop>;
  pivots: ReadonlyMap<string, readonly Point[]>;
  tops: ReadonlyMap<string, readonly (readonly Point[])[]>;
  weaponTops: ReadonlyMap<string, CarriedTop>;
}

/** Art draws every enemy frame at this many display px per frame px (art/enemies.md). */
export const ENEMY_DISPLAY_SCALE = 0.4375;

interface HardpointsFile {
  fill?: string[];
  frame: number;
  headings: { hardpoints: { id: string; pivot?: number[]; anchor?: number[] }[]; index: number }[];
  hardpoints: { id: string; top: string | null }[];
  tops: Record<string, { index: number; muzzles: number[][] }[]>;
  weaponTops?: Record<string, { aim: string; top: string }>;
}

const point = ([x, y]: readonly number[]): Point => ({ x: x!, y: y! });

/** Each turret's pivots, each top's barrel tips, each hardpoint's own top and each weapon's. */
export function readMuzzleArt(file: HardpointsFile): MuzzleArt {
  const half = file.frame / 2;
  const own = new Map<string, CarriedTop>();
  const anchors = new Map<string, Point[]>();
  for (const part of file.hardpoints) {
    if (part.top) {
      own.set(part.id, { aft: false, top: part.top });
    }
  }
  const weaponTops = new Map(
    Object.entries(file.weaponTops ?? {}).map(([weapon, { aim, top }]) => [
      weapon,
      { aft: aim === "aft", top },
    ]),
  );
  const pivots = new Map<string, Point[]>();
  for (const id of new Set([
    ...own.keys(),
    ...(file.fill ?? []),
    ...file.hardpoints.map((part) => part.id),
  ])) {
    const placedAnchors: Point[] = [];
    for (const heading of file.headings) {
      const anchor = heading.hardpoints.find((entry) => entry.id === id)?.anchor;
      if (anchor) {
        placedAnchors[heading.index] = { x: anchor[0]! - half, y: anchor[1]! - half };
      }
    }
    anchors.set(id, placedAnchors);
    const placed: Point[] = [];
    for (const heading of file.headings) {
      const pivot = heading.hardpoints.find((entry) => entry.id === id)?.pivot;
      if (pivot) {
        placed[heading.index] = { x: pivot[0]! - half, y: pivot[1]! - half };
      }
    }
    pivots.set(id, placed);
  }
  const tops = new Map<string, Point[][]>();
  for (const [design, aims] of Object.entries(file.tops)) {
    const tips: Point[][] = [];
    for (const aim of aims) {
      tips[aim.index] = aim.muzzles.map(point);
    }
    tops.set(design, tips);
  }
  return { anchors, frame: file.frame, own, pivots, tops, weaponTops };
}

/** Art's drawn mounts for every archetype with a hardpoints file, Gadget's capital included. */
export const MUZZLE_ART: Partial<Record<EnemyGeometryKey, MuzzleArt>> = {
  capital: readMuzzleArt(capital),
  capitalBroad: readMuzzleArt(capitalBroad),
  capitalCrossbow: readMuzzleArt(capitalCrossbow),
  capitalForked: readMuzzleArt(capitalForked),
  capitalManta: readMuzzleArt(capitalManta),
  capitalOutrigger: readMuzzleArt(capitalOutrigger),
  frigate: readMuzzleArt(frigate),
  frigateTwin: readMuzzleArt(frigateTwin),
  gadget: readMuzzleArt(gadget),
  hostileStation: readMuzzleArt(station),
  hostileStationAndromeda: readMuzzleArt(ring),
  hostileStationPhantom: readMuzzleArt(phantomStation),
  platform: readMuzzleArt(platform),
  retaliator: readMuzzleArt(retaliator),
  retaliatorCargoHauler: readMuzzleArt(cargo),
  retaliatorMiningFreighter: readMuzzleArt(mining),
};

export function muzzleArtForDefinition(
  definition: Pick<EnemyDefinition, "assetKey">,
): MuzzleArt | undefined {
  return definition.assetKey === undefined ? undefined : MUZZLE_ART[definition.assetKey];
}

const LAYOUTS = new WeakMap<object, Map<MuzzleArt, MuzzleLayout>>();
/**
 * The definition's turrets as drawn: each weapon hardpoint fires from its weapon's top
 * (art/heavies.md "Weapon tops"), or the hardpoint's own top. Undefined without Art's mounts,
 * which keeps every shot at the model origin.
 */
export function muzzleLayout(
  definition: Pick<EnemyDefinition, "hardpoints">,
  art: MuzzleArt | undefined,
): MuzzleLayout | undefined {
  if (!art) {
    return undefined;
  }
  const cached = LAYOUTS.get(definition)?.get(art);
  if (cached) {
    return cached;
  }
  const turrets = new Map<string, MuzzleTurret>();
  for (const part of definition.hardpoints) {
    const carried =
      (part.kind === "weapon" ? art.weaponTops.get(part.fire.weapon) : undefined) ??
      art.own.get(part.id);
    const tips = carried && art.tops.get(carried.top);
    if (carried && tips) {
      turrets.set(part.id, { aft: carried.aft, pivots: art.pivots.get(part.id)!, tips });
    }
  }
  const primary =
    definition.hardpoints.length === 0 && art.own.size === 1
      ? [...art.own].flatMap(([id, carried]) => {
          const tips = art.tops.get(carried.top);
          return tips ? [{ aft: carried.aft, pivots: art.pivots.get(id)!, tips }] : [];
        })[0]
      : undefined;
  const layout = { frame: art.frame, ...(primary ? { primary } : {}), turrets };
  const byArt = LAYOUTS.get(definition) ?? new Map<MuzzleArt, MuzzleLayout>();
  LAYOUTS.set(definition, byArt.set(art, layout));
  return layout;
}
