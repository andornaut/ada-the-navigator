import platform from "../../public/art/cartwheel/enemies/platform-hardpoints.json" with { type: "json" };
import capital from "../../public/art/enemies/capital-hardpoints.json" with { type: "json" };
import fighter from "../../public/art/enemies/fighter-jets.json" with { type: "json" };
import frigate from "../../public/art/enemies/frigate-hardpoints.json" with { type: "json" };
import gadget from "../../public/art/enemies/gadget-hardpoints.json" with { type: "json" };
import interceptor from "../../public/art/enemies/interceptor-jets.json" with { type: "json" };
import retaliator from "../../public/art/enemies/retaliator-jets.json" with { type: "json" };
import swarm from "../../public/art/enemies/swarm-jets.json" with { type: "json" };
import type { EnemyArchetype } from "../data/enemy-catalog.ts";
import { ENEMY_DISPLAY_SCALE } from "../data/enemy-muzzles.ts";
import type { RoutePosition } from "../data/galaxies.ts";
import type { Parts } from "./convex.ts";
import type { EnemyState } from "./enemy-ai.ts";
import type { Vec } from "./types.ts";

/** Art draws every enemy in 16 hull headings and 16 turret aims (art/enemies.md). */
const HEADINGS = 16;

type RawParts = readonly (readonly (readonly number[])[])[];

/**
 * A hardpoint's drawn sprites: its base per heading and state (with `capped` for a cappable
 * mount), its top's pivot per heading and the top it carries at every tier, or null.
 */
interface HardpointOutline {
  readonly bases: readonly {
    readonly capped?: Parts;
    readonly destroyed: Parts;
    readonly intact: Parts;
  }[];
  readonly pivots: readonly (Vec | null)[];
  readonly top: string | null;
}

/** A tier-filled mount's top and whether it holds the aft aim. */
interface MountTop {
  readonly aft: boolean;
  readonly top: string;
}

/** One position tier: each mount's top, or null for its capped plate. */
interface OutlineTier {
  readonly mounts: ReadonlyMap<string, MountTop | null>;
  readonly positions: readonly [number, number];
}

/**
 * An enemy as drawn, in display px from its position (the hull sprite's centre pivot): the hull
 * per heading and, for a heavy, each hardpoint's base and turret tops.
 */
