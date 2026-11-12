import type { Vec } from "../model/types.ts";
import { shipDirection } from "./ship-art.ts";
import { type JetTriangle, jetTriangles, readShipJets, type ShipJets } from "./ship-jets.ts";

/** An enemy hull heading, hardpoint base or turret top frame from Art's root manifest. */
export interface EnemyFrame {
  aimIndex?: number;
  archetype?: string;
  directionIndex?: number;
  displayHeight?: number;
  displayWidth?: number;
  /** `fixed` for a hull drawn once that never turns. */
  facing?: string;
  family?: string;
  hardpoint?: string;
  id: string;
  path?: string;
  pivot: Vec;
  state?: string;
  top?: string;
}

/** One hardpoint in a hull heading: its base sprite centre and, for a turret, its top pivot. */
export interface HeadingPart {
  anchor: Vec;
  pivot?: Vec;
}

/** A filled weapon mount at one position tier: its weapon, top design and aim rule. */
export interface TierMount {
  /** `target` turns with the turret's world aim; `aft` holds aim `(k + 8) mod 16` at heading k. */
  aim: "aft" | "target";
  top: string;
  weapon: string;
}

/** One route-position tier of a mount heavy; a mount it leaves null draws its capped plate. */
export interface LayoutTier {
  mounts: ReadonlyMap<string, TierMount | null>;
  positions: readonly [number, number];
}

/** Art's `{archetype}-hardpoints.json`, version 1; positions are hull frame px. */
export interface HardpointLayout {
  /** The weapon mount ids in fill order; empty for a craft without tiers. */
  fill: readonly string[];
  frame: number;
  hardpoints: readonly {
    /** Whether the mount has capped plate frames. */
    capped: boolean;
    id: string;
    role: string;
    states: readonly string[];
    /** The top the hardpoint carries at every tier, or null when it has none or its tier decides. */
    top: string | null;
  }[];
  /**
   * Per hull heading: layer ids far to near, `hull` among them, each part's placement and the
   * Disabled banner's centre.
   */
  headings: readonly {
    banner?: Vec;
    order: readonly string[];
    parts: ReadonlyMap<string, HeadingPart>;
  }[];
  /** Mount loadouts by route position; empty when every hardpoint carries its own top. */
  tiers: readonly LayoutTier[];
  /** Per top design and aim index: barrel tips in frame px relative to the pivot. */
  tops: ReadonlyMap<string, readonly (readonly Vec[])[]>;
}

/** A composed craft's part frames: bases by hardpoint and state (with `capped`), tops by design. */
export interface PartArt<T extends EnemyFrame = EnemyFrame> {
  bases: ReadonlyMap<string, ReadonlyMap<string, readonly T[]>>;
  layout: HardpointLayout;
  tops: ReadonlyMap<string, readonly T[]>;
}

/** A complete heading set, with jets when valid and parts for a composed craft. */
export interface EnemyArt<T extends EnemyFrame = EnemyFrame> {
  frames: readonly T[];
  jets: ShipJets | undefined;
  parts?: PartArt<T>;
}

/** Art exports every turning enemy in sixteen headings, as Gameplay requires. */
export const ENEMY_HEADINGS = 16;

/** The id prefix of Gadget's coral family; Cartwheel's claim jumpers use `enemy-claim-`. */
export const CORAL = "enemy-";
export const CLAIM = "enemy-claim-";

/** The claim archetypes Cartwheel draws in the claim family: all seven. */
export const CLAIM_WIRED: ReadonlySet<string> = new Set([
  "capital",
  "fighter",
  "frigate",
  "interceptor",
  "platform",
  "retaliator",
  "swarm",
]);

/**
 * Andromeda's garnet and Needle's crimson families (art/heavies.md): Gadget's drones and heavies
 * recoloured, with no platform.
 */
