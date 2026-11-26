import ring from "../../public/art/andromeda/enemies/hostileStationGarnet-hardpoints.json" with { type: "json" };
import station from "../../public/art/cartwheel/enemies/hostileStationClaim-hardpoints.json" with { type: "json" };
import platform from "../../public/art/cartwheel/enemies/platformWheel-hardpoints.json" with { type: "json" };
import archie from "../../public/art/enemies/archie-prow.json" with { type: "json" };
import capital from "../../public/art/enemies/fleetCapital-prow.json" with { type: "json" };
import capitalBroad from "../../public/art/enemies/fleetCapitalBroad-prow.json" with { type: "json" };
import capitalCrossbow from "../../public/art/enemies/fleetCapitalCrossbow-prow.json" with { type: "json" };
import capitalForked from "../../public/art/enemies/fleetCapitalForked-prow.json" with { type: "json" };
import capitalManta from "../../public/art/enemies/fleetCapitalManta-prow.json" with { type: "json" };
import capitalOutrigger from "../../public/art/enemies/fleetCapitalOutrigger-prow.json" with { type: "json" };
import fighter from "../../public/art/enemies/fleetFighter-jets.json" with { type: "json" };
import frigate from "../../public/art/enemies/fleetFrigate-prow.json" with { type: "json" };
import frigateTwin from "../../public/art/enemies/fleetFrigateTwin-prow.json" with { type: "json" };
import interceptor from "../../public/art/enemies/fleetInterceptor-jets.json" with { type: "json" };
import retaliator from "../../public/art/enemies/fleetRetaliator-jets.json" with { type: "json" };
import cargoParts from "../../public/art/enemies/fleetRetaliatorCargoHauler-hardpoints.json" with { type: "json" };
import cargoJets from "../../public/art/enemies/fleetRetaliatorCargoHauler-jets.json" with { type: "json" };
import miningParts from "../../public/art/enemies/fleetRetaliatorMiningFreighter-hardpoints.json" with { type: "json" };
import miningJets from "../../public/art/enemies/fleetRetaliatorMiningFreighter-jets.json" with { type: "json" };
import swarm from "../../public/art/enemies/fleetSwarm-jets.json" with { type: "json" };
import phantomStation from "../../public/art/enemies/hostileStationCoral-hardpoints.json" with { type: "json" };
import { enemyActorLoadout } from "../data/enemyActorDefinition.ts";
import { type EnemyGeometryKey, enemyGeometryKey } from "../data/enemyIdentity.ts";
import { ENEMY_DISPLAY_SCALE } from "../data/enemyMuzzles.ts";
import type { RoutePosition } from "../data/galaxies.ts";
import type { Parts } from "./convex.ts";
import type { EnemyState } from "./enemyAi.ts";
import type { Vec } from "./types.ts";

/** Art draws every enemy in 16 hull headings and 16 turret aims (art/enemies.md). */
const HEADINGS = 16;

type RawParts = readonly (readonly (readonly number[])[])[];

/**
 * A hardpoint's drawn sprites: its base per heading and state (with `capped` for a cappable
 * mount), its top's pivot per heading and the top it carries at every tier, or null.
 */
interface HardpointOutline {
  readonly damageable: boolean;
  readonly bases: readonly {
    readonly capped?: Parts;
    readonly destroyed: Parts;
    readonly intact: Parts;
  }[];
  readonly pivots: readonly (Vec | null)[];
  readonly top: string | null;
}

/** A drawn top and whether it holds the aft aim. */
interface MountTop {
  readonly aft: boolean;
  readonly top: string;
}

/** One position tier: whether each mount is armed; an unarmed one draws its capped plate. */
interface OutlineTier {
  readonly mounts: ReadonlyMap<string, boolean>;
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
  /** The top each weapon draws on an armed mount. */
  readonly weaponTops: ReadonlyMap<string, MountTop>;
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
  hardpoints: { id: string; states?: string[]; top: string | null }[];
  headings: {
    index: number;
    collision?: RawParts;
    hardpoints: {
      anchor?: number[];
      collision?: { capped?: RawParts; intact?: RawParts; destroyed?: RawParts };
      hidden?: boolean;
      id: string;
      pivot?: number[];
    }[];
  }[];
  tiers?: {
    mounts: Record<string, { armed: boolean } | null>;
    positions: number[];
  }[];
  tops: Record<string, { index: number; collision?: RawParts }[]>;
  weaponTops?: Record<string, { aim: string; top: string }>;
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
  return (
    hull && {
      hardpoints: new Map(),
      hulls: hull,
      tiers: [],
      tops: new Map(),
      weaponTops: new Map(),
    }
  );
}

type HeadingMount = HardpointsFile["headings"][number]["hardpoints"][number];

