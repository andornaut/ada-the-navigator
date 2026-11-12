import platform from "../../public/art/cartwheel/enemies/platform-hardpoints.json" with { type: "json" };
import capital from "../../public/art/enemies/capital-hardpoints.json" with { type: "json" };
import frigate from "../../public/art/enemies/frigate-hardpoints.json" with { type: "json" };
import gadget from "../../public/art/enemies/gadget-hardpoints.json" with { type: "json" };
import type { EnemyArchetype, EnemyDefinition, Point } from "./enemyCatalog.ts";

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
  headings: { hardpoints: { id: string; pivot?: number[] }[]; index: number }[];
  hardpoints: { id: string; top: string | null }[];
  tops: Record<string, { index: number; muzzles: number[][] }[]>;
  weaponTops?: Record<string, { aim: string; top: string }>;
}

const point = ([x, y]: readonly number[]): Point => ({ x: x!, y: y! });

/** Each turret's pivots, each top's barrel tips, each hardpoint's own top and each weapon's. */
export function readMuzzleArt(file: HardpointsFile): MuzzleArt {
  const half = file.frame / 2;
  const own = new Map<string, CarriedTop>();
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
  for (const id of new Set([...own.keys(), ...(file.fill ?? [])])) {
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
  return { frame: file.frame, own, pivots, tops, weaponTops };
}

/** Art's drawn mounts for every archetype with a hardpoints file, Gadget's capital included. */
export const MUZZLE_ART: Partial<Record<EnemyArchetype | "gadget", MuzzleArt>> = {
  capital: readMuzzleArt(capital),
  frigate: readMuzzleArt(frigate),
  gadget: readMuzzleArt(gadget),
  platform: readMuzzleArt(platform),
};

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
  const layout = { frame: art.frame, turrets };
  const byArt = LAYOUTS.get(definition) ?? new Map<MuzzleArt, MuzzleLayout>();
  LAYOUTS.set(definition, byArt.set(art, layout));
  return layout;
}
