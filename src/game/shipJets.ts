import { type JetProfile, jetShapePolygons, layerAlpha, validJetProfile } from "./jetGeometry.ts";
export { layerAlpha } from "./jetGeometry.ts";

import { readShipHeadingContract, SHIP_HEADINGS } from "../model/shipHeadingContract.ts";
import type { Vec } from "../model/types.ts";

/** The existing thrust cutoff suppresses direction changes while the ship is effectively still. */
export function shipJetDirection(facing: Vec, velocity: Vec): "forward" | "reverse" | undefined {
  if (!(Math.hypot(velocity.x, velocity.y) > 1)) {
    return undefined;
  }
  return facing.x * velocity.x + facing.y * velocity.y < 0 ? "reverse" : "forward";
}

/** One engine mouth in a heading frame, in frame pixels. */
export interface JetMouth {
  /** Projected plume root. */
  anchor: Vec;
  /** Projected exhaust direction per ship unit. */
  axis: Vec;
  /** Projected vector across the plume per ship unit, or per half mouth width on enemy craft. */
  half: Vec;
  /** Projected hull regions nearer than this mouth's exhaust plane, in heading-frame pixels. */
  occluders?: readonly (readonly Vec[])[];
  /** The engine hardpoint that drives this mouth, on a composed craft. */
  hardpoint?: string;
}

export interface JetLayer {
  /** Authored layer role, such as `outer` or `core`. */
  name?: string;
  /** Linear opacity ramp over f; absent means opaque. */
  alpha?: { from: number; max: number; to: number };
  /** Colours at f = 0 and f = 1; a single colour repeats. */
  colors: readonly [number, number];
  /** Multiple of the jet length. */
  length: number;
  /** Multiple of the `half` vector. */
  width: number;
}

/** A jet file's mouths and length rule, version 1, which every craft's jets share. */
export interface JetGeometry {
  /** Square heading frame size in pixels. */
  frame: number;
  /** Mouths indexed by ship direction; the count must match the directional ship frames. */
  headings: readonly (readonly JetMouth[])[];
  /** Jet length in ship units: base + scale * f ^ exponent. */
  length: { base: number; exponent: number; scale: number };
  /** Plume outline samples; absent draws a triangle from the mouth sides to the tip. */
  profile?: JetProfile;
}

/** A craft's jets: the geometry and one set of layers, as an enemy's or composed craft's file. */
export interface ShipJets extends JetGeometry {
  /** Polygons per mouth in draw order. */
  layers: readonly JetLayer[];
}

/** Art's ship-jets.json or ship-retro-jets.json for Ada: the geometry and layers by Engine level. */
export interface EngineJets extends JetGeometry {
  /** Layers by Engine level, index 0 for level 1 (`engineLevels`), never empty. */
  engineLevels: readonly (readonly JetLayer[])[];
  profile: JetProfile;
}

/** Maps heading-frame pixels to display pixels relative to the ship sprite origin. */
export interface JetDisplay {
  displayHeight: number;
  displayWidth: number;
  /** Project optional nearer-surface masks only for consumers that render them. */
  includeOccluders?: boolean;
  pivot: Vec;
}

export interface JetTriangle {
  alpha: number;
  color: number;
  /** Authored nearer surfaces in the same pivot-relative display coordinates as the triangle. */
  occluders?: readonly (readonly Vec[])[];
  points: readonly [Vec, Vec, Vec];
}

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function readVec(value: unknown): Vec | undefined {
  return Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1])
    ? { x: value[0], y: value[1] }
    : undefined;
}

function readColor(value: unknown): number | undefined {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? Number.parseInt(value.slice(1), 16)
    : undefined;
}

