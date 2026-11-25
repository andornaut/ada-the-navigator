import type { Vec } from "../model/types.ts";

// Art's Whirlpool lantern whales (art/whales.md): four kinds in 16 headings with an 8-frame swim
// loop, placed by their ground-centre pivot.

export type WhaleKind = "adult" | "calf" | "whale" | "youngCalf";

/** A whale frame from Art's root manifest: `whale-{kind}-{heading}-{frame}`. */
export interface WhaleFrame {
  directionIndex?: number;
  displayHeight?: number;
  displayWidth?: number;
  id: string;
  kind?: string;
  loopFrame?: number;
  path?: string;
  pivot: Vec;
}

export interface WhaleKindArt<T extends WhaleFrame = WhaleFrame> {
  /** Frames by heading, then loop frame. */
  frames: readonly (readonly T[])[];
  /** Footprint radius per heading, world units from the pivot. */
  footprints: readonly number[];
  idleMs: number;
  /** Raw SVG viewBox size per heading, independent of the manifest image size. */
  viewBoxes: readonly (Readonly<{ height: number; width: number }> | undefined)[];
  stationaryHeading: number;
  swimMs: number;
}

export interface WhaleArt<T extends WhaleFrame = WhaleFrame> {
  /** The family's members and their world offsets from the smaller adult. */
  family: readonly { kind: WhaleKind; offset: Vec }[];
  kinds: ReadonlyMap<WhaleKind, WhaleKindArt<T>>;
  reducedFrame: number;
}

const KINDS: readonly WhaleKind[] = ["whale", "adult", "calf", "youngCalf"];
const HEADINGS = 16;

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const isKind = (value: unknown): value is WhaleKind => KINDS.includes(value as WhaleKind);

/**
 * Art's `whales.json` (version 1) with the manifest's whale frames, or undefined when the data
 * or any kind's 16 headings by `frames` loop frames are missing; whales then keep their
 * placeholder.
 */
export function readWhaleArt<T extends WhaleFrame>(
  data: unknown,
  assets: readonly T[],
): WhaleArt<T> | undefined {
  return readWhaleKinds(KINDS, data, assets);
}

/**
 * Phantom uses the core frames of Marlo and the nursery's adult and the shared metadata,
 * without Whirlpool's calves.
 */
export function readMarloArt<T extends WhaleFrame>(
  data: unknown,
  assets: readonly T[],
): WhaleArt<T> | undefined {
  const art = readWhaleKinds(["whale", "adult"], data, assets);
  return art && { ...art, family: [] };
}

