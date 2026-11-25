import {
  centeredReverseLayers,
  jetShapeLayerAlpha,
  jetShapeLayerColor,
  jetShapePolygons,
  validCenteredReverseShapes,
} from "./jetGeometry.ts";
export {
  coreOutboardOffset,
  jetShapeLayerAlpha,
  jetShapeLayerColor,
  layerAlpha,
} from "./jetGeometry.ts";

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
  /** Projected mouth midpoint. */
  anchor: Vec;
  /** Centered aperture profile: core base width as a fraction of the full opening. */
  normalAperture?: { readonly coreWidth: number };
  /** Art selects the upper or near underside corner anchoring the whole visible jet group. */
  outerCorner?: Vec;
  /** Uses the selected outer/core geometry to move the canonical core outboard within its outer. */
  coreOutboard?: true;
  /** The calibrated frame-space half-plane retaining the forward side of the wing rear. */
  rearClip?: { readonly constant: number; readonly normal: Vec };
  /** Projected exhaust direction per ship unit. */
  axis: Vec;
  /** Projected half mouth-width vector. */
  half: Vec;
  /** Projected surfaces nearer than this mouth's exhaust plane, in heading-frame pixels. */
  occluders?: readonly (readonly Vec[])[];
  /** The engine hardpoint that drives this mouth, on a composed craft. */
  hardpoint?: string;
}

export interface JetLayer {
  /** Authored material role, including the opaque outer layer. */
  name?: string;
  /** Linear opacity ramp over f; absent means opaque. */
  alpha?: { from: number; max: number; to: number };
  /** Colours at f = 0 and f = 1; a single colour repeats. */
  colors: readonly [number, number];
  /** Opaque normal-aperture outer colour authored by the material compositor. */
  normalColor?: number;
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

/** Largest logical player-frame dimension that omits the authored central core. */
export const SMALL_JET_CORE_MAX_DISPLAY = 42;

/** A craft's jets: the geometry and one set of layers, as an enemy's or composed craft's file. */
export interface ShipJets extends JetGeometry {
  /** Authored reverse profile retained for render-only size policy. */
  reverseStyle?: "centered-main";
  /** Triangles per mouth in draw order. */
  layers: readonly JetLayer[];
}

/** Art's ship-jets.json for Ada: the geometry and her layers by Engine level. */
export interface EngineJets extends JetGeometry {
  /** Reverse-only centered opaque shapes using selected main exhaust materials. */
  reverseStyle?: "centered-main";
  /** Layers by Engine level, index 0 for level 1 (`engineLevels`), never empty. */
  engineLevels: readonly (readonly JetLayer[])[];
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
  const normalColor = layer.normalColor === undefined ? undefined : readColor(layer.normalColor);
  if (layer.normalColor !== undefined && normalColor === undefined) {
    return undefined;
  }
  const result: JetLayer = {
    colors: [from, to],
    ...(normalColor === undefined ? {} : { normalColor }),
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
    ...(jets.reverseStyle === undefined ? {} : { reverseStyle: jets.reverseStyle }),
    length: jets.length,
  };
}

/** Travel selects geometry; explicit reverse style adapts selected main material to its shapes. */
export function travelJets(
  main: EngineJets | undefined,
  reverse: EngineJets | undefined,
  fieldLevels: readonly (readonly JetLayer[])[] | undefined,
  level: number,
  direction: "forward" | "reverse" | undefined,
): ShipJets | undefined {
  const geometry = direction === "reverse" ? reverse : main;
  if (!main || !geometry) {
    return undefined;
  }
  const authoredMaterial =
    (direction === "reverse" && geometry.reverseStyle === "centered-main") ||
    (direction === "forward" &&
      geometry.headings.some((mouths) =>
        mouths.some((mouth) => mouth.normalAperture !== undefined),
      ));
  const selected = levelLayers(
    authoredMaterial ? main.engineLevels : (fieldLevels ?? main.engineLevels),
    level,
  );
  const layers =
    direction === "reverse" && geometry.reverseStyle === "centered-main"
      ? centeredReverseLayers(
          levelLayers(main.engineLevels, level),
          selected,
          levelLayers(geometry.engineLevels, level),
        )
      : selected;
  return layers ? { ...engineJets(geometry, level), layers } : undefined;
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
    const outerCorner = mouth?.outerCorner === undefined ? undefined : readVec(mouth.outerCorner);
    const clip = fields(mouth?.rearClip);
    const normal = readVec(clip?.normal);
    const rearClip =
      normal && Math.hypot(normal.x, normal.y) > 0 && finite(clip?.constant)
        ? { constant: clip.constant, normal }
        : undefined;
    const malformedCorner = mouth?.outerCorner !== undefined && !outerCorner;
    const malformedClip = mouth?.rearClip !== undefined && (!outerCorner || !rearClip);
    const malformedCore =
      mouth?.coreOutboard !== undefined && (mouth.coreOutboard !== true || !outerCorner);
    const aperture = fields(mouth?.normalAperture);
    const coreWidth = aperture?.coreWidth;
    const normalAperture =
      finite(coreWidth) && coreWidth > 0 && coreWidth < 1 ? { coreWidth } : undefined;
    const malformedAperture =
      mouth?.normalAperture !== undefined &&
      (!normalAperture ||
        mouth.outerCorner !== undefined ||
        mouth.coreOutboard !== undefined ||
        mouth.rearClip !== undefined);
    const occluders = mouth?.occluders === undefined ? undefined : readOccluders(mouth.occluders);
    if (
      !anchor ||
      !axis ||
      !half ||
      malformedCorner ||
      malformedClip ||
      malformedCore ||
      malformedAperture ||
      (mouth!.occluders !== undefined && occluders === undefined) ||
      (mouth!.hardpoint !== undefined && typeof mouth!.hardpoint !== "string")
    ) {
      return undefined;
    }
    mouths.push({
      anchor,
      axis,
      half,
      ...(normalAperture ? { normalAperture } : {}),
      ...(outerCorner ? { outerCorner } : {}),
      ...(mouth!.coreOutboard === true ? { coreOutboard: true as const } : {}),
      ...(rearClip ? { rearClip } : {}),
      ...(typeof mouth!.hardpoint === "string" ? { hardpoint: mouth!.hardpoint } : {}),
      ...(occluders === undefined ? {} : { occluders }),
    });
  }
  return mouths;
}