function readLayer(value: unknown): JetLayer | undefined {
  const layer = fields(value);
  if (
    !layer ||
    !finite(layer.width) ||
    !finite(layer.length) ||
    (layer.name !== undefined && typeof layer.name !== "string")
  ) {
    return undefined;
  }
  const single = readColor(layer.color);
  const pair = Array.isArray(layer.colors) && layer.colors.length === 2 ? layer.colors : [];
  const from = single ?? readColor(pair[0]);
  const to = single ?? readColor(pair[1]);
  if (from === undefined || to === undefined) {
    return undefined;
  }
  const result: JetLayer = {
    colors: [from, to],
    length: layer.length,
    width: layer.width,
    ...(typeof layer.name === "string" ? { name: layer.name } : {}),
  };
  if (layer.alpha !== undefined) {
    const alpha = fields(layer.alpha);
    if (!alpha || !finite(alpha.from) || !finite(alpha.to) || !finite(alpha.max)) {
      return undefined;
    }
    if (alpha.to <= alpha.from) {
      return undefined;
    }
    result.alpha = { from: alpha.from, max: alpha.max, to: alpha.to };
  }
  return result;
}

/** Art's jet layers in draw order; undefined if the list is empty or any layer is malformed. */
export function readJetLayers(value: unknown): JetLayer[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  const layers: JetLayer[] = [];
  for (const entry of value as unknown[]) {
    const layer = readLayer(entry);
    if (!layer) {
      return undefined;
    }
    layers.push(layer);
  }
  return layers;
}

/**
 * Art's per-level jet layers, `[{ level, layers }]` with levels 1 to n each once, indexed by level
 * less 1; undefined if the list is empty or any entry is malformed.
 */
export function readLevelLayers(value: unknown): JetLayer[][] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  const levels: JetLayer[][] = [];
  for (const entry of value as unknown[]) {
    const level = fields(entry)?.level;
    const layers = readJetLayers(fields(entry)?.layers);
    if (
      !Number.isInteger(level) ||
      (level as number) < 1 ||
      (level as number) > value.length ||
      levels[(level as number) - 1] ||
      !layers
    ) {
      return undefined;
    }
    levels[(level as number) - 1] = layers;
  }
  return levels;
}

/** The layers for upgrade level `level` of a non-empty level list (outside 1 to n, the nearest). */
export function levelLayers(
  levels: readonly (readonly JetLayer[])[],
  level: number,
): readonly JetLayer[] {
  return levels[Math.min(levels.length, Math.max(1, Math.round(level))) - 1]!;
}

/** Ada's jets at Engine level `level`: the geometry with that level's layers. */
export function engineJets(jets: EngineJets, level: number): ShipJets {
  return {
    frame: jets.frame,
    headings: jets.headings,
    layers: levelLayers(jets.engineLevels, level),
    length: jets.length,
    profile: jets.profile,
  };
}

/**
 * Travel selects the forward or reverse geometry and its layers; a light field recolours each layer
 * with its same-named field layer and keeps the geometry's widths and lengths.
 */
export function travelJets(
  main: EngineJets | undefined,
  reverse: EngineJets | undefined,
  fieldLevels: readonly (readonly JetLayer[])[] | undefined,
  level: number,
  direction: "forward" | "reverse" | undefined,
): ShipJets | undefined {
  const geometry = direction === "reverse" ? reverse : main;
  if (!geometry) {
    return undefined;
  }
  const own = levelLayers(geometry.engineLevels, level);
  const field = fieldLevels?.length ? levelLayers(fieldLevels, level) : undefined;
  const layers: JetLayer[] = [];
  for (const layer of own) {
    const colors = field ? field.find(({ name }) => name === layer.name)?.colors : layer.colors;
    if (!colors) {
      return undefined;
    }
    layers.push({ ...layer, colors });
  }
  return { ...engineJets(geometry, level), layers };
}

function readOccluders(value: unknown): Vec[][] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const polygons: Vec[][] = [];
  for (const polygon of value as unknown[]) {
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return undefined;
    }
    const points = (polygon as unknown[]).map(readVec);
    if (points.some((point) => point === undefined)) {
      return undefined;
    }
    polygons.push(points as Vec[]);
  }
  return polygons;
}