function readWhaleKinds<T extends WhaleFrame>(
  required: readonly WhaleKind[],
  data: unknown,
  assets: readonly T[],
): WhaleArt<T> | undefined {
  const root = fields(data);
  if (root?.version !== 1 || !Array.isArray(root.kinds) || !Array.isArray(root.family)) {
    return undefined;
  }
  const kinds = new Map<WhaleKind, WhaleKindArt<T>>();
  for (const entry of root.kinds as unknown[]) {
    const kind = fields(entry);
    if (!isKind(kind?.kind)) {
      return undefined;
    }
    if (!required.includes(kind.kind)) {
      continue;
    }
    const loop = fields(kind?.loop);
    const headings = Array.isArray(kind?.headings) ? (kind.headings as unknown[]) : [];
    if (
      !loop ||
      !Number.isInteger(loop.frames) ||
      !positive(loop.frames) ||
      !positive(loop.idleMs) ||
      !positive(loop.swimMs) ||
      !Number.isInteger(kind.stationaryHeading) ||
      headings.length !== HEADINGS
    ) {
      return undefined;
    }
    const name = kind.kind;
    const footprints: number[] = [];
    const viewBoxes: WhaleKindArt["viewBoxes"][number][] = [];
    for (const heading of headings) {
      const value = fields(heading);
      if (!Number.isInteger(value?.index) || !positive(value?.footprintRadius)) {
        return undefined;
      }
      const index = value.index as number;
      footprints[index] = value.footprintRadius as number;
      const frame = fields(value.frame);
      viewBoxes[index] =
        positive(frame?.height) && positive(frame.width)
          ? { height: frame.height, width: frame.width }
          : undefined;
    }
    const frames: T[][] = [];
    for (let heading = 0; heading < HEADINGS; heading++) {
      const loopFrames: T[] = [];
      for (let frame = 0; frame < (loop.frames as number); frame++) {
        const asset = assets.find(
          (candidate) => candidate.id === `whale-${name}-${heading}-${frame}`,
        );
        if (
          !asset ||
          asset.kind !== name ||
          asset.directionIndex !== heading ||
          asset.loopFrame !== frame ||
          !positive(asset.displayWidth) ||
          !positive(asset.displayHeight)
        ) {
          return undefined;
        }
        loopFrames.push(asset);
      }
      frames.push(loopFrames);
    }
    if (footprints.length !== HEADINGS || footprints.some((value) => value === undefined)) {
      return undefined;
    }
    kinds.set(name, {
      footprints,
      frames,
      idleMs: loop.idleMs as number,
      stationaryHeading: kind.stationaryHeading as number,
      swimMs: loop.swimMs as number,
      viewBoxes,
    });
  }
  const family: WhaleArt["family"][number][] = [];
  for (const entry of root.family as unknown[]) {
    const member = fields(entry);
    const offset = member?.offset;
    if (
      !isKind(member?.kind) ||
      !Array.isArray(offset) ||
      offset.length !== 2 ||
      !offset.every((value) => typeof value === "number" && Number.isFinite(value))
    ) {
      return undefined;
    }
    if (required.includes(member.kind)) {
      family.push({
        kind: member.kind,
        offset: { x: offset[0] as number, y: offset[1] as number },
      });
    }
  }
  const reduced = fields(root.reducedMotion)?.frame;
  if (required.some((kind) => !kinds.has(kind)) || !Number.isInteger(reduced)) {
    return undefined;
  }
  return { family, kinds, reducedFrame: reduced as number };
}

/**
 * The family members drawn at the family destination: all of them, or without the `calf` while
 * it is away being guided, so a calf never shows twice (art/whales.md "Placement").
 */
export function familyMembers(
  calfAway: boolean,
  family: WhaleArt["family"],
): WhaleArt["family"][number][] {
  return family.filter(({ kind }) => !calfAway || kind !== "calf");
}

/** A stable start phase per whale, so a family never beats in step. */
export function whalePhase(id: string, loopMs: number): number {
  let n = 2166136261;
  for (let index = 0; index < id.length; index++) {
    n = Math.imul(n ^ id.charCodeAt(index), 16777619);
  }
  return (n >>> 0) % Math.max(1, Math.round(loopMs));
}

/**
 * The loop frame at `timeMs`: idle timing at rest, swim timing while travelling, from the
 * whale's own phase; reduced motion holds the reduced frame.
 */
export function whaleLoopFrame(
  art: Pick<WhaleArt, "reducedFrame">,
  kind: Pick<WhaleKindArt, "frames" | "idleMs" | "swimMs">,
  moving: boolean,
  reducedMotion: boolean,
  phaseMs: number,
  timeMs: number,
): number {
  if (reducedMotion) {
    return art.reducedFrame;
  }
  const count = kind.frames[0]!.length;
  const frameMs = moving ? kind.swimMs : kind.idleMs;
  return Math.floor((timeMs + phaseMs) / frameMs) % count;
}

/** Manifest whale frames, which load on demand rather than at boot. */
export function whaleFrameAsset(asset: { id: string; kind?: unknown }): boolean {
  return asset.id.startsWith("whale-") && typeof asset.kind === "string";
}

/** The raw viewport for a packed frame, identified by its kind and heading. */
export function whaleViewBox(art: WhaleArt | undefined, frame: WhaleFrame) {
  return isKind(frame.kind) && frame.directionIndex !== undefined
    ? art?.kinds.get(frame.kind)?.viewBoxes[frame.directionIndex]
    : undefined;
}
