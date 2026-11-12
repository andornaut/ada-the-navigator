import fighter from "../../public/art/enemies/fighter-jets.json" with { type: "json" };
import interceptor from "../../public/art/enemies/interceptor-jets.json" with { type: "json" };
import retaliator from "../../public/art/enemies/retaliator-jets.json" with { type: "json" };
import swarm from "../../public/art/enemies/swarm-jets.json" with { type: "json" };
import type { EnemyArchetype } from "../data/enemy-catalog.ts";
import { ENEMY_DISPLAY_SCALE } from "../data/enemy-muzzles.ts";
import type { Parts } from "./convex.ts";
import type { EnemyState } from "./enemy-ai.ts";
import type { Vec } from "./types.ts";

/** Art draws every enemy in 16 hull headings and 16 turret aims (art/enemies.md). */
const HEADINGS = 16;

type RawParts = readonly (readonly (readonly number[])[])[];

/** An enemy as drawn: its hull per heading in display px from its position, the centre pivot. */
interface EnemyOutline {
  readonly hulls: readonly Parts[];
}

/** Frame px parts as display px from `origin`. */
function display(origin: number, parts: RawParts): Parts {
  return parts.map((part) =>
    part.map(([x, y]) => ({
      x: (x! - origin) * ENEMY_DISPLAY_SCALE,
      y: (y! - origin) * ENEMY_DISPLAY_SCALE,
    })),
  );
}

interface JetsFile {
  frame: number;
  headings: { index: number; collision?: RawParts }[];
}

/** The hull per heading, or undefined unless all 16 headings carry collision parts. */
function hulls(
  frame: number,
  headings: { index: number; collision?: RawParts }[],
): Parts[] | undefined {
  const out: Parts[] = [];
  for (const heading of headings) {
    if (!heading.collision?.length || heading.index < 0 || heading.index >= HEADINGS) {
      return undefined;
    }
    out[heading.index] = display(frame / 2, heading.collision);
  }
  return out.length === HEADINGS && out.every(Boolean) ? out : undefined;
}

function smallOutline(file: JetsFile): EnemyOutline | undefined {
  const hull = hulls(file.frame, file.headings);
  return hull && { hulls: hull };
}

const OUTLINES: Partial<Record<EnemyArchetype, EnemyOutline>> = {};
for (const [archetype, outline] of [
  ["swarm", smallOutline(swarm as JetsFile)],
  ["fighter", smallOutline(fighter as JetsFile)],
  ["interceptor", smallOutline(interceptor as JetsFile)],
  ["retaliator", smallOutline(retaliator as JetsFile)],
] as const) {
  if (outline) {
    OUTLINES[archetype] = outline;
  }
}

/** The 16-way index a direction draws: `round(atan2(y, x) / 22.5 degrees)` modulo 16. */
function index16(direction: Vec): number {
  const index = Math.round(Math.atan2(direction.y, direction.x) / ((2 * Math.PI) / HEADINGS));
  return ((index % HEADINGS) + HEADINGS) % HEADINGS;
}

/**
 * An enemy's hull as drawn for its facing, in screen px from its position, or null for an
 * archetype without Art's outline, which keeps its hull circle.
 */
export function enemyHull(enemy: Pick<EnemyState, "archetype" | "facing">): Parts | null {
  return OUTLINES[enemy.archetype]?.hulls[index16(enemy.facing)] ?? null;
}