export const GARNET = "enemy-garnet-";
export const NEEDLE = "enemy-needle-";
const RECOLOURED: ReadonlySet<string> = new Set([
  "capital",
  "fighter",
  "frigate",
  "interceptor",
  "retaliator",
  "swarm",
]);

/** A galaxy's own enemy family: its manifest's entries with `family` and the `prefix` ids. */
export interface EnemyFamily {
  readonly family: string;
  /** The galaxy that flies it, by stable galaxy id. */
  readonly galaxy: string;
  readonly prefix: string;
  /** The archetypes it draws; the rest keep Gadget's coral family. */
  readonly wired: ReadonlySet<string>;
}

/** Each galaxy's own enemy family; every other galaxy flies Gadget's coral family. */
export const GALAXY_FAMILIES: readonly EnemyFamily[] = [
  { family: "claim", galaxy: "cartwheel", prefix: CLAIM, wired: CLAIM_WIRED },
  { family: "garnet", galaxy: "andromeda", prefix: GARNET, wired: RECOLOURED },
  { family: "needle", galaxy: "needle", prefix: NEEDLE, wired: RECOLOURED },
];

/** The family a galaxy draws an archetype in, or undefined for Gadget's coral family. */
export function galaxyFamily(
  galaxy: string | undefined,
  archetype: string,
): EnemyFamily | undefined {
  return GALAXY_FAMILIES.find((entry) => entry.galaxy === galaxy && entry.wired.has(archetype));
}

/**
 * Hull frames per archetype for one family's id prefix: complete sixteen-heading sets from
 * `{prefix}{archetype}-{index}` entries, or one `{prefix}{archetype}` frame with facing `fixed`
 * for a hull that never turns. An archetype with a missing, extra, duplicate or unsized frame
 * is left out and keeps its vector placeholder.
 */
export function enemyFrameSets<T extends EnemyFrame>(
  assets: readonly T[],
  prefix = CORAL,
): Map<string, T[]> {
  const frame = new RegExp(`^${prefix}([a-z][a-zA-Z]*)-(\\d+)$`);
  const groups = new Map<string, T[]>();
  const broken = new Set<string>();
  const fixed = new Map<string, T>();
  for (const asset of assets) {
    if (
      asset.facing === "fixed" &&
      asset.archetype &&
      asset.id === `${prefix}${asset.archetype}` &&
      asset.displayWidth! > 0 &&
      asset.displayHeight! > 0
    ) {
      fixed.set(asset.archetype, asset);
      continue;
    }
    const match = frame.exec(asset.id);
    if (!match) {
      continue;
    }
    const archetype = match[1]!;
    const index = Number(match[2]);
    const frames = groups.get(archetype) ?? [];
    groups.set(archetype, frames);
    if (
      asset.archetype !== archetype ||
      asset.directionIndex !== index ||
      !(asset.displayWidth! > 0) ||
      !(asset.displayHeight! > 0) ||
      frames[index]
    ) {
      broken.add(archetype);
      continue;
    }
    frames[index] = asset;
  }
  for (const [archetype, frames] of groups) {
    if (broken.has(archetype) || !completeSet(frames)) {
      groups.delete(archetype);
    }
  }
  for (const [archetype, hull] of fixed) {
    if (!groups.has(archetype)) {
      groups.set(archetype, [hull]);
    }
  }
  return groups;
}

/**
 * The hardpoints file's heading for a hull frame: its own heading, or 0 for a single fixed
 * hull, which Art draws as heading 0 and which never turns.
 */
export function hullHeading(art: Pick<EnemyArt, "frames">, hull: EnemyFrame): number | undefined {
  return hull.directionIndex ?? (art.frames.length === 1 ? 0 : undefined);
}

/** Exactly sixteen entries with no holes; array methods skip holes, so check each index. */
function completeSet(frames: readonly unknown[]): boolean {
  return (
    frames.length === ENEMY_HEADINGS &&
    Array.from({ length: ENEMY_HEADINGS }, (_, index) => index in frames).every(Boolean)
  );
}

