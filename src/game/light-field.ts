import GALAXIES_FILE from "../../public/art/galaxies.json" with { type: "json" };
import type { SectorId } from "../data/types.ts";
import type { Vec } from "../model/types.ts";
import { type JetLayer, readJetLayers } from "./ship-jets.ts";
import type { BeamGlow, EffectShape } from "./weapon-effects.ts";

// Art's light-field rule (art/galaxies.md "Light fields"): on a galaxy whose field is light,
// play objects sit in ink keylines, effects draw over ink edges and the outermost glows turn to
// ink. A dark galaxy draws none of it. Widths are logical px.

export interface LightField {
  readonly effects: readonly string[];
  readonly holodiskBeacon: string;
  readonly hudOutline: number;
  readonly indicatorStroke: number;
  readonly ink: number;
  readonly jets: { readonly enemy: readonly JetLayer[]; readonly ship: readonly JetLayer[] };
  readonly keyline: number;
  readonly keylined: readonly string[];
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
  const ink = colour(rule?.ink);
  const ship = readJetLayers(jets?.ship);
  const enemy = readJetLayers(jets?.enemy);
  const widths = glow?.width;
  if (
    !rule ||
    ink === undefined ||
    !ship ||
    !enemy ||
    !positive(rule.keyline) ||
    !positive(rule.shotEdge) ||
    !positive(rule.indicatorStroke) ||
    !positive(outline?.width) ||
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
    effects: rule.effects,
    holodiskBeacon: rule.holodiskBeacon,
    hudOutline: outline.width,
    indicatorStroke: rule.indicatorStroke,
    ink,
    jets: { enemy, ship },
    keyline: rule.keyline,
    keylined: rule.keylined,
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

/** The galaxy numbers whose tint is light. */
export function readLightGalaxies(value: unknown): ReadonlySet<number> {
  const galaxies = fields(value)?.galaxies;
  if (!Array.isArray(galaxies)) {
    return new Set();
  }
  return new Set(
    galaxies
      .map((entry) => fields(entry))
      .filter((entry) => fields(entry?.tint)?.light === true && typeof entry?.number === "number")
      .map((entry) => entry!.number as number),
  );
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
  light: ReadonlySet<number>,
  sector: SectorId | null | undefined,
): boolean {
  return sector !== null && sector !== undefined && light.has(sector);
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
