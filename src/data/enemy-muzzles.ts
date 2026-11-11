import capital from "../../public/art/enemies/capital-hardpoints.json" with { type: "json" };
import frigate from "../../public/art/enemies/frigate-hardpoints.json" with { type: "json" };
import type { EnemyArchetype, Point } from "./enemy-catalog.ts";

/** One turret's drawn pivot per hull heading and its top design, from Art's hardpoints file. */
export interface MuzzleTurret {
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

/** Art draws every enemy frame at this many display px per frame px (art/enemies.md). */
export const ENEMY_DISPLAY_SCALE = 0.4375;

interface HardpointsFile {
  frame: number;
  headings: { hardpoints: { id: string; pivot?: number[] }[]; index: number }[];
  hardpoints: { id: string; top: string | null }[];
  tops: Record<string, { index: number; muzzles: number[][] }[]>;
}

const point = ([x, y]: readonly number[]): Point => ({ x: x!, y: y! });

/** Each turret's pivots and barrel tips from Art's `{archetype}-hardpoints.json`. */
export function readMuzzleLayout(file: HardpointsFile): MuzzleLayout {
  const half = file.frame / 2;
  const turrets = new Map<string, MuzzleTurret>();
  for (const part of file.hardpoints) {
    if (!part.top) {
      continue;
    }
    const pivots: Point[] = [];
    for (const heading of file.headings) {
      const pivot = heading.hardpoints.find((entry) => entry.id === part.id)?.pivot;
      if (pivot) {
        pivots[heading.index] = { x: pivot[0]! - half, y: pivot[1]! - half };
      }
    }
    const tips: Point[][] = [];
    for (const aim of file.tops[part.top] ?? []) {
      tips[aim.index] = aim.muzzles.map(point);
    }
    turrets.set(part.id, { pivots, tips });
  }
  return { frame: file.frame, turrets };
}

/** Archetypes whose art defines turret muzzles; every other ship fires from the model origin. */
export const MUZZLE_LAYOUTS: Partial<Record<EnemyArchetype, MuzzleLayout>> = {
  capital: readMuzzleLayout(capital),
  frigate: readMuzzleLayout(frigate),
};