/**
 * A mount's collision at a heading. A mount the hull hides there carries none, yet it still
 * takes hits: its collar's parts come from the nearest heading that draws them, moved by the
 * difference of the two anchors. This holds for hostile stations and fleet hulls alike.
 */
function mountCollision(
  file: HardpointsFile,
  index: number,
  part: HeadingMount,
): NonNullable<HeadingMount["collision"]> {
  const own = part.collision ?? {};
  if (!part.hidden || own.intact?.length || !part.anchor) {
    return own;
  }
  for (let step = 1; step <= HEADINGS / 2; step++) {
    for (const near of [index - step, index + step]) {
      const heading = file.headings.find((entry) => entry.index === (near + HEADINGS) % HEADINGS);
      const drawn = heading?.hardpoints.find((entry) => entry.id === part.id);
      if (!drawn?.anchor || !drawn.collision?.intact?.length) {
        continue;
      }
      const dx = part.anchor[0]! - drawn.anchor[0]!;
      const dy = part.anchor[1]! - drawn.anchor[1]!;
      const move = (parts: RawParts): RawParts =>
        parts.map((polygon) => polygon.map(([x, y]) => [x! + dx, y! + dy]));
      const { capped, destroyed, intact } = drawn.collision;
      return {
        ...(capped ? { capped: move(capped) } : {}),
        ...(destroyed ? { destroyed: move(destroyed) } : {}),
        intact: move(intact!),
      };
    }
  }
  return own;
}