function readMouths(value: unknown): JetMouth[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  const mouths: JetMouth[] = [];
  for (const entry of value as unknown[]) {
    const mouth = fields(entry);
    const anchor = readVec(mouth?.anchor);
    const axis = readVec(mouth?.axis);
    const half = readVec(mouth?.half);
    const occluders = mouth?.occluders === undefined ? undefined : readOccluders(mouth.occluders);
    if (
      !anchor ||
      !axis ||
      !half ||
      (mouth!.occluders !== undefined && occluders === undefined) ||
      (mouth!.hardpoint !== undefined && typeof mouth!.hardpoint !== "string")
    ) {
      return undefined;
    }
    mouths.push({
      anchor,
      axis,
      half,
      ...(typeof mouth!.hardpoint === "string" ? { hardpoint: mouth!.hardpoint } : {}),
      ...(occluders === undefined ? {} : { occluders }),
    });
  }
  return mouths;
}

function readProfile(value: unknown): JetProfile | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const samples: (readonly [number, number])[] = [];
  for (const sample of value as unknown[]) {
    if (!Array.isArray(sample) || sample.length !== 2 || !finite(sample[0]) || !finite(sample[1])) {
      return undefined;
    }
    samples.push([sample[0], sample[1]]);
  }
  return validJetProfile(samples) ? samples : undefined;
}

/** Validates a jet file's version, frame, length rule, optional profile and headings. */
export function readJetGeometry(value: unknown): JetGeometry | undefined {
  const root = fields(value);
  const length = fields(root?.length);
  const profile = root?.profile === undefined ? undefined : readProfile(root.profile);
  if (
    !root ||
    (root.profile !== undefined && !profile) ||
    root.version !== 1 ||
    !finite(root.frame) ||
    root.frame <= 0 ||
    !length ||
    !finite(length.base) ||
    !finite(length.scale) ||
    !finite(length.exponent) ||
    !Array.isArray(root.headings) ||
    root.headings.length === 0
  ) {
    return undefined;
  }
  const headings: JetMouth[][] = [];
  for (const entry of root.headings as unknown[]) {
    const heading = fields(entry);
    const index = heading?.index;
    const mouths = readMouths(heading?.mouths);
    if (
      !Number.isInteger(index) ||
      (index as number) < 0 ||
      (index as number) >= root.headings.length ||
      headings[index as number] ||
      !mouths
    ) {
      return undefined;
    }
    headings[index as number] = mouths;
  }
  for (let index = 0; index < root.headings.length; index++) {
    if (!headings[index]) {
      return undefined;
    }
  }
  return {
    frame: root.frame,
    headings,
    length: {
      base: length.base,
      exponent: length.exponent,
      scale: length.scale,
    },
    ...(profile ? { profile } : {}),
  };
}

/** Validates a craft's jet file with one set of `layers`; any malformed entry disables its jets. */
export function readShipJets(value: unknown): ShipJets | undefined {
  const root = fields(value);
  const geometry = readJetGeometry(root);
  const layers = readJetLayers(root?.layers);
  return geometry && layers ? { ...geometry, layers } : undefined;
}

/** Validates Art's Ada jet files, `engineLevels` and `profile`; any malformed entry disables them. */
export function readEngineJets(value: unknown): EngineJets | undefined {
  const root = fields(value);
  const geometry = readJetGeometry(root);
  const engineLevels = readLevelLayers(root?.engineLevels);
  return geometry?.profile &&
    engineLevels &&
    readShipHeadingContract(root?.shipHeadings) &&
    geometry.headings.length === SHIP_HEADINGS
    ? { ...geometry, engineLevels, profile: geometry.profile }
    : undefined;
}

/**
 * Plumes whose every mouth carries hull occluders draw above the hull, which is then redrawn
 * inside the occluders; others draw behind the hull.
 */
export function jetsInFront(jets: JetGeometry | undefined, heading: number): boolean {
  const mouths = jets?.headings[heading];
  return (
    mouths !== undefined &&
    mouths.length > 0 &&
    mouths.every((mouth) => mouth.occluders !== undefined && mouth.occluders.length > 0)
  );
}