/** A hardpoint base or turret top frame, as opposed to a hull heading. */
export function enemyPartFrame(asset: EnemyFrame): boolean {
  return asset.hardpoint !== undefined || asset.top !== undefined;
}

/**
 * The part frames still to load for archetype's craft, or null while its family's part list is
 * not known yet: a galaxy family's parts are in that galaxy's manifest, so until it loads the
 * craft keeps its placeholder and asks again.
 */
export function enemyPartsToLoad<T extends EnemyFrame>(
  known: boolean,
  loaded: (id: string) => boolean,
  parts: readonly T[],
  archetype: string,
): readonly T[] | null {
  return known ? parts.filter((part) => part.archetype === archetype && !loaded(part.id)) : null;
}

/** Archetypes whose manifest entries include hardpoint bases or turret tops. */
export function composedArchetypes(assets: readonly EnemyFrame[]): Set<string> {
  return new Set(assets.filter(enemyPartFrame).flatMap((asset) => asset.archetype ?? []));
}

/** An archetype's data file sits beside its frames as `{archetype}-{name}.json`. */
function besideFrames(name: string, archetype: string, frame: Pick<EnemyFrame, "path">): string {
  const path = frame.path ?? "";
  return `${path.slice(0, path.lastIndexOf("/") + 1)}${archetype}-${name}.json`;
}

/** The archetype's jets file sits beside its frames as `{archetype}-jets.json`. */
export function enemyJetsPath(archetype: string, frame: Pick<EnemyFrame, "path">): string {
  return besideFrames("jets", archetype, frame);
}

/** A composed archetype's layout sits beside its frames as `{archetype}-hardpoints.json`. */
export function enemyHardpointsPath(archetype: string, frame: Pick<EnemyFrame, "path">): string {
  return besideFrames("hardpoints", archetype, frame);
}

export function enemyShardsPath(archetype: string, frame: Pick<EnemyFrame, "path">): string {
  return besideFrames("shards", archetype, frame);
}

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;

function readVec(value: unknown): Vec | undefined {
  return Array.isArray(value) &&
    value.length === 2 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    ? { x: value[0] as number, y: value[1] as number }
    : undefined;
}

/** Entries indexed 0..15 by their `index` field, each read by `read`, or undefined. */
function readIndexed<R>(value: unknown, read: (entry: Fields) => R | undefined): R[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result: R[] = [];
  for (const entry of value as unknown[]) {
    const item = fields(entry);
    const index = item?.index;
    const parsed = item && read(item);
    if (!Number.isInteger(index) || (index as number) in result || parsed === undefined) {
      return undefined;
    }
    result[index as number] = parsed;
  }
  return completeSet(result) ? result : undefined;
}

/**
 * Validate Art's hardpoints file for `archetype`. Each heading orders `hull` and every
 * hardpoint exactly once and places every hardpoint, with a pivot for each turret top.
 */
