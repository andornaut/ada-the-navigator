import platform from "../../public/art/cartwheel/enemies/platform-hardpoints.json" with { type: "json" };
import capital from "../../public/art/enemies/capital-hardpoints.json" with { type: "json" };
import frigate from "../../public/art/enemies/frigate-hardpoints.json" with { type: "json" };
import gadget from "../../public/art/enemies/gadget-hardpoints.json" with { type: "json" };
import type { EnemyArchetype, EnemyDefinition, Point } from "./enemy-catalog.ts";

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
 * tips, and the top each mount carries by weapon, the null key for a hardpoint's own top.
 */
export interface MuzzleArt {
  carries: ReadonlyMap<string, ReadonlyMap<string | null, CarriedTop>>;
  frame: number;
  pivots: ReadonlyMap<string, readonly Point[]>;
  tops: ReadonlyMap<string, readonly (readonly Point[])[]>;
}

/** Art draws every enemy frame at this many display px per frame px (art/enemies.md). */
export const ENEMY_DISPLAY_SCALE = 0.4375;

interface HardpointsFile {
  frame: number;
  headings: { hardpoints: { id: string; pivot?: number[] }[]; index: number }[];
  hardpoints: { id: string; top: string | null }[];
  tiers?: { mounts: Record<string, { aim: string; top: string; weapon: string } | null> }[];
  tops: Record<string, { index: number; muzzles: number[][] }[]>;
}

const point = ([x, y]: readonly number[]): Point => ({ x: x!, y: y! });

/** Each turret's pivots, each top's barrel tips and each mount's top by weapon. */
export function readMuzzleArt(file: HardpointsFile): MuzzleArt {
  const half = file.frame / 2;
  const carries = new Map<string, Map<string | null, CarriedTop>>();
  const carry = (id: string) => carries.get(id) ?? carries.set(id, new Map()).get(id)!;
  for (const part of file.hardpoints) {
    if (part.top) {
      carry(part.id).set(null, { aft: false, top: part.top });
    }
  }
  for (const tier of file.tiers ?? []) {
    for (const [id, mount] of Object.entries(tier.mounts)) {
      if (mount) {
        carry(id).set(mount.weapon, { aft: mount.aim === "aft", top: mount.top });
      }
    }
  }
  const pivots = new Map<string, Point[]>();
  for (const id of carries.keys()) {
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
  return { carries, frame: file.frame, pivots, tops };
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
 * The definition's turrets as drawn: each weapon hardpoint fires from the top its weapon draws on
 * that mount (art/heavies.md "Weapon tops"), or the hardpoint's own top. Undefined without Art's
 * mounts, which keeps every shot at the model origin.
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
    const carries = art.carries.get(part.id);
    const carried =
      part.kind === "weapon"
        ? (carries?.get(part.fire.weapon) ?? carries?.get(null))
        : carries?.get(null);
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
