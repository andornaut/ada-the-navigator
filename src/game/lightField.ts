import GALAXIES_FILE from "../../public/art/galaxies.json" with { type: "json" };
import { type JetLayer, readJetLayers, readLevelLayers } from "../art/index.ts";
import type { EffectShape } from "../art/weaponEffects.ts";
import { byGalaxy } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { Vec } from "../model/types.ts";

// Art's light-field rule (art/galaxies.md "Light fields"): in every galaxy, light field or
// Phantom's dark one, play objects sit in ink keylines, effects draw over ink edges and the
// outermost glows turn to ink. Home and the base field draw none of it. Widths are logical px.

export interface LightField {
  /** The wider keyline destinations take, and the keylined kinds that are destinations. */
  readonly destinationKeyline: { readonly kinds: readonly string[]; readonly width: number };
  readonly effects: readonly string[];
  readonly holodiskBeacon: string;
  readonly hudOutline: number;
  readonly indicatorStroke: number;
  readonly ink: number;
  /**
   * Whether a keylined craft's drawn jets join its keyline silhouette, and the kinds whose jets
   * stay outside it (Ada's ship).
   */
  readonly jetKeyline: { readonly exempt: readonly string[]; readonly join: boolean };
  readonly jets: {
    readonly enemy: readonly JetLayer[];
    /** Ada's layers by Engine level, index 0 for level 1 (`shipLevels`). */
    readonly shipLevels: readonly (readonly JetLayer[])[];
  };
  readonly keyline: number;
  readonly keylined: readonly string[];
  /** The ink outline around each edge marker on a light field. */
  readonly markerOutline: number;
  /** Ada's Phaser: its amber band and outer bloom disc grow by `edge` px in the field edge. */
  readonly phaser: { readonly edge: number };
  readonly shotEdge: number;
}

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const names = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");
const colour = (value: unknown): number | undefined =>
  typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value)
    ? Number.parseInt(value.slice(1), 16)
    : undefined;

/** Validates galaxies.json's `lightField`; undefined if any part is missing or malformed. */
export function readLightField(value: unknown): LightField | undefined {
  const rule = fields(fields(value)?.lightField);
  const phaser = fields(rule?.phaser);
  const jets = fields(rule?.jets);
  const outline = fields(rule?.hudOutline);
  const destination = fields(rule?.destinationKeyline);
  const jetKeyline = fields(rule?.jetKeyline);
  const ink = colour(rule?.ink);
  const enemy = readJetLayers(jets?.enemy);
  const shipLevels = readLevelLayers(jets?.shipLevels);
  if (
    !rule ||
    ink === undefined ||
    !enemy ||
    !shipLevels ||
    !positive(rule.keyline) ||
    !positive(rule.shotEdge) ||
    !positive(rule.indicatorStroke) ||
    !positive(rule.markerOutline) ||
    !positive(outline?.width) ||
    !positive(destination?.width) ||
    !names(destination?.kinds) ||
    typeof jetKeyline?.join !== "boolean" ||
    !names(jetKeyline.exempt) ||
    !names(rule.keylined) ||
    !names(rule.effects) ||
    typeof rule.holodiskBeacon !== "string" ||
    !positive(phaser?.edge)
  ) {
    return undefined;
  }
  return {
    destinationKeyline: { kinds: destination.kinds, width: destination.width },
    effects: rule.effects,
    holodiskBeacon: rule.holodiskBeacon,
    hudOutline: outline.width,
    indicatorStroke: rule.indicatorStroke,
    ink,
    jetKeyline: { exempt: jetKeyline.exempt, join: jetKeyline.join },
    jets: { enemy, shipLevels },
    keyline: rule.keyline,
    keylined: rule.keylined,
    markerOutline: rule.markerOutline,
    phaser: { edge: phaser.edge },
    shotEdge: rule.shotEdge,
  };
}

/**
 * The topmost row of straight RGBA `data` (`width` by `height`) whose alpha is at least
 * `threshold` (0 to 1), or `height` when none is.
 */
export function alphaTopRow(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): number {
  const least = threshold * 255;
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if (data[4 * (row * width + column) + 3]! >= least) {
        return row;
      }
    }
  }
  return height;
}

/** Destinations use their wider outline; Ada uses half the ordinary silhouette growth. */
/** Whether a keylined kind's drawn jets join its keyline silhouette (`jetKeyline`). */
export function joinsJets(rule: LightField, kind: string): boolean {
  return (
    rule.jetKeyline.join && rule.keylined.includes(kind) && !rule.jetKeyline.exempt.includes(kind)
  );
}

export function keylineWidth(rule: LightField, kind: string): number {
  if (kind === "ship") {
    return rule.keyline / 2;
  }
  return rule.destinationKeyline.kinds.includes(kind)
    ? rule.destinationKeyline.width
    : rule.keyline;
}

/** The galaxies whose tint is light, from galaxies.json's map by stable galaxy id. */
export function readLightGalaxies(value: unknown): ReadonlySet<GalaxyNumber> {
  const light = byGalaxy(
    (entry) => fields(fields(entry)?.tint)?.light === true,
    fields(value)?.galaxies,
  );
  return new Set([...(light ?? [])].filter(([, isLight]) => isLight).map(([galaxy]) => galaxy));
}