export function readHardpointLayout(
  archetype: string,
  value: unknown,
): HardpointLayout | undefined {
  const root = fields(value);
  if (
    root?.version !== 1 ||
    root.archetype !== archetype ||
    typeof root.frame !== "number" ||
    !(root.frame > 0) ||
    !Array.isArray(root.hardpoints)
  ) {
    return undefined;
  }
  const hardpoints: HardpointLayout["hardpoints"][number][] = [];
  for (const entry of root.hardpoints as unknown[]) {
    const part = fields(entry);
    const states = part?.states;
    if (
      typeof part?.id !== "string" ||
      part.id === "hull" ||
      hardpoints.some((other) => other.id === part.id) ||
      typeof part.role !== "string" ||
      !Array.isArray(states) ||
      !states.every((state) => state === "intact" || state === "destroyed") ||
      new Set(states).size !== states.length ||
      (part.top !== null && typeof part.top !== "string") ||
      (part.capped !== undefined && typeof part.capped !== "boolean")
    ) {
      return undefined;
    }
    hardpoints.push({
      capped: part.capped === true,
      id: part.id,
      role: part.role,
      states,
      top: part.top,
    });
  }
  const mounts = readMounts(hardpoints, root.fill, root.tiers);
  if (!mounts) {
    return undefined;
  }
  const { fill, tiers } = mounts;
  // A hardpoint carries a top when it has its own or any tier gives it one.
  const tiered = (id: string) => tiers.some((tier) => tier.mounts.get(id));
  const ids = ["hull", ...hardpoints.map((part) => part.id)].sort();
  const headings = readIndexed(root.headings, (heading) => {
    const order = heading.order;
    if (
      !Array.isArray(order) ||
      !order.every((id) => typeof id === "string") ||
      JSON.stringify([...order].sort()) !== JSON.stringify(ids) ||
      !Array.isArray(heading.hardpoints)
    ) {
      return undefined;
    }
    const parts = new Map<string, HeadingPart>();
    for (const entry of heading.hardpoints as unknown[]) {
      const placed = fields(entry);
      const definition = hardpoints.find((part) => part.id === placed?.id);
      const anchor = readVec(placed?.anchor);
      const pivot = readVec(placed?.pivot);
      if (
        !definition ||
        !anchor ||
        parts.has(definition.id) ||
        ((definition.top || tiered(definition.id)) && !pivot)
      ) {
        return undefined;
      }
      parts.set(definition.id, pivot ? { anchor, pivot } : { anchor });
    }
    const banner = readVec(heading.banner);
    if (parts.size !== hardpoints.length || (heading.banner !== undefined && !banner)) {
      return undefined;
    }
    const placed = { order: order as string[], parts };
    return banner ? { ...placed, banner } : placed;
  });
  const topsRoot = fields(root.tops);
  const tops = new Map<string, Vec[][]>();
  const designs = [
    ...hardpoints.flatMap((part) => part.top ?? []),
    ...tiers.flatMap((tier) => [...tier.mounts.values()].flatMap((mount) => mount?.top ?? [])),
  ];
  for (const design of new Set(designs)) {
    const aims = readIndexed(topsRoot?.[design], (aim) => {
      const muzzles = Array.isArray(aim.muzzles) ? aim.muzzles.map(readVec) : [];
      return muzzles.length > 0 && muzzles.every(Boolean) ? (muzzles as Vec[]) : undefined;
    });
    if (!aims) {
      return undefined;
    }
    tops.set(design, aims);
  }
  return headings ? { fill, frame: root.frame, hardpoints, headings, tiers, tops } : undefined;
}

/**
 * A mount heavy's `fill` and `tiers`, or empty ones for a craft without either. Every tier maps
 * exactly the fill's mounts, each to a weapon with a top and aim or to null for a mount with
 * capped plates.
 */
function readMounts(
  hardpoints: HardpointLayout["hardpoints"],
  fillValue: unknown,
  tiersValue: unknown,
): Pick<HardpointLayout, "fill" | "tiers"> | undefined {
  if (fillValue === undefined && tiersValue === undefined) {
    return { fill: [], tiers: [] };
  }
  if (
    !Array.isArray(fillValue) ||
    !Array.isArray(tiersValue) ||
    !fillValue.every((id) => hardpoints.some((part) => part.id === id)) ||
    new Set(fillValue).size !== fillValue.length
  ) {
    return undefined;
  }
  const fill = fillValue as string[];
  const tiers: LayoutTier[] = [];
  for (const entry of tiersValue as unknown[]) {
    const tier = fields(entry);
    const positions = tier?.positions;
    const listed = fields(tier?.mounts);
    if (
      !Array.isArray(positions) ||
      positions.length !== 2 ||
      !positions.every(Number.isInteger) ||
      positions[0] > positions[1] ||
      !listed ||
      JSON.stringify(Object.keys(listed).sort()) !== JSON.stringify([...fill].sort())
    ) {
      return undefined;
    }
    const mounts = new Map<string, TierMount | null>();
    for (const id of fill) {
      const mount = listed[id];
      if (mount === null) {
        if (!hardpoints.find((part) => part.id === id)!.capped) {
          return undefined;
        }
        mounts.set(id, null);
        continue;
      }
      const armed = fields(mount);
      if (
        typeof armed?.weapon !== "string" ||
        typeof armed.top !== "string" ||
        (armed.aim !== "target" && armed.aim !== "aft")
      ) {
        return undefined;
      }
      mounts.set(id, { aim: armed.aim, top: armed.top, weapon: armed.weapon });
    }
    tiers.push({ mounts, positions: [positions[0] as number, positions[1] as number] });
  }
  return tiers.length ? { fill, tiers } : undefined;
}