function heavyOutline(file: HardpointsFile, jets?: JetsFile): EnemyOutline | undefined {
  if (jets && jets.frame !== file.frame) {
    return undefined;
  }
  const hull = hulls(file.frame, jets?.headings ?? file.headings);
  if (!hull) {
    return undefined;
  }
  const centre = file.frame / 2;
  const hardpoints = new Map<string, HardpointOutline>();
  const tiers: OutlineTier[] = (file.tiers ?? []).map((tier) => ({
    mounts: new Map(Object.entries(tier.mounts).map(([id, mount]) => [id, mount?.armed === true])),
    positions: [tier.positions[0]!, tier.positions[1]!],
  }));
  const cappable = new Set(
    tiers.flatMap((tier) => [...tier.mounts].flatMap(([id, armed]) => (armed ? [] : [id]))),
  );
  for (const { id, states, top } of file.hardpoints) {
    const damageable = states?.includes("destroyed") ?? true;
    const bases: { capped?: Parts; destroyed: Parts; intact: Parts }[] = [];
    const pivots: (Vec | null)[] = [];
    for (const heading of file.headings) {
      const part = heading.hardpoints.find((entry) => entry.id === id);
      const { capped, destroyed, intact } = part ? mountCollision(file, heading.index, part) : {};
      // A hidden mount with no heading to borrow from keeps an empty base; its top still collides.
      const hidden = part?.hidden === true;
      if (
        !part ||
        (!intact?.length && !hidden) ||
        (damageable && !destroyed?.length && !hidden) ||
        (cappable.has(id) && !capped?.length && !hidden)
      ) {
        return undefined;
      }
      bases[heading.index] = {
        ...(capped?.length || (hidden && cappable.has(id))
          ? { capped: display(centre, capped ?? []) }
          : {}),
        destroyed: display(centre, destroyed ?? intact ?? []),
        intact: display(centre, intact ?? []),
      };
      pivots[heading.index] = part.pivot
        ? {
            x: (part.pivot[0]! - centre) * ENEMY_DISPLAY_SCALE,
            y: (part.pivot[1]! - centre) * ENEMY_DISPLAY_SCALE,
          }
        : null;
    }
    hardpoints.set(id, { bases, damageable, pivots, top });
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
  const weaponTops = new Map<string, MountTop>(
    Object.entries(file.weaponTops ?? {}).map(([weapon, { aim, top }]) => [
      weapon,
      { aft: aim === "aft", top },
    ]),
  );
  return { hardpoints, hulls: hull, tiers, tops, weaponTops };
}

/**
 * The top a hardpoint carries at route `position`, from the tier holding it (a position past the
 * last tier reads the last one): `capped` for a mount the tier leaves unarmed, else the top of the
 * weapon the ship's loadout puts on it, or none when Art draws no top for that weapon.
 */
function carriedTop(
  outline: EnemyOutline,
  position: number,
  id: string,
  own: string | null,
  weapon: string | undefined,
): MountTop | null | "capped" {
  const tiers = [...outline.tiers].sort((a, b) => a.positions[0] - b.positions[0]);
  const last = tiers.at(-1);
  const tier =
    tiers.find(({ positions }) => positions[0] <= position && position <= positions[1]) ??
    (last && position > last.positions[1] ? last : tiers[0]);
  if (!tier?.mounts.has(id)) {
    return own === null ? null : { aft: false, top: own };
  }
  if (!tier.mounts.get(id)) {
    return "capped";
  }
  return (weapon && outline.weaponTops.get(weapon)) || null;
}

const OUTLINES: Partial<Record<EnemyGeometryKey, EnemyOutline>> = {};
for (const [archetype, outline] of [
  ["swarm", smallOutline(swarm as JetsFile)],
  ["fighter", smallOutline(fighter as JetsFile)],
  ["interceptor", smallOutline(interceptor as JetsFile)],
  ["retaliator", smallOutline(retaliator as JetsFile)],
  ["capital", heavyOutline(capital as HardpointsFile)],
  ["capitalBroad", heavyOutline(capitalBroad as HardpointsFile)],
  ["capitalCrossbow", heavyOutline(capitalCrossbow as HardpointsFile)],
  ["capitalForked", heavyOutline(capitalForked as HardpointsFile)],
  ["capitalManta", heavyOutline(capitalManta as HardpointsFile)],
  ["capitalOutrigger", heavyOutline(capitalOutrigger as HardpointsFile)],
  ["frigate", heavyOutline(frigate as HardpointsFile)],
  ["frigateTwin", heavyOutline(frigateTwin as HardpointsFile)],
  ["archie", heavyOutline(archie as HardpointsFile)],
  ["hostileStation", heavyOutline(station as HardpointsFile)],
  ["hostileStationAndromeda", heavyOutline(ring as HardpointsFile)],
  ["hostileStationPhantom", heavyOutline(phantomStation as HardpointsFile)],
  ["platform", heavyOutline(platform as HardpointsFile)],
  ["retaliatorCargoHauler", heavyOutline(cargoParts as HardpointsFile, cargoJets as JetsFile)],
  [
    "retaliatorMiningFreighter",
    heavyOutline(miningParts as HardpointsFile, miningJets as JetsFile),
  ],
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
export function enemyHull(
  enemy: Pick<EnemyState, "archetype" | "facing"> &
    Partial<Pick<EnemyState, "id" | "aim" | "hullProfile">>,
  position?: RoutePosition,
): Parts | null {
  const key = enemyGeometryKey(enemy, position);
  const outline = OUTLINES[key];
  if (!outline) {
    return null;
  }
  const heading = index16(enemy.facing);
  const mounts = [...outline.hardpoints].filter(([, part]) => !part.damageable);
  return mounts.length
    ? [
        ...outline.hulls[heading]!,
        ...mounts.flatMap(([id, part]) =>
          composedPart(
            key,
            outline,
            part,
            id,
            heading,
            true,
            part.top ? { aft: false, top: part.top } : null,
            index16(enemy.aim ?? enemy.facing),
          ),
        ),
      ]
    : outline.hulls[heading]!;
}

const PART_OUTLINES = new Map<string, Parts>();
/**
 * A heavy's hardpoint as drawn at route `position`, in screen px from the enemy's position: its
 * base in its current state with its tier's top at its aim, or the capped plate of a mount the
 * tier leaves unused; null without Art's outline.
 */
export function enemyPartOutline(
  position: RoutePosition,
  enemy: Pick<EnemyState, "aim" | "archetype" | "facing" | "hardpoints" | "hullProfile" | "id">,
  id: string,
): Parts | null {
  const key = enemyGeometryKey(enemy, position);
  const outline = OUTLINES[key];
  const hardpoint = outline?.hardpoints.get(id);
  if (!outline || !hardpoint) {
    return null;
  }
  const heading = index16(enemy.facing);
  const weapon = enemyActorLoadout(enemy.archetype, position, enemy.id)?.get(id);
  const carried = carriedTop(outline, position, id, hardpoint.top, weapon);
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
  return composedPart(key, outline, hardpoint, id, heading, intact, carried, aim);
}

function composedPart(
  assetKey: EnemyGeometryKey,
  outline: EnemyOutline,
  hardpoint: HardpointOutline,
  id: string,
  heading: number,
  intact: boolean,
  carried: MountTop | null,
  aim: number,
): Parts {
  const pivot = hardpoint.pivots[heading];
  const tops = carried === null || !intact ? undefined : outline.tops.get(carried.top);
  const key = `${assetKey}:${id}:${heading}:${intact ? 1 : 0}:${carried?.top}:${aim}`;
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

/** Complete current assembled footprint for placement, including capped and damaged parts. */
export function enemyPhysicalBody(
  position: RoutePosition,
  enemy: Pick<EnemyState, "aim" | "archetype" | "facing" | "hardpoints" | "hullProfile" | "id">,
): Parts | null {
  const hull = enemyHull(enemy, position);
  const key = enemyGeometryKey(enemy, position);
  const outline = OUTLINES[key];
  if (!hull || !outline) {
    return null;
  }
  return [
    ...hull,
    ...[...outline.hardpoints].flatMap(([id, part]) =>
      part.damageable ? (enemyPartOutline(position, enemy, id) ?? []) : [],
    ),
  ];
}
