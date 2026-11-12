import type { Vec } from "../model/types.ts";

/** One rear engine mouth in a heading frame, in frame pixels. */
export interface JetMouth {
  /** Projected mouth midpoint. */
  anchor: Vec;
  /** Projected rear direction per ship unit. */
  axis: Vec;
  /** Projected half mouth-width vector. */
  half: Vec;
  /** The engine hardpoint that drives this mouth, on a composed craft. */
  hardpoint?: string;
}

export interface JetLayer {
  /** Linear opacity ramp over f; absent means opaque. */
  alpha?: { from: number; max: number; to: number };
  /** Colours at f = 0 and f = 1; a single colour repeats. */
  colors: readonly [number, number];
  /** Multiple of the jet length. */
  length: number;
  /** Multiple of the half mouth width. */
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
}

/** A craft's jets: the geometry and one set of layers, as an enemy's or composed craft's file. */
export interface ShipJets extends JetGeometry {
  /** Triangles per mouth in draw order. */
  layers: readonly JetLayer[];
}

/** Art's ship-jets.json for Ada: the geometry and her layers by Engine level. */
export interface EngineJets extends JetGeometry {
  /** Layers by Engine level, index 0 for level 1 (`engineLevels`), never empty. */
  engineLevels: readonly (readonly JetLayer[])[];
}

/** Maps heading-frame pixels to display pixels relative to the ship sprite origin. */
export interface JetDisplay {
  displayHeight: number;
  displayWidth: number;
  pivot: Vec;
}

export interface JetTriangle {
  alpha: number;
  color: number;
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
  if (!layer || !finite(layer.width) || !finite(layer.length)) {
    return undefined;
  }
  const single = readColor(layer.color);
  const pair = Array.isArray(layer.colors) && layer.colors.length === 2 ? layer.colors : [];
  const from = single ?? readColor(pair[0]);
  const to = single ?? readColor(pair[1]);
  if (from === undefined || to === undefined) {
    return undefined;
  }
  const result: JetLayer = { colors: [from, to], length: layer.length, width: layer.width };
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
  };
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
    if (
      !anchor ||
      !axis ||
      !half ||
      (mouth!.hardpoint !== undefined && typeof mouth!.hardpoint !== "string")
    ) {
      return undefined;
    }
    mouths.push(
      typeof mouth!.hardpoint === "string"
        ? { anchor, axis, half, hardpoint: mouth!.hardpoint }
        : { anchor, axis, half },
    );
  }
  return mouths;
}

/** Validates a jet file's version, frame, length rule and headings. */
function readJetGeometry(root: Fields | undefined): JetGeometry | undefined {
  const length = fields(root?.length);
  if (
    !root ||
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
    if (!Number.isInteger(index) || headings[index as number] || !mouths) {
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
    length: { base: length.base, exponent: length.exponent, scale: length.scale },
  };
}

/** Validates a craft's jet file with one set of `layers`; any malformed entry disables its jets. */
export function readShipJets(value: unknown): ShipJets | undefined {
  const root = fields(value);
  const geometry = readJetGeometry(root);
  const layers = readJetLayers(root?.layers);
  return geometry && layers ? { ...geometry, layers } : undefined;
}

/** Validates Art's ship-jets.json, Ada's `engineLevels`; any malformed entry disables her jets. */
export function readEngineJets(value: unknown): EngineJets | undefined {
  const root = fields(value);
  const geometry = readJetGeometry(root);
  const engineLevels = readLevelLayers(root?.engineLevels);
  return geometry && engineLevels ? { ...geometry, engineLevels } : undefined;
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

export function layerAlpha(layer: JetLayer, f: number): number {
  if (!layer.alpha) {
    return 1;
  }
  const { from, max, to } = layer.alpha;
  return Math.min(1, Math.max(0, (f - from) / (to - from))) * max;
}

/** Filled triangles per mouth in layer order; empty at f = 0. */
export function jetTriangles(
  jets: ShipJets,
  display: JetDisplay,
  direction: number,
  f: number,
): JetTriangle[] {
  const mouths = jets.headings[direction];
  const fraction = Math.min(1, f);
  if (!mouths || !(fraction > 0)) {
    return [];
  }
  const sx = display.displayWidth / jets.frame;
  const sy = display.displayHeight / jets.frame;
  const ox = display.pivot.x * jets.frame;
  const oy = display.pivot.y * jets.frame;
  const toDisplay = (x: number, y: number): Vec => ({ x: (x - ox) * sx, y: (y - oy) * sy });
  const length = jetLength(jets, fraction);
  const triangles: JetTriangle[] = [];
  for (const { anchor, axis, half } of mouths) {
    for (const layer of jets.layers) {
      const alpha = layerAlpha(layer, fraction);
      if (alpha <= 0) {
        continue;
      }
      const hx = half.x * layer.width;
      const hy = half.y * layer.width;
      const tip = length * layer.length;
      triangles.push({
        alpha,
        color: layerColor(layer, fraction),
        points: [
          toDisplay(anchor.x + hx, anchor.y + hy),
          toDisplay(anchor.x + axis.x * tip, anchor.y + axis.y * tip),
          toDisplay(anchor.x - hx, anchor.y - hy),
        ],
      });
    }
  }
  return triangles;
}