/**
 * The tier holding route `position`: a position past the last tier reads the last one, and one
 * before the first reads the first. Undefined for a craft without tiers.
 */
export function layoutTier(
  layout: Pick<HardpointLayout, "tiers">,
  position: number,
): LayoutTier | undefined {
  const tiers = [...layout.tiers].sort((a, b) => a.positions[0] - b.positions[0]);
  const last = tiers.at(-1);
  return (
    tiers.find(({ positions }) => positions[0] <= position && position <= positions[1]) ??
    (last && position > last.positions[1] ? last : tiers[0])
  );
}

/**
 * What a hardpoint carries at route `position`: `capped` for a mount the tier leaves null, else
 * its top design (null for none) and whether that top holds the aft aim.
 */
export function mountedTop(
  layout: HardpointLayout,
  position: number,
  hardpoint: string,
): "capped" | { aft: boolean; top: string | null } {
  const tier = layoutTier(layout, position);
  if (tier?.mounts.has(hardpoint)) {
    const mount = tier.mounts.get(hardpoint);
    return mount ? { aft: mount.aim === "aft", top: mount.top } : "capped";
  }
  return { aft: false, top: layout.hardpoints.find((part) => part.id === hardpoint)?.top ?? null };
}

/** A top's aim index: its turret's world aim, or `(k + 8) mod 16` for an aft top at heading k. */
export function topAim(aft: boolean, heading: number, aim: Vec): number {
  return aft ? (heading + ENEMY_HEADINGS / 2) % ENEMY_HEADINGS : aimIndex(aim);
}

/** Sixteen sized frames, one per index, each with its exact id and matching fields. */
function partSet<T extends EnemyFrame>(
  assets: readonly T[],
  id: (index: number) => string,
  matches: (asset: T, index: number) => boolean,
): T[] | undefined {
  const frames = Array.from({ length: ENEMY_HEADINGS }, (_, index) =>
    assets.find(
      (asset) =>
        asset.id === id(index) &&
        matches(asset, index) &&
        asset.displayWidth! > 0 &&
        asset.displayHeight! > 0,
    ),
  );
  return frames.every(Boolean) ? (frames as T[]) : undefined;
}

/**
 * The layout's part frames: `enemy-{a}-{h}-{state}-{k}` for each listed state of each
 * hardpoint, `enemy-{a}-{h}-capped-{k}` for each cappable mount and `enemy-{a}-{t}-top-{i}` for
 * each top design, all sixteen of each, or undefined when any is missing.
 */
export function readPartArt<T extends EnemyFrame>(
  archetype: string,
  layout: HardpointLayout,
  assets: readonly T[],
  prefix = CORAL,
): PartArt<T> | undefined {
  const own = assets.filter((asset) => asset.archetype === archetype);
  const bases = new Map<string, Map<string, T[]>>();
  for (const part of layout.hardpoints) {
    const states = new Map<string, T[]>();
    for (const state of part.capped ? [...part.states, "capped"] : part.states) {
      const frames = partSet(
        own,
        (index) => `${prefix}${archetype}-${part.id}-${state}-${index}`,
        (asset, index) =>
          asset.hardpoint === part.id && asset.state === state && asset.directionIndex === index,
      );
      if (!frames) {
        return undefined;
      }
      states.set(state, frames);
    }
    bases.set(part.id, states);
  }
  const tops = new Map<string, T[]>();
  for (const design of layout.tops.keys()) {
    const frames = partSet(
      own,
      (index) => `${prefix}${archetype}-${design}-top-${index}`,
      (asset, index) => asset.top === design && asset.aimIndex === index,
    );
    if (!frames) {
      return undefined;
    }
    tops.set(design, frames);
  }
  return { bases, layout, tops };
}

