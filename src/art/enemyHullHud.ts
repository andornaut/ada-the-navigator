import {
  ANDROMEDA_REDACT,
  CARTWHEEL_CLAIM,
  NEEDLE_CADENCE,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_CAPITAL_BOSS,
} from "../data/capitalBosses.ts";
import type { EnemyActorKind } from "../data/enemyActors.ts";
import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { SCREEN } from "../data/screen.ts";
import { COLOURS } from "../data/uiColours.ts";
import type { EnemyState } from "../model/ai/index.ts";

const COMPACT_HULLS = new Set<EnemyActorKind>(["platform", "frigate", "capital", "hostileStation"]);
const NAMED_BOSSES = new Set<string>([
  ANDROMEDA_REDACT.id,
  CARTWHEEL_CLAIM.id,
  NEEDLE_CADENCE.id,
  PHANTOM_FLAGSHIP,
  SUNFLOWER_CAPITAL_BOSS.id,
  WHIRLPOOL_CAPITAL_BOSS.id,
]);

const WIDTH = 32;
const HEIGHT = 4;
const GAP = 3;
const RIM = 1;
const TRACK = Number.parseInt(COLOURS.ink.slice(1), 16);
const FILL = Number.parseInt(COLOURS.refusalRed.slice(1), 16);

interface HullBounds {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

type HullState = Pick<
  EnemyState,
  "archetype" | "disabled" | "engaged" | "fleeing" | "hp" | "returning" | "salvaged"
>;

export function hasCompactHullHud(id: string, enemy: HullState): boolean {
  return (
    COMPACT_HULLS.has(enemy.archetype) &&
    !NAMED_BOSSES.has(id) &&
    enemy.engaged &&
    !enemy.disabled &&
    !enemy.fleeing &&
    !enemy.returning &&
    !enemy.salvaged &&
    enemy.hp > 0
  );
}

interface HullInk {
  fillStyle(colour: number): unknown;
  fillRect(x: number, y: number, width: number, height: number): unknown;
}

/** Draw above the hull's current heading, inside the flight camera's logical viewport. */
export function drawCompactHullHud(
  ink: HullInk,
  hull: HullBounds,
  current: number,
  max: number,
): void {
  if (
    hull.right <= 0 ||
    hull.bottom <= 0 ||
    hull.left >= SCREEN.width ||
    hull.top >= SCREEN.height ||
    !Number.isFinite(max) ||
    max <= 0
  ) {
    return;
  }
  const x = Math.max(0, Math.min(SCREEN.width - WIDTH, (hull.left + hull.right - WIDTH) / 2));
  const y = Math.max(0, hull.top - GAP - HEIGHT);
  ink.fillStyle(TRACK);
  ink.fillRect(x, y, WIDTH, HEIGHT);
  ink.fillStyle(FILL);
  ink.fillRect(x + RIM, y + RIM, (WIDTH - 2 * RIM) * Math.min(1, current / max), HEIGHT - 2 * RIM);
}