/** Validates a jet file's version, frame, length rule and headings. */
/** Validates geometry independently of the selected runtime material. */
export function readJetGeometry(value: unknown): JetGeometry | undefined {
  const root = fields(value);
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
  const reverseStyle = root?.reverseStyle;
  if (
    reverseStyle !== undefined &&
    (reverseStyle !== "centered-main" ||
      !geometry ||
      !engineLevels ||
      geometry.headings.some((mouths) =>
        mouths.some(
          (mouth) =>
            !mouth.outerCorner ||
            !mouth.rearClip ||
            mouth.coreOutboard !== undefined ||
            mouth.normalAperture !== undefined,
        ),
      ) ||
      engineLevels.some((layers) => !validCenteredReverseShapes(layers)))
  ) {
    return undefined;
  }
  return geometry &&
    engineLevels &&
    readShipHeadingContract(root?.shipHeadings) &&
    geometry.headings.length === SHIP_HEADINGS
    ? { ...geometry, engineLevels, ...(reverseStyle === undefined ? {} : { reverseStyle }) }
    : undefined;
}

/** Only explicitly normal aperture mouths draw their complete triangles in front of the hull. */
export function normalJetsInFront(jets: JetGeometry | undefined, heading: number): boolean {
  const mouths = jets?.headings[heading];
  return (
    mouths !== undefined &&
    mouths.length > 0 &&
    mouths.every((mouth) => mouth.normalAperture !== undefined)
  );
}

/** Exact authored tail regions in display coordinates, deduplicated across normal plumes. */
export function normalJetTailRegions(
  jets: ShipJets | undefined,
  display: JetDisplay,
  heading: number,
): readonly (readonly Vec[])[] {
  if (!jets || !normalJetsInFront(jets, heading)) {
    return [];
  }
  const regions = new Map<string, readonly Vec[]>();
  for (const triangle of jetTriangles(jets, { ...display, includeOccluders: true }, heading, 1)) {
    for (const region of triangle.occluders ?? []) {
      regions.set(JSON.stringify(region), region);
    }
  }
  return [...regions.values()];
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
  const toDisplay = (x: number, y: number): Vec => ({
    x: (x - ox) * sx,
    y: (y - oy) * sy,
  });
  const length = jetLength(jets, fraction);
  const triangles: JetTriangle[] = [];
  for (const mouth of mouths) {
    const smallProfile =
      (mouth.normalAperture !== undefined || jets.reverseStyle === "centered-main") &&
      Math.max(display.displayWidth, display.displayHeight) <= SMALL_JET_CORE_MAX_DISPLAY;
    const displayOccluders = display.includeOccluders
      ? mouth.occluders?.map((polygon) => polygon.map(({ x, y }) => toDisplay(x, y)))
      : undefined;
    for (const { layerIndex, points: clipped } of jetShapePolygons(
      mouth,
      jets.layers,
      length,
      fraction,
    )) {
      const layer = jets.layers[layerIndex]!;
      if (layer.name === "core" && smallProfile) {
        continue;
      }
      const alpha = jetShapeLayerAlpha(mouth, layer, layerIndex, fraction);
      for (let i = 1; i + 1 < clipped.length; i++) {
        const a = clipped[0]!,
          b = clipped[i]!,
          c = clipped[i + 1]!;
        triangles.push({
          alpha,
          color: jetShapeLayerColor(
            mouth,
            layer,
            layerIndex,
            smallProfile && layer.name === "outer" ? layer.colors[0] : layerColor(layer, fraction),
          ),
          ...(displayOccluders === undefined ? {} : { occluders: displayOccluders }),
          points: [toDisplay(a.x, a.y), toDisplay(b.x, b.y), toDisplay(c.x, c.y)],
        });
      }
    }
  }
  return triangles;
}