/**
 * Jets apply only when the file is valid and lists all sixteen headings. A `composed`
 * archetype, one the manifest gives part frames, also needs a valid hardpoints layout and every
 * part frame among `assets`, or it keeps its vector placeholder.
 */
export function enemyArt<T extends EnemyFrame>(
  jets: (archetype: string) => unknown,
  layouts: (archetype: string) => unknown,
  composed: ReadonlySet<string>,
  assets: readonly T[],
  sets: ReadonlyMap<string, readonly T[]>,
  prefix = CORAL,
): Map<string, EnemyArt<T>> {
  const result = new Map<string, EnemyArt<T>>();
  for (const [archetype, frames] of sets) {
    const parsed = readShipJets(jets(archetype));
    const art: EnemyArt<T> = {
      frames,
      jets: parsed?.headings.length === ENEMY_HEADINGS ? parsed : undefined,
    };
    if (composed.has(archetype)) {
      const layout = readHardpointLayout(archetype, layouts(archetype));
      const parts = layout && readPartArt(archetype, layout, assets, prefix);
      if (!parts) {
        continue;
      }
      art.parts = parts;
    }
    result.set(archetype, art);
  }
  return result;
}

/** The nearest authored heading to the continuous hull facing. */
export function selectEnemyFrame<T extends EnemyFrame>(art: EnemyArt<T>, facing: Vec): T {
  return art.frames[shipDirection(art.frames.length, facing)]!;
}

/** A turret top's aim index: index `i` faces world angle `i * 22.5` degrees, as hull headings. */
export function aimIndex(aim: Vec): number {
  return shipDirection(ENEMY_HEADINGS, aim);
}

/** One sprite of a composed frame, offset from the hull sprite position in display px. */
export interface PartSprite<T extends EnemyFrame = EnemyFrame> {
  frame: T;
  /** Hardpoint id, or null for the hull. */
  hardpoint: string | null;
  offset: Vec;
  /** `base` for a hull or hardpoint base, `top` for a turret top. */
  layer: "base" | "top";
}

/** What the renderer needs from a composed craft's live state. */
export interface PartPose {
  /** A turret's world aim. */
  aim: (hardpoint: string) => Vec;
  /** Whether the hardpoint still stands. */
  intact: (hardpoint: string) => boolean;
  /** The galaxy's route position, which picks a mount heavy's tier. */
  position: number;
}

/** Hull frame px to display px about the hull sprite's pivot. */
function hullOffset(hull: EnemyFrame, frame: number, at: Vec): Vec {
  const scale = hull.displayWidth! / frame;
  return { x: (at.x - hull.pivot.x * frame) * scale, y: (at.y - hull.pivot.y * frame) * scale };
}

/**
 * The composed frame far to near: in the heading's layer order, the hull or each hardpoint's
 * base for its state at its anchor, then an intact turret's top for its aim at its pivot. A mount
 * the position's tier leaves unused draws its capped plate and no top.
 */
