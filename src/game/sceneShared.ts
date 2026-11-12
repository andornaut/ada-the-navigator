// Declarations the scene and its modules share.
import type { Vec } from "../model/types.ts";
import { type EnemyFrame } from "./enemyArt.ts";
import { type ShipAsset } from "./shipArt.ts";
import { type StationFrame } from "./stationArt.ts";

// Story craft darts while their frames load.
export const STORY_SHIP = { blocker: 0x8a7f78, hull: 0xd9c7a6 } as const;
// Art's start screen placement, linked from the core manifest as titleScreen.
export const TITLE_SCREEN_KEY = "title-screen";
// Art's destruction data; a wreck's flash sprite shares its id plus this suffix.
export const DESTRUCTION_PATH = "/art/enemies/destruction.json";

export interface Asset extends ShipAsset, EnemyFrame {
  path: string;
  width: number;
  height: number;
  frameWidth?: number;
  frameHeight?: number;
  dock?: NonNullable<StationFrame["dock"]>;
  frameMs?: number;
  frames?: Readonly<Record<string, number>>;
  loop?: readonly { readonly frame: number; readonly ms: number }[];
  outpost?: string;
  kind?: string;
  loopFrame?: number;
  craft?: string;
  debris?: string;
  destination?: string;
  frameIndex?: number;
  overlay?: boolean;
  project?: string;
  station?: string;
  variant?: string;
}

/** World axes project diagonally; controls continue to follow screen directions. */
export function screenToWorld(vector: Vec): Vec {
  const x = vector.x / 2 + vector.y;
  const y = vector.y - vector.x / 2;
  const magnitude = Math.hypot(x, y);
  const strength = Math.min(1, Math.hypot(vector.x, vector.y));
  return magnitude === 0
    ? { x: 0, y: 0 }
    : { x: (x / magnitude) * strength, y: (y / magnitude) * strength };
}

/** A Projects row's project id from its shop key, "project:<id>"; null for a shop item. */
export function projectId(key: string): string | null {
  return key.startsWith("project:") ? key.slice("project:".length) : null;
}

// The landmarks' ground layer (art/jobs.md): above the backdrop rocks (-1), under the field ink
// (0), which draws the specks, streaks and the search rim over them, and under every play object.
export const LANDMARK_DEPTH = -0.5;
// A dust streak draws in this many pieces, each at its share of the half-sine fade.
export const STREAK_PIECES = 8;