interface EnemyOutline {
  readonly hulls: readonly Parts[];
  readonly hardpoints: ReadonlyMap<string, HardpointOutline>;
  /** A mount heavy's loadouts by route position; empty when every hardpoint keeps its top. */
  readonly tiers: readonly OutlineTier[];
  /** Turret top parts per aim index, display px from the top's pivot. */
  readonly tops: ReadonlyMap<string, readonly Parts[]>;
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

interface HardpointsFile {
  frame: number;
  hardpoints: { id: string; top: string | null }[];
  headings: {
    index: number;
    collision?: RawParts;
    hardpoints: {
      id: string;
      pivot?: number[];
      collision?: { capped?: RawParts; intact?: RawParts; destroyed?: RawParts };
    }[];
  }[];
  tiers?: { mounts: Record<string, { aim: string; top: string } | null>; positions: number[] }[];
  tops: Record<string, { index: number; collision?: RawParts }[]>;
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
  return hull && { hardpoints: new Map(), hulls: hull, tiers: [], tops: new Map() };
}

function heavyOutline(file: HardpointsFile): EnemyOutline | undefined {
  const hull = hulls(file.frame, file.headings);
  if (!hull) {
    return undefined;
  }
  const centre = file.frame / 2;
  const hardpoints = new Map<string, HardpointOutline>();
  const tiers: OutlineTier[] = (file.tiers ?? []).map((tier) => ({
    mounts: new Map(
      Object.entries(tier.mounts).map(([id, mount]) => [
        id,
        mount && { aft: mount.aim === "aft", top: mount.top },
      ]),
    ),
    positions: [tier.positions[0]!, tier.positions[1]!],
  }));
  const cappable = new Set(
    tiers.flatMap((tier) => [...tier.mounts].flatMap(([id, top]) => (top === null ? [id] : []))),
  );
  for (const { id, top } of file.hardpoints) {
    const bases: { capped?: Parts; destroyed: Parts; intact: Parts }[] = [];
    const pivots: (Vec | null)[] = [];
    for (const heading of file.headings) {
      const part = heading.hardpoints.find((entry) => entry.id === id);
      const { capped, destroyed, intact } = part?.collision ?? {};
      if (!part || !intact?.length || !destroyed?.length || (cappable.has(id) && !capped?.length)) {
        return undefined;
      }
      bases[heading.index] = {
        ...(capped?.length ? { capped: display(centre, capped) } : {}),
        destroyed: display(centre, destroyed),
        intact: display(centre, intact),
      };
      pivots[heading.index] = part.pivot
        ? {
            x: (part.pivot[0]! - centre) * ENEMY_DISPLAY_SCALE,
            y: (part.pivot[1]! - centre) * ENEMY_DISPLAY_SCALE,
          }
        : null;
    }
    hardpoints.set(id, { bases, pivots, top });
  }
  const tops = new Map<string, Parts[]>();
  for (const [name, aims] of Object.entries(file.tops)) {
    const parts: Parts[] = [];
    for (const aim of aims) {
      if (!aim.collision?.length) {
        return undefined;
      }
      parts[aim.index] = display(0, aim.collision);
    }
    tops.set(name, parts);
  }
  return { hardpoints, hulls: hull, tiers, tops };
}

/**
 * The top a hardpoint carries at route `position`, from the tier holding it (a position past the
 * last tier reads the last one): `capped` for a mount the tier leaves null.
 */
function carriedTop(
  outline: EnemyOutline,
  position: number,
  id: string,
  own: string | null,
): MountTop | null | "capped" {
  const tiers = [...outline.tiers].sort((a, b) => a.positions[0] - b.positions[0]);
  const last = tiers.at(-1);
  const tier =
    tiers.find(({ positions }) => positions[0] <= position && position <= positions[1]) ??
    (last && position > last.positions[1] ? last : tiers[0]);
  if (!tier?.mounts.has(id)) {
    return own === null ? null : { aft: false, top: own };
  }
  return tier.mounts.get(id) ?? "capped";
}

const OUTLINES: Partial<Record<EnemyArchetype | "gadget", EnemyOutline>> = {};
for (const [archetype, outline] of [
  ["swarm", smallOutline(swarm as JetsFile)],
  ["fighter", smallOutline(fighter as JetsFile)],
  ["interceptor", smallOutline(interceptor as JetsFile)],
  ["retaliator", smallOutline(retaliator as JetsFile)],
  ["frigate", heavyOutline(frigate as HardpointsFile)],
  ["capital", heavyOutline(capital as HardpointsFile)],
  ["gadget", heavyOutline(gadget as HardpointsFile)],
  ["platform", heavyOutline(platform as HardpointsFile)],
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

const PART_OUTLINES = new Map<string, Parts>();
/**
 * A heavy's hardpoint as drawn at route `position`, in screen px from the enemy's position: its
 * base in its current state with its tier's top at its aim, or the capped plate of a mount the
 * tier leaves unused; null without Art's outline.
 */
export function enemyPartOutline(
  position: RoutePosition,
  enemy: Pick<EnemyState, "aim" | "archetype" | "facing" | "hardpoints">,
  id: string,
): Parts | null {
  const outline = OUTLINES[enemy.archetype];
  const hardpoint = outline?.hardpoints.get(id);
  if (!outline || !hardpoint) {
    return null;
  }
  const heading = index16(enemy.facing);
  const carried = carriedTop(outline, position, id, hardpoint.top);
  if (carried === "capped") {
    return hardpoint.bases[heading]!.capped!;
  }
  const state = enemy.hardpoints.find((part) => part.id === id);
  const intact = (state?.hp ?? 1) > 0;
  const pivot = hardpoint.pivots[heading];
  // A destroyed turret draws its stump without a top.
  const tops = carried === null || !intact ? undefined : outline.tops.get(carried.top);
  // An aft top holds the aim opposite the hull heading (art/heavies.md "Weapon tops").
  const aim =
    tops && pivot
      ? carried?.aft
        ? (heading + HEADINGS / 2) % HEADINGS
        : index16(state?.aim ?? enemy.aim ?? enemy.facing)
      : -1;
  const key = `${enemy.archetype}:${id}:${heading}:${intact ? 1 : 0}:${carried?.top}:${aim}`;
  let parts = PART_OUTLINES.get(key);
  if (!parts) {
    const base = hardpoint.bases[heading]!;
    const top =
      tops && pivot
        ? tops[aim]!.map((part) => part.map((at) => ({ x: at.x + pivot.x, y: at.y + pivot.y })))
        : [];
    parts = [...(intact ? base.intact : base.destroyed), ...top];
    PART_OUTLINES.set(key, parts);
  }
  return parts;
}