function required(rule: LightField | undefined): LightField {
  if (!rule) {
    throw new Error("public/art/galaxies.json has no valid lightField");
  }
  return rule;
}

export const LIGHT_FIELD: LightField = required(readLightField(GALAXIES_FILE));

/**
 * Whether a flight's galaxy has a light field, from the light galaxies of the field data in use;
 * home and the base field are dark.
 */
export function lightGalaxy(
  light: ReadonlySet<GalaxyNumber>,
  galaxy: GalaxyNumber | null | undefined,
): boolean {
  return galaxy !== null && galaxy !== undefined && light.has(galaxy);
}

/**
 * The foreground edge of a flight's galaxy: Art's ink in every galaxy, light field or dark
 * (Phantom); home and the base field draw none.
 */
export function foregroundEdge(galaxy: GalaxyNumber | null | undefined): number | undefined {
  return galaxy === null || galaxy === undefined ? undefined : LIGHT_FIELD.ink;
}

/** Art's keyline source: the pixels at this alpha or more, so the keyline edge stays crisp. */
export const KEYLINE_ALPHA = 0.5;

/**
 * Threshold the ink mask in place and bound it with one clear texel for linear filtering.
 * An empty mask needs only a single transparent texel.
 */
export function thresholdSilhouette(
  ink: number,
  threshold: number,
  { data, height, width }: Pick<ImageData, "data" | "height" | "width">,
): { height: number; width: number; x: number; y: number } {
  const cut = threshold * 255;
  const red = (ink >> 16) & 255;
  const green = (ink >> 8) & 255;
  const blue = ink & 255;
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  let index = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++, index += 4) {
      const solid = data[index + 3]! >= cut;
      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
      data[index + 3] = solid ? 255 : 0;
      if (solid) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = y + 1;
      }
    }
  }
  if (bottom === 0) {
    return { height: 1, width: 1, x: 0, y: 0 };
  }
  const x = Math.max(0, left - 1);
  const y = Math.max(0, top - 1);
  return { height: Math.min(height, bottom + 1) - y, width: Math.min(width, right + 1) - x, x, y };
}

/**
 * A blast's ink edges on a light field: its ring stroke 2 `grow` wider on the same path, and its
 * flash's outermost burst grown by `grow`, each at its shape's alpha. The inner line and the
 * debris take none.
 */
export function blastEdges(
  ink: number,
  grow: number,
  shapes: readonly EffectShape[],
): EffectShape[] {
  const rings = shapes.filter((shape) => shape.kind === "ellipse" && shape.part === "ring");
  const flash = shapes.find((shape) => shape.kind === "polygon" && shape.part === "flash");
  return inkEdges(ink, grow, flash ? [...rings, flash] : rings);
}

/** The ink keyline's eight offsets: a square kernel `grow` px wide. */
export function keylineOffsets(grow: number): readonly Vec[] {
  const offsets: Vec[] = [];
  for (const y of [-grow, 0, grow]) {
    for (const x of [-grow, 0, grow]) {
      if (x !== 0 || y !== 0) {
        offsets.push({ x, y });
      }
    }
  }
  return offsets;
}

const along = (from: Vec, to: Vec, by: number): Vec => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return length === 0
    ? from
    : { x: from.x + ((from.x - to.x) / length) * by, y: from.y + ((from.y - to.y) / length) * by };
};

/**
 * Ink shapes to draw beneath effect shapes, each at its shape's alpha: a stroke 2 `grow` wider on
 * the same path, a filled shape grown by `grow` (a polygon's edges stroked 2 `grow` wide with
 * round ends, so its corners round over the square kernel's by under a pixel).
 */
export function inkEdges(ink: number, grow: number, shapes: readonly EffectShape[]): EffectShape[] {
  const edges: EffectShape[] = [];
  for (const shape of shapes) {
    switch (shape.kind) {
      case "disc":
        edges.push({ ...shape, colour: ink, radius: shape.radius + grow });
        break;
      case "ellipse":
        edges.push(
          shape.stroke === undefined
            ? {
                ...shape,
                colour: ink,
                halfHeight: shape.halfHeight + grow,
                halfWidth: shape.halfWidth + grow,
              }
            : { ...shape, colour: ink, stroke: shape.stroke + 2 * grow },
        );
        break;
      case "line":
        edges.push({ ...shape, colour: ink, width: shape.width + 2 * grow });
        break;
      case "polygon":
        edges.push({ ...shape, colour: ink });
        shape.points.forEach((from, index) => {
          edges.push({
            alpha: shape.alpha,
            colour: ink,
            from,
            kind: "line",
            round: true,
            to: shape.points[(index + 1) % shape.points.length]!,
            width: 2 * grow,
          });
        });
        break;
      case "taper":
        edges.push({
          ...shape,
          colour: ink,
          head: {
            ...shape.head,
            at: along(shape.head.at, shape.tail.at, grow),
            width: shape.head.width + 2 * grow,
          },
          tail: {
            ...shape.tail,
            at: along(shape.tail.at, shape.head.at, grow),
            width: shape.tail.width + 2 * grow,
          },
        });
        break;
    }
  }
  return edges;
}