/** The occluder regions of plumes drawn in front, in display coordinates, deduplicated. */
export function jetOccluderRegions(
  jets: JetGeometry | undefined,
  display: JetDisplay,
  heading: number,
): readonly (readonly Vec[])[] {
  if (!jets || !jetsInFront(jets, heading)) {
    return [];
  }
  const toDisplay = displayMapping(jets.frame, display);
  const regions = new Map<string, readonly Vec[]>();
  for (const mouth of jets.headings[heading]!) {
    for (const polygon of mouth.occluders!) {
      const region = polygon.map(({ x, y }) => toDisplay(x, y));
      regions.set(JSON.stringify(region), region);
    }
  }
  return [...regions.values()];
}

function displayMapping(frame: number, display: JetDisplay): (x: number, y: number) => Vec {
  const sx = display.displayWidth / frame;
  const sy = display.displayHeight / frame;
  const ox = display.pivot.x * frame;
  const oy = display.pivot.y * frame;
  return (x, y) => ({ x: (x - ox) * sx, y: (y - oy) * sy });
}

/** Jet length in ship units at speed fraction f. */
export function jetLength(jets: JetGeometry, f: number): number {
  return jets.length.base + jets.length.scale * f ** jets.length.exponent;
}

/** Layer colour interpolated linearly per sRGB channel. */
export function layerColor(layer: JetLayer, f: number): number {
  const [from, to] = layer.colors;
  let color = 0;
  for (const shift of [16, 8, 0]) {
    const a = (from >> shift) & 255;
    const b = (to >> shift) & 255;
    color |= Math.round(a + (b - a) * f) << shift;
  }
  return color;
}

/** One layer's plume at one mouth in display coordinates: its outline and that outline's fill. */
export interface JetPlume {
  alpha: number;
  color: number;
  /** Authored nearer surfaces in the same pivot-relative display coordinates as the plume. */
  occluders?: readonly (readonly Vec[])[];
  /** The outline, for vector and canvas consumers that fill one path per plume. */
  points: readonly Vec[];
  /** The outline as triangles, for consumers that fill triangles. */
  triangles: readonly (readonly [Vec, Vec, Vec])[];
}

/** Plumes per mouth in layer order; empty at f = 0. */
export function jetPlumes(
  jets: ShipJets,
  display: JetDisplay,
  direction: number,
  f: number,
): JetPlume[] {
  const mouths = jets.headings[direction];
  const fraction = Math.min(1, f);
  if (!mouths || !(fraction > 0)) {
    return [];
  }
  const toDisplay = displayMapping(jets.frame, display);
  const map = ({ x, y }: Vec) => toDisplay(x, y);
  const length = jetLength(jets, fraction);
  const plumes: JetPlume[] = [];
  for (const mouth of mouths) {
    const occluders = display.includeOccluders
      ? mouth.occluders?.map((polygon) => polygon.map(map))
      : undefined;
    for (const { layerIndex, points, triangles } of jetShapePolygons(
      mouth,
      jets.layers,
      length,
      fraction,
      jets.profile,
    )) {
      const layer = jets.layers[layerIndex]!;
      plumes.push({
        alpha: layerAlpha(layer, fraction),
        color: layerColor(layer, fraction),
        ...(occluders === undefined ? {} : { occluders }),
        points: points.map(map),
        triangles: triangles.map(([a, b, c]) => [map(a), map(b), map(c)] as const),
      });
    }
  }
  return plumes;
}

/** Filled triangles per mouth in layer order; empty at f = 0. */
export function jetTriangles(
  jets: ShipJets,
  display: JetDisplay,
  direction: number,
  f: number,
): JetTriangle[] {
  return jetPlumes(jets, display, direction, f).flatMap(({ alpha, color, occluders, triangles }) =>
    triangles.map((points) => ({
      alpha,
      color,
      ...(occluders === undefined ? {} : { occluders }),
      points,
    })),
  );
}