export function composeEnemy<T extends EnemyFrame>(
  art: EnemyArt<T>,
  pose: PartPose,
  hull: T,
): PartSprite<T>[] {
  const parts = art.parts;
  const index = hullHeading(art, hull);
  if (!parts || index === undefined) {
    return [{ frame: hull, hardpoint: null, layer: "base", offset: { x: 0, y: 0 } }];
  }
  const { frame, headings } = parts.layout;
  const heading = headings[index]!;
  const sprites: PartSprite<T>[] = [];
  for (const id of heading.order) {
    if (id === "hull") {
      sprites.push({ frame: hull, hardpoint: null, layer: "base", offset: { x: 0, y: 0 } });
      continue;
    }
    const placed = heading.parts.get(id)!;
    const mount = mountedTop(parts.layout, pose.position, id);
    const intact = mount !== "capped" && pose.intact(id);
    const state = mount === "capped" ? "capped" : intact ? "intact" : "destroyed";
    const base = parts.bases.get(id)?.get(state)?.[index];
    if (base) {
      sprites.push({
        frame: base,
        hardpoint: id,
        layer: "base",
        offset: hullOffset(hull, frame, placed.anchor),
      });
    }
    if (intact && mount.top && placed.pivot) {
      sprites.push({
        frame: parts.tops.get(mount.top)![topAim(mount.aft, index, pose.aim(id))]!,
        hardpoint: id,
        layer: "top",
        offset: hullOffset(hull, frame, placed.pivot),
      });
    }
  }
  return sprites;
}

/**
 * Barrel tips of an intact turret in display px from the hull sprite position: its pivot plus
 * each muzzle of its tier's top at its aim, or none for a destroyed turret, a capped mount or a
 * turretless part.
 */
export function turretMuzzles(
  art: EnemyArt,
  pose: PartPose,
  hull: EnemyFrame,
  hardpoint: string,
): Vec[] {
  const parts = art.parts;
  const heading = hullHeading(art, hull) ?? -1;
  const pivot = parts?.layout.headings[heading]?.parts.get(hardpoint)?.pivot;
  const mount = parts && mountedTop(parts.layout, pose.position, hardpoint);
  if (!parts || !mount || mount === "capped" || !mount.top || !pivot || !pose.intact(hardpoint)) {
    return [];
  }
  const aim = topAim(mount.aft, heading, pose.aim(hardpoint));
  const muzzles = parts.layout.tops.get(mount.top)![aim]!;
  return muzzles.map((muzzle) =>
    hullOffset(hull, parts.layout.frame, { x: pivot.x + muzzle.x, y: pivot.y + muzzle.y }),
  );
}

/**
 * Jet triangles relative to the sprite position; empty at rest or without a jets file. A mouth
 * tagged with an engine draws only while that engine is intact.
 */
export function enemyJetTriangles(
  art: EnemyArt,
  frame: EnemyFrame,
  speedFraction: number,
  intact: (hardpoint: string) => boolean = () => true,
): JetTriangle[] {
  if (!art.jets || frame.directionIndex === undefined) {
    return [];
  }
  const headings = art.jets.headings.map((mouths) =>
    mouths.filter((mouth) => mouth.hardpoint === undefined || intact(mouth.hardpoint)),
  );
  return jetTriangles(
    { ...art.jets, headings },
    {
      displayHeight: frame.displayHeight!,
      displayWidth: frame.displayWidth!,
      pivot: frame.pivot,
    },
    frame.directionIndex,
    speedFraction,
  );
}

/** How long a hit hardpoint's base and top flash. */
export const HIT_FLASH_MS = 100;

/** Per-hardpoint hit flashes: a drop in hit points since the last frame starts a flash. */
export class HitFlashes {
  private parts = new Map<string, { at: number; hp: number }>();

  /** Records `hp` for `key` at `nowMs` and returns whether it is flashing. */
  observe(key: string, hp: number, nowMs: number): boolean {
    const last = this.parts.get(key);
    const at = last && hp < last.hp ? nowMs : (last?.at ?? -Infinity);
    this.parts.set(key, { at, hp });
    return nowMs - at < HIT_FLASH_MS;
  }

  /** Forgets every key whose owner is no longer present. */
  retain(owners: ReadonlySet<string>, owner: (key: string) => string): void {
    for (const key of this.parts.keys()) {
      if (!owners.has(owner(key))) {
        this.parts.delete(key);
      }
    }
  }
}
