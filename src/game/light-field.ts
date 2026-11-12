import GALAXIES_FILE from "../../public/art/galaxies.json" with { type: "json" };
import { bySector } from "../data/galaxies.ts";
import type { SectorId } from "../data/types.ts";
import type { Vec } from "../model/types.ts";
import { type JetLayer, readJetLayers, readLevelLayers } from "./ship-jets.ts";
import type { BeamGlow, EffectShape, EllipseShape } from "./weapon-effects.ts";

// Art's light-field rule (art/galaxies.md "Light fields"): on a galaxy whose field is light,
// play objects sit in ink keylines, effects draw over ink edges and the outermost glows turn to
// ink. A dark galaxy draws none of it. Widths are logical px.

export interface LightField {
  /** The wider keyline destinations take, and the keylined kinds that are destinations. */
  readonly destinationKeyline: { readonly kinds: readonly string[]; readonly width: number };
  readonly effects: readonly string[];
  readonly holodiskBeacon: string;
  readonly hudOutline: number;
  readonly indicatorStroke: number;
  readonly ink: number;
  readonly jets: {
    readonly enemy: readonly JetLayer[];
    /** Ada's layers by Engine level, index 0 for level 1 (`shipLevels`). */
    readonly shipLevels: readonly (readonly JetLayer[])[];
  };
  readonly keyline: number;
  readonly keylined: readonly string[];
  /** The ink outline around each edge marker on a light field. */
  readonly markerOutline: number;
  readonly phaser: BeamGlow;
  readonly shotEdge: number;
}

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const unit = (value: unknown): value is number => positive(value) && value <= 1;
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
  const glow = fields(phaser?.glow);
  const bloom = fields(phaser?.bloom);
  const jets = fields(rule?.jets);
  const outline = fields(rule?.hudOutline);
  const destination = fields(rule?.destinationKeyline);
  const ink = colour(rule?.ink);
  const enemy = readJetLayers(jets?.enemy);
  const shipLevels = readLevelLayers(jets?.shipLevels);
  const widths = glow?.width;
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
    !names(rule.keylined) ||
    !names(rule.effects) ||
    typeof rule.holodiskBeacon !== "string" ||
    !Array.isArray(widths) ||
    widths.length !== 2 ||
    !widths.every(positive) ||
    !unit(glow?.alpha) ||
    !positive(bloom?.radius) ||
    !unit(bloom?.alpha)
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
    jets: { enemy, shipLevels },
    keyline: rule.keyline,
    keylined: rule.keylined,
    markerOutline: rule.markerOutline,
    phaser: {
      bloom: { alpha: bloom.alpha, radius: bloom.radius },
      colour: ink,
      // Reduced motion: the steady 4 px edge takes the glow's ink and alpha.
      edgeAlpha: glow.alpha,
      glow: { alpha: glow.alpha, width: [widths[0] as number, widths[1] as number] },
    },
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

/** The keyline width a keylined kind takes on a light field: wider for destinations. */
export function keylineWidth(rule: LightField, kind: string): number {
  return rule.destinationKeyline.kinds.includes(kind)
    ? rule.destinationKeyline.width
    : rule.keyline;
}

/** The galaxies whose tint is light, from galaxies.json's map by stable galaxy id. */
export function readLightGalaxies(value: unknown): ReadonlySet<SectorId> {
  const light = bySector(
    (entry) => fields(fields(entry)?.tint)?.light === true,
    fields(value)?.galaxies,
  );
  return new Set([...(light ?? [])].filter(([, isLight]) => isLight).map(([sector]) => sector));
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
  light: ReadonlySet<SectorId>,
  sector: SectorId | null | undefined,
): boolean {
  return sector !== null && sector !== undefined && light.has(sector);
}

/** Art's keyline source: the pixels at this alpha or more, so the keyline edge stays crisp. */
export const KEYLINE_ALPHA = 0.5;

/**
 * Turns RGBA pixels into the keyline's source silhouette in place: opaque ink where alpha is at
 * least `threshold`, clear elsewhere.
 */
export function thresholdSilhouette(
  ink: number,
  threshold: number,
  pixels: Uint8ClampedArray,
): void {
  const cut = threshold * 255;
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const solid = pixels[index + 3]! >= cut;
    pixels[index] = (ink >> 16) & 255;
    pixels[index + 1] = (ink >> 8) & 255;
    pixels[index + 2] = ink & 255;
    pixels[index + 3] = solid ? 255 : 0;
  }
}

/**
 * A blast's ink edges on a light field: its ring stroke 2 `grow` wider on the same path, and a
 * `grow` px outline just outside the flash's outermost layer, each at its shape's alpha. The tint
 * fill, the inner line and the debris take none.
 */
export function blastEdges(
  ink: number,
  grow: number,
  shapes: readonly EffectShape[],
): EffectShape[] {
  const edges: EffectShape[] = [];
  let flash: EllipseShape | undefined;
  for (const shape of shapes) {
    if (shape.kind !== "ellipse") {
      continue;
    }
    if (shape.part === "ring" && shape.stroke !== undefined) {
      edges.push(...inkEdges(ink, grow, [shape]));
    } else if (shape.part === "flash" && (!flash || shape.halfWidth > flash.halfWidth)) {
      flash = shape;
    }
  }
  if (flash) {
    edges.push({
      ...flash,
      colour: ink,
      halfHeight: flash.halfHeight + grow / 2,
      halfWidth: flash.halfWidth + grow / 2,
      stroke: grow,
    });
  }
  return edges;
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
