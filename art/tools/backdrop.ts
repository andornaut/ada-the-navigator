// Layered parallax backdrop: the shared layer rules in /art/backdrop.json, each galaxy's
// /art/{galaxy}/backdrop.json (sky, plates, phenomena, stars and streaks in its own field
// tones), the nebula galaxies' quarter-resolution textures, and contrast checks over sampled
// cameras that fail the build when a layer passes its cap. A placeholder galaxy gets a
// monochrome placeholder backdrop in the base space palette and a galaxy manifest holding only
// that link, until its own art replaces both.
// Usage: node art/tools/backdrop.ts [--preview <dir>] writes the data, the textures and the
// manifest links; --preview also writes each checked camera's layers as a PNG to <dir>.
// Contract: art/backdrop.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { decodePng } from "@andornaut/art-kit/build/png";
import { blankImage } from "@andornaut/art-kit/build/rgbaImage";

import {
  decorationRecipe,
  type DecorationRecipe,
  writeDecorations,
} from "./backdrop-decorations.ts";
import {
  checkerItems,
  chunkItems,
  insideRings,
  layerOrigin,
  type MotifRules,
  motifPlates,
  type Pattern,
  type PlateRules,
  plates,
  type Rect,
  type Ring,
  unit,
  type Xy,
} from "./backdrop-field.ts";
import { editManifest, GALAXIES, linkData, manifestUrl, replaceEntries } from "./manifest.ts";
import { stageRows } from "./polish-rows.ts";
import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
import { writePng } from "./paint.ts";
import { json, round } from "./projection.ts";
import { classic } from "./ship-model.ts";

type GalaxyId = (typeof GALAXIES)[number];
type Float3 = [number, number, number];

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const read = (path: string) => JSON.parse(readFileSync(`${art}${path}`, "utf8")) as unknown;
const fields = read("galaxies.json") as {
  galaxies: Record<
    string,
    {
      tint: { light?: boolean; chroma: number; hue: number };
      colors: { background: string };
      foregroundEdge?: string;
      marker?: string;
    }
  >;
  lightField: { ink: string };
};
const tints = (read("asteroids.json") as { tints: Record<string, Record<string, string>> }).tints;
const palette = (read("space-palette.json") as { colors: Record<string, string> }).colors;
// Needle's edge-on band, the fixed part of its L2 (art/needle.md, Space look).
const band = read("needle/band.json") as {
  color: string;
  through: Xy;
  angle: number;
  profile: { alpha: number; sigma: number }[];
};
// Andromeda's backdrop haze, the fixed part of its L2 (art/galaxies.md, Backdrop haze).
const HAZE = { path: "andromeda/haze.png", texel: 2 } as const;

const VIEW: Xy = [720, 360];

// ---------------------------------------------------------------- colour

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const float = (colour: string): Float3 => rgb(colour).map((v) => v / 255) as Float3;
const luminance = ([r, g, b]: readonly number[]) =>
  0.2126 * toLinear(r!) + 0.7152 * toLinear(g!) + 0.0722 * toLinear(b!);
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
// Bare-facet diagnostics follow the actual shared Classic paint, not a copied palette.
const SHIP_WHITE = classic.paint.top.toUpperCase();
const SHIP_HULL_DARK = [
  classic.paint.top,
  classic.paint.frontSides,
  classic.paint.rearSides,
  classic.paint.skirt,
]
  .sort((a, b) => luminance(float(a)) - luminance(float(b)))[0]!
  .toUpperCase();
const hexOf = (c: readonly number[]) =>
  hex(
    c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)) as unknown as [
      number,
      number,
      number,
    ],
  ).toUpperCase();

function lch(colour: string): Float3 {
  const [L, a, b] = toOklab(rgb(colour));
  return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180) / Math.PI];
}

function fromLch(L: number, C: number, H: number): string {
  const h = (H * Math.PI) / 180;
  return hex(fromOklab(L, C * Math.cos(h), C * Math.sin(h))).toUpperCase();
}

/**
 * The colour at hue offset `dh` degrees and chroma scale `cs` from `bg` whose WCAG luminance is
 * `r` times the background's (r < 1 is darker), by bisection on Oklab L.
 */
function tone(bg: string, r: number, dh = 0, cs = 1): string {
  const [, C, H] = lch(bg);
  const target = r * (luminance(float(bg)) + 0.05) - 0.05;
  let [lo, hi] = [0, 1];
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (luminance(float(fromLch(mid, C * cs, H + dh))) < target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  // Round toward the background, so byte rounding never passes the ratio.
  return fromLch(r < 1 ? hi : lo, C * cs, H + dh);
}

const over = (fg: readonly number[], alpha: number, bg: readonly number[]): Float3 =>
  [0, 1, 2].map((k) => fg[k]! * alpha + bg[k]! * (1 - alpha)) as Float3;

/** The alpha at which `colour` over `bg` reaches `cap`, or 1 when it never does. */
function alphaFor(colour: string, bg: string, cap: number): number {
  const [c, b] = [float(colour), float(bg)];
  const yb = luminance(b);
  if (ratio(luminance(c), yb) <= cap) {
    return 1;
  }
  let [lo, hi] = [0, 1];
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (ratio(luminance(over(c, mid, b)), yb) < cap) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return round(lo);
}

// ---------------------------------------------------------------- shared rules

const CAPS = {
  sky: { dark: 1.08, light: 1.05 },
  plates: { dark: { lighter: 1.24, darker: 1.16 }, light: { lighter: 1.1, darker: 1.24 } },
  phenomena: { body: 1.3 },
  stars: { dark: { far: 1.8, near: 3 }, light: { far: 1.06, near: 1.1 } },
  streaks: 1.35,
  rocks: 1.8,
};

const PLATE_RULES: PlateRules = {
  patternWeight: 0.75,
  jitterWeight: 1,
  edges: [-0.42, -0.05, 0.05, 0.45],
};

// Value compression toward the field background, baked into each galaxy's tones after the caps
// fix them (`muted`): a plate step keeps `plates` of its offset (multiply 1 - k (1 - m), screen
// channels times k); planet colours keep `planets` of their sRGB distance from the background;
// star, cluster-star and streak alphas scale by `stars`, `clusterStars` and `streaks`. The rare
// decorations keep the full-strength planet tones.
const MUTE = { plates: 0.6, planets: 0.55, stars: 0.75, clusterStars: 0.8, streaks: 0.8 };

const RULES = {
  version: 1,
  view: VIEW,
  order: ["sky", "phenomena", "plates", "stars", "debris"],
  sky: { parallax: 0, anchor: "view" },
  phenomena: {
    fixed: { parallax: 0, anchor: "view" },
    far: { parallax: 0.05, chunk: [1100, 700], chance: 0.95, salt: "far" },
    planets: {
      parallax: 0.12,
      chunk: [800, 560],
      chance: 0.92,
      salt: "planet",
      radius: [26, 90],
      light: [-0.62, -0.78],
      facets: 14,
      push: { crescent: 0.42, gibbous: 0.7 },
      lit: { push: 1.9, inset: 1.02 },
      moonLitAlpha: 0.9,
      ring: {
        radii: [2, 0.42],
        tilt: [-14, 6],
        bands: [
          { from: 0.66, to: 0.74, alpha: 0.5 },
          { from: 0.78, to: 0.98, alpha: 0.85 },
        ],
      },
    },
    // `alpha`: the veil's and the core's peak alpha, baked into the textures.
    nebula: { display: [768, 320], scale: 4, filter: "linear", alpha: { veil: 0.4125, core: 0.6 } },
    cluster: {
      glow: { sigma: [64, 42], alpha: 0.5 },
      stars: { count: 90, spread: [47.6, 34], radius: [0.5, 0.8], largeShare: 0.2 },
    },
  },
  plates: {
    parallax: 0.15,
    ...PLATE_RULES,
    blend: { darker: "multiply", lighter: "screen" },
  },
  stars: {
    chunk: 240,
    salt: "star",
    layers: [
      { name: "far", parallax: 0.3, perChunk: 28, radius: 0.55 },
      { name: "near", parallax: 0.5, perChunk: 8, radius: 0.85 },
    ],
    large: { share: 0.15, scale: 1.25 },
    brightness: [0.55, 1],
    twinkle: { period: [3, 6], range: [0.7, 1], reducedMotion: 0.85 },
  },
  debris: {
    streaks: {
      parallax: 0.6,
      chunk: [180, 180],
      chance: 0.8,
      salt: "streak",
      length: [26, 72],
      width: 1,
      spread: 11.5,
    },
    // Dust specks: one per `cell` layer px, a 1 px disc in backdropSide at `alpha`.
    specks: { parallax: 0.7, cell: 112, alpha: 0.45 },
    // Backdrop rock depths (art/asteroids.md, Backdrop): one rock in `chance` of the `cell` world
    // cells, hashed with `salt`, `salt-sprite`, `salt-x`, `salt-y` and `salt-scale`, at `scale`
    // times its display size, tinted backdropLit and then compressed to `value` of its distance
    // from the field background while staying opaque. `farRocks` draws under `rocks`.
    rocks: {
      parallax: 0.8,
      salt: "backdrop",
      cell: 320,
      chance: 0.7,
      scale: [0.6, 1],
      value: 0.75,
    },
    farRocks: {
      parallax: 0.45,
      salt: "backdrop-far",
      cell: 240,
      chance: 0.7,
      scale: [0.3, 0.5],
      value: 0.4,
    },
  },
  caps: CAPS,
  check: { cameras: 6, opening: 5 },
};

// ---------------------------------------------------------------- galaxies

type PlanetLook = "crescent" | "gibbous" | "ringed" | "moon";
type GalaxyConfig = {
  lattice: readonly [Xy, Xy];
  split: boolean;
  jitter: number;
  lighter: boolean;
  pattern: Pattern;
  lightHue: number;
  darkHue: number;
  skyFlip: boolean;
  star: string | null;
  streakAngle: number;
  planets: readonly { look: PlanetLook; hue: number; size: number }[];
  far: readonly ("nebula" | "cluster")[];
  fixed: readonly string[];
  // A nebula far look's tones: hue offset and chroma scale of its core and veil; null without one.
  nebula: { core: { hue: number; chroma: number }; veil: { hue: number; chroma: number } } | null;
  // A placeholder flies the base space palette in monochrome: no hue offsets and the field's
  // own chroma, so it adds no hue of its own.
  placeholder: boolean;
};

const RAD6 = (6 * Math.PI) / 180;
const fbm = (weight: number) => [
  { scale: 1100, weight: round(weight * 0.65), salt: "plate-n1" },
  { scale: 478, weight: round(weight * 0.35), salt: "plate-n2" },
];
// The placeholder recipe a galaxy flies until its art is built: noise-toned triangles, one grey
// gibbous planet, no far items. Each galaxy's own seed still gives it its own sky. Every galaxy
// has its own recipe now.
export const PLACEHOLDER: GalaxyConfig = {
  lattice: [
    [210, 0],
    [105, 182.5],
  ],
  split: true,
  jitter: 0.3,
  lighter: true,
  pattern: { noise: fbm(1) },
  lightHue: 0,
  darkHue: 0,
  skyFlip: false,
  star: null,
  streakAngle: -18,
  planets: [{ look: "gibbous", hue: 0, size: 0.8 }],
  far: [],
  fixed: [],
  nebula: null,
  placeholder: true,
};

// Each galaxy's backdrop seed, fixed here so a galaxy keeps its sky when its id changes.
const SEEDS: Record<GalaxyId, number> = {
  sunflower: 2897959560,
  cartwheel: 1760754722,
  whirlpool: 2908185251,
  andromeda: 3962480382,
  needle: 4216128235,
  phantom: 3696708802,
};

const CONFIG: Record<GalaxyId, GalaxyConfig> = {
  // Diamond plots, as farm fields seen from above in the isometric view.
  sunflower: {
    lattice: [
      [170, 85],
      [-170, 85],
    ],
    split: false,
    jitter: 0.08,
    lighter: true,
    pattern: { noise: fbm(0.85), wave: { weight: 0.35, direction: [1, 1.8], period: 900 } },
    lightHue: -10,
    darkHue: 8,
    skyFlip: false,
    star: "#FFF7DC",
    streakAngle: -12,
    planets: [
      { look: "moon", hue: -8, size: 0.9 },
      { look: "ringed", hue: -30, size: 0.6 },
    ],
    far: [],
    fixed: [],
    nebula: null,
    placeholder: false,
  },
  // Spokes round far hubs.
  cartwheel: {
    lattice: [
      [190, 0],
      [95, 165],
    ],
    split: true,
    jitter: 0.28,
    lighter: true,
    pattern: {
      noise: fbm(0.45),
      spokes: { weight: 0.8, cell: [2600, 2000], count: 5, twist: 520, squash: 1.4, fade: 900 },
    },
    lightHue: 14,
    darkHue: -12,
    skyFlip: false,
    star: null,
    streakAngle: 22,
    planets: [
      { look: "crescent", hue: -25, size: 1 },
      { look: "ringed", hue: 20, size: 0.8 },
    ],
    far: ["cluster"],
    fixed: [],
    nebula: null,
    placeholder: false,
  },
  // Flowing wave bands.
  whirlpool: {
    lattice: [
      [200, 0],
      [100, 175],
    ],
    split: true,
    jitter: 0.3,
    lighter: true,
    pattern: {
      noise: fbm(0.45),
      wave: {
        weight: 0.75,
        direction: [0.45, 1],
        period: 260,
        warp: { kind: "sine", weight: 1.6, direction: [1, 0], period: 520 },
      },
    },
    lightHue: -16,
    darkHue: 14,
    skyFlip: false,
    star: null,
    streakAngle: -24,
    planets: [
      { look: "ringed", hue: 50, size: 1 },
      { look: "crescent", hue: -40, size: 0.7 },
    ],
    far: ["nebula"],
    fixed: [],
    nebula: { core: { hue: 40, chroma: 1.7 }, veil: { hue: -10, chroma: 1.5 } },
    placeholder: false,
  },
  // Shadow plates only, so the spiral haze stays Andromeda's light and its core is never
  // brightened (art/andromeda.md).
  andromeda: {
    lattice: [
      [230, 0],
      [115, 200],
    ],
    split: true,
    jitter: 0.34,
    lighter: false,
    pattern: { noise: fbm(1.05) },
    lightHue: 16,
    darkHue: -14,
    skyFlip: true,
    star: null,
    streakAngle: -30,
    planets: [{ look: "crescent", hue: 10, size: 0.7 }],
    far: ["cluster"],
    fixed: ["backdropHaze"],
    nebula: null,
    placeholder: false,
  },
  // Long slivers parallel to the band.
  needle: {
    lattice: [
      [450 * Math.cos(-RAD6), 450 * Math.sin(-RAD6)],
      [15, 75],
    ],
    split: false,
    jitter: 0.06,
    lighter: true,
    pattern: {
      noise: [{ scale: 300, weight: 0.55, salt: "plate-n1", angle: -6, stretch: 6 }],
      wave: {
        weight: 0.75,
        direction: [Math.sin(RAD6), Math.cos(RAD6)],
        period: 70,
        warp: { kind: "noise", weight: 1.2, octave: { scale: 900, weight: 1, salt: "plate-warp" } },
      },
    },
    lightHue: 20,
    darkHue: -10,
    skyFlip: false,
    star: null,
    streakAngle: -6,
    planets: [{ look: "crescent", hue: 0, size: 0.65 }],
    far: [],
    fixed: ["needleBand"],
    nebula: null,
    placeholder: false,
  },
  // Smoke: noise-warped drifting bands, lighter wisps over shadow, and violet smoke banks.
  phantom: {
    lattice: [
      [210, 0],
      [105, 180],
    ],
    split: true,
    jitter: 0.32,
    lighter: true,
    pattern: {
      noise: fbm(0.5),
      wave: {
        weight: 0.8,
        direction: [0.85, -0.4],
        period: 300,
        warp: { kind: "noise", weight: 2.4, octave: { scale: 760, weight: 1, salt: "plate-warp" } },
      },
    },
    lightHue: -14,
    darkHue: 10,
    skyFlip: true,
    star: null,
    streakAngle: 16,
    planets: [{ look: "crescent", hue: -12, size: 0.85 }],
    far: ["nebula"],
    fixed: [],
    // Violet smoke: Whirlpool's +40 core offset would turn it rose.
    nebula: { core: { hue: -18, chroma: 1.6 }, veil: { hue: 8, chroma: 1.3 } },
    placeholder: false,
  },
};

const roundXy = (xy: Xy): Xy => [round(xy[0]), round(xy[1])];

// ---------------------------------------------------------------- the motif field
// The staged field (art/backdrop.md, Motif field): one themed motif per galaxy on a regular
// isometric lattice in two flat plate steps, round two-tone planets in every second chunk,
// streaks of one length at one angle on a checker, and the backdrop rocks in every second cell.
// It is written beside the shipped backdrop data, which the runtime reads until the switch.

const MOTIF_RULES: MotifRules = {
  lattice: [
    [250, 125],
    [-250, 125],
  ],
  empty: { i: 1, j: 2, modulus: 3 },
};
// The motif's unit length in layer px.
const MOTIF_SIZE = 118;

const FIELD_RULES = {
  ...RULES,
  version: 2,
  phenomena: {
    ...RULES.phenomena,
    planets: {
      parallax: RULES.phenomena.planets.parallax,
      chunk: RULES.phenomena.planets.chunk,
      chance: RULES.phenomena.planets.chance,
      salt: RULES.phenomena.planets.salt,
      // A planet draws only in the chunks whose i + j is even.
      checker: true,
      radius: RULES.phenomena.planets.radius,
      light: RULES.phenomena.planets.light,
      // The lit disc: `radius` times the planet's, its centre `push` radii toward the light,
      // clipped to the planet.
      lit: { radius: 1.04, push: { crescent: 0.55, gibbous: 0.9 } },
      ring: { radii: [2, 0.42], tilt: -14, band: { from: 0.78, to: 0.98 } },
    },
  },
  plates: {
    parallax: RULES.plates.parallax,
    ...MOTIF_RULES,
    size: MOTIF_SIZE,
    blend: RULES.plates.blend,
  },
  debris: {
    ...RULES.debris,
    // One streak at the centre of every `cell` layer px cell whose i + j is even.
    streaks: { parallax: RULES.debris.streaks.parallax, cell: 240, length: 44, width: 1 },
    // One rock in every cell whose i + j is even.
    rocks: { ...RULES.debris.rocks, chance: 1, checker: true },
    farRocks: { ...RULES.debris.farRocks, chance: 1, checker: true },
  },
};

const ellipse = (radius: number, count = 72): Xy[] =>
  Array.from({ length: count }, (_, k): Xy => {
    const a = (2 * Math.PI * k) / count;
    return [radius * Math.cos(a), (radius / 2) * Math.sin(a)];
  });

// Each galaxy's motif about its node, in units of MOTIF_SIZE: shapes on the world plane, so
// round ones draw as 2:1 ellipses.
const MOTIFS: Record<GalaxyId, { name: string; rings: Xy[][] }> = {
  // A petal: a long diamond on an isometric axis.
  sunflower: {
    name: "petal",
    rings: [
      [
        [-1, 0],
        [-0.1, -0.3],
        [1, 0],
        [0.1, 0.3],
      ],
    ],
  },
  // A wheel rim.
  cartwheel: { name: "rim", rings: [ellipse(0.95), ellipse(0.7).toReversed()] },
  // An arm: 250 degrees of a tapering spiral band.
  whirlpool: {
    name: "arm",
    rings: [
      (() => {
        const side = (sign: number) =>
          Array.from({ length: 41 }, (_, k): Xy => {
            const t = k / 40;
            const a = ((200 + 250 * t) * Math.PI) / 180;
            const r = 0.5 + 0.5 * t + sign * (0.17 * Math.sin(Math.PI * Math.min(1, 0.12 + t)));
            return [r * Math.cos(a), (r / 2) * Math.sin(a)];
          });
        return [...side(1), ...side(-1).toReversed()];
      })(),
    ],
  },
  // A saucer: a disc.
  andromeda: { name: "disc", rings: [ellipse(0.95)] },
  // A needle: a long lens along the band.
  needle: {
    name: "lens",
    rings: [
      (
        [
          [-1.7, 0],
          [-0.5, 0.1],
          [0.5, 0.1],
          [1.7, 0],
          [0.5, -0.1],
          [-0.5, -0.1],
        ] as const
      ).map(([along, across]): Xy => [
        along * Math.cos(-RAD6) - across * Math.sin(-RAD6),
        along * Math.sin(-RAD6) + across * Math.cos(-RAD6),
      ]),
    ],
  },
  // A three-armed slab, arms 120 degrees apart.
  phantom: {
    name: "slab",
    rings: [
      [0, 1, 2].flatMap((k): Xy[] => {
        const a = ((90 + 120 * k) * Math.PI) / 180;
        const b = a + Math.PI / 3;
        const half = 0.2;
        const [tx, ty] = [Math.cos(a), Math.sin(a)];
        const [nx, ny] = [-Math.sin(a) * half, Math.cos(a) * half];
        const inner = half / Math.sin(Math.PI / 3);
        return [
          [tx - nx, (ty - ny) / 2],
          [tx + nx, (ty + ny) / 2],
          [Math.cos(b) * inner, (Math.sin(b) * inner) / 2],
        ];
      }),
    ],
  },
};

const motifRings = (galaxy: GalaxyId): Xy[][] =>
  MOTIFS[galaxy].rings.map((ring) =>
    ring.map(([x, y]): Xy => [
      Math.round(x * MOTIF_SIZE * 10) / 10 + 0,
      Math.round(y * MOTIF_SIZE * 10) / 10 + 0,
    ]),
  );

type FieldPlates = {
  motif: { name: string; rings: Ring[] };
  // The paints of the nodes whose i + j is even, then odd.
  steps: [StepPaint, StepPaint];
};

function roundPattern(pattern: Pattern): Pattern {
  return JSON.parse(JSON.stringify(pattern), (_, value: unknown) =>
    typeof value === "number" ? round(value) : value,
  ) as Pattern;
}

// ---------------------------------------------------------------- per-galaxy data

type Planet = { look: PlanetLook; hue: number; size: number; colors: Record<string, string> };
type StepPaint = { step: number; color: string; multiply?: number; screen?: string };
type GalaxyBackdrop = {
  galaxy: GalaxyId;
  placeholder: boolean;
  light: boolean;
  seed: number;
  background: string;
  sky: { from: string; to: string; weights: Xy; offset: number; flip: boolean };
  plates: {
    lattice: readonly [Xy, Xy];
    split: boolean;
    jitter: number;
    lighter: boolean;
    pattern: Pattern;
    steps: StepPaint[];
  };
  planets: Planet[];
  decorations: DecorationRecipe;
  far: { look: "nebula" | "cluster"; [key: string]: unknown }[];
  fixed: readonly string[];
  stars: { color: string; alpha: { far: number; near: number } };
  streaks: { color: string; alpha: number; angle: number };
};

type Field = { background: string; light: boolean; marker: string; tints: Record<string, string> };

/**
 * A galaxy's field: a built galaxy's from galaxies.json and its backdrop rock tints; a
 * placeholder's is the base space palette and the base tints, as it flies. The star colour is
 * Art's marker rule (Oklab L 0.83 at the tint hue with twice its chroma); a placeholder's keeps
 * the base background's own hue and chroma at that lightness.
 */
function fieldOf(galaxy: GalaxyId): Field {
  const built = fields.galaxies[galaxy];
  if (CONFIG[galaxy].placeholder || !built) {
    const [, C, H] = lch(palette.background!);
    return {
      background: palette.background!,
      light: false,
      marker: fromLch(0.83, C, H),
      tints: tints.base!,
    };
  }
  return {
    background: built.colors.background,
    light: built.tint.light === true,
    marker: built.marker ?? fromLch(0.83, built.tint.chroma * 2, built.tint.hue),
    tints: tints[galaxy]!,
  };
}

/**
 * The darkest (light field) or brightest (dark field) backdrop tone today: the rock tint, or a
 * fixed L2 layer's peak where brighter (Andromeda's haze core, measured from its texture, and
 * Needle's band peak, its profile's summed alpha over the field).
 */
function todayTone(galaxy: GalaxyId): Float3 {
  const field = fieldOf(galaxy);
  let best = float(field.tints[field.light ? "backdropSide" : "backdropLit"]!);
  if (field.light) {
    return best;
  }
  const bg = float(field.background);
  const brighter = (c: Float3) => {
    if (luminance(c) > luminance(best)) {
      best = c;
    }
  };
  const { fixed } = CONFIG[galaxy];
  if (fixed.includes("backdropHaze")) {
    const d = hazeTexture.data;
    for (let i = 0; i < hazeTexture.width * hazeTexture.height; i++) {
      brighter(over([d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!], d[i * 4 + 3]!, bg));
    }
  }
  if (fixed.includes("needleBand")) {
    const peak = band.profile.reduce((sum, { alpha }) => sum + alpha, 0);
    brighter(over(float(band.color), peak, bg));
  }
  return best;
}

/** Screen colour that takes `bg` to `target`, per channel. */
const screenFor = (target: string, bg: string): string =>
  hexOf(float(target).map((t, k) => Math.max(0, 1 - (1 - t) / Math.max(1 - float(bg)[k]!, 1e-4))));

/**
 * The grey multiply factor that takes `bg` to `r` times darker in WCAG terms. A grey factor
 * keeps the hue of whatever the plate covers (the haze core stays lavender under it).
 */
function multiplyFor(bg: string, r: number): number {
  const c = float(bg);
  const yb = luminance(c);
  let [lo, hi] = [0, 1];
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (ratio(luminance(c.map((v) => v * mid)), yb) > r) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.ceil(hi * 1000) / 1000;
}

function build(galaxy: GalaxyId): GalaxyBackdrop {
  const cfg = CONFIG[galaxy];
  const field = fieldOf(galaxy);
  const bg = field.background;
  const light = field.light;
  const caps = light ? CAPS.plates.light : CAPS.plates.dark;
  // Chroma scale: a placeholder keeps the field's own chroma, so it stays monochrome.
  const cs = (scale: number) => (cfg.placeholder ? 1 : scale);
  // Darker steps are grey multiplies by WCAG ratio; lighter steps screen to a hue-shifted
  // pastel, so the lighter plates carry the variety of hue.
  const darker: Record<string, number> = light
    ? { "-2": caps.darker, "-1": 1.1 }
    : { "-2": caps.darker, "-1": 1.08 };
  const lighter: Record<string, string> = light
    ? { "1": tone(bg, 1.05, cfg.lightHue, 0.95), "2": tone(bg, caps.lighter, cfg.lightHue, 0.8) }
    : {
        "1": tone(bg, 1.1, cfg.lightHue / 2, cs(1.25)),
        "2": tone(bg, caps.lighter, cfg.lightHue, cs(1.45)),
      };
  const steps: StepPaint[] = [];
  for (const [step, r] of Object.entries(darker)) {
    const multiply = multiplyFor(bg, r);
    steps.push({ step: Number(step), color: hexOf(float(bg).map((v) => v * multiply)), multiply });
  }
  if (cfg.lighter) {
    for (const [step, colour] of Object.entries(lighter)) {
      steps.push({ step: Number(step), color: colour, screen: screenFor(colour, bg) });
    }
  }
  const top = steps.find((s) => s.step === 2)?.screen;
  const capY = luminance(float(field.tints[light ? "backdropSide" : "backdropLit"]!));
  // An L2 tone lowered until, under the brightest plate, it stays at or under today's rock tone.
  const capped = (r: number, dh: number, cs: number) => {
    for (let k = r; k > 1; k -= 0.01) {
      const c = tone(bg, k, dh, cs);
      const under = top ? screen(float(c), float(top)) : float(c);
      if (luminance(under) <= capY * 0.995) {
        return c;
      }
    }
    return bg;
  };
  const rockCap = ratio(capY, luminance(float(bg)));
  const planets: Planet[] = cfg.planets.map(({ hue, look, size }) => ({
    look,
    hue,
    size,
    colors: light
      ? {
          night: tone(bg, 1 / 1.14, hue + 6, 1.05),
          body: tone(bg, 1.05, hue, 0.6),
          lit: tone(bg, 1.12, hue, 0.4),
          ring: tone(bg, 1 / 1.22, hue, 1.1),
        }
      : {
          night: tone(bg, 1.05, hue, cs(1.3)),
          body: capped(CAPS.phenomena.body, hue, cs(1.7)),
          lit: capped(rockCap * 0.97, hue, cs(1.5)),
          ring: capped(1.3, cfg.placeholder ? hue : hue + 10, cs(1.5)),
        },
  }));
  const starColour = cfg.star ?? field.marker;
  const starCaps = light ? CAPS.stars.light : CAPS.stars.dark;
  const far = cfg.far.map((look) =>
    look === "nebula"
      ? {
          look,
          assets: [1, 2].map((k) => `nebula-${galaxy}-${k}`),
          colors: {
            core: capped(1.24, cfg.nebula!.core.hue, cfg.nebula!.core.chroma),
            veil: tone(bg, 1.12, cfg.nebula!.veil.hue, cfg.nebula!.veil.chroma),
          },
        }
      : {
          look,
          colors: { glow: tone(bg, 1.12, 10, 1.5), star: starColour },
          alpha: alphaFor(starColour, bg, starCaps.far),
        },
  );
  const streakColour = field.tints[light ? "backdropSide" : "backdropLit"]!;
  return {
    galaxy,
    placeholder: cfg.placeholder,
    light,
    seed: SEEDS[galaxy],
    background: bg,
    sky: {
      from: bg,
      to: light
        ? tone(bg, 1 / CAPS.sky.light, 6, 1.1)
        : tone(bg, 1 / CAPS.sky.dark, cfg.placeholder ? 0 : -8, cs(1.1)),
      weights: [0.45, 0.75],
      offset: -0.1,
      flip: cfg.skyFlip,
    },
    plates: {
      lattice: [roundXy(cfg.lattice[0]), roundXy(cfg.lattice[1])],
      split: cfg.split,
      jitter: cfg.jitter,
      lighter: cfg.lighter,
      pattern: roundPattern(cfg.pattern),
      steps,
    },
    planets,
    decorations: decorationRecipe(galaxy),
    far,
    fixed: cfg.fixed,
    stars: {
      color: starColour,
      alpha: {
        far: alphaFor(starColour, bg, starCaps.far),
        near: alphaFor(starColour, bg, starCaps.near),
      },
    },
    streaks: {
      color: streakColour,
      alpha: alphaFor(streakColour, bg, CAPS.streaks),
      angle: cfg.streakAngle,
    },
  };
}

const screen = (c: readonly number[], s: readonly number[]): Float3 =>
  [0, 1, 2].map((k) => 1 - (1 - c[k]!) * (1 - s[k]!)) as Float3;

/** `colour` moved toward `bg` to `k` of its sRGB distance. */
const toward = (colour: string, bg: string, k: number): string =>
  hexOf(float(colour).map((v, i) => float(bg)[i]! + (v - float(bg)[i]!) * k));

/**
 * A galaxy's backdrop with the MUTE value compression applied to its full-strength tones: plate
 * steps, planet colours, star, cluster-star and streak alphas. Each step's `color` is its
 * muted result over the background.
 */
function muted(data: GalaxyBackdrop): GalaxyBackdrop {
  const bg = data.background;
  const steps = data.plates.steps.map((paint): StepPaint => {
    if (paint.multiply !== undefined) {
      const multiply = round(1 - (1 - paint.multiply) * MUTE.plates);
      return { step: paint.step, color: hexOf(float(bg).map((v) => v * multiply)), multiply };
    }
    const s = hexOf(float(paint.screen!).map((v) => v * MUTE.plates));
    return { step: paint.step, color: hexOf(screen(float(bg), float(s))), screen: s };
  });
  return {
    ...data,
    plates: { ...data.plates, steps },
    planets: data.planets.map((planet) => ({
      ...planet,
      colors: Object.fromEntries(
        Object.entries(planet.colors).map(([key, c]) => [key, toward(c, bg, MUTE.planets)]),
      ),
    })),
    far: data.far.map((recipe) =>
      recipe.look === "cluster"
        ? { ...recipe, alpha: round((recipe.alpha as number) * MUTE.clusterStars) }
        : recipe,
    ),
    stars: {
      ...data.stars,
      alpha: {
        far: round(data.stars.alpha.far * MUTE.stars),
        near: round(data.stars.alpha.near * MUTE.stars),
      },
    },
    streaks: { ...data.streaks, alpha: round(data.streaks.alpha * MUTE.streaks) },
  };
}

// ---------------------------------------------------------------- textures

type Texture = { width: number; height: number; data: Float32Array };

const hazeTexture: Texture = (() => {
  const image = decodePng(readFileSync(`${art}${HAZE.path}`));
  return {
    width: image.width,
    height: image.height,
    data: Float32Array.from(image.data, (v) => v / 255),
  };
})();

/** Bilinear straight-alpha sample at texel coordinates; outside the texture reads clear. */
function sample(t: Texture, x: number, y: number): [number, number, number, number] {
  const [x0, y0] = [Math.floor(x), Math.floor(y)];
  const [fx, fy] = [x - x0, y - y0];
  const out = [0, 0, 0, 0];
  for (const [dx, dy, w] of [
    [0, 0, (1 - fx) * (1 - fy)],
    [1, 0, fx * (1 - fy)],
    [0, 1, (1 - fx) * fy],
    [1, 1, fx * fy],
  ] as const) {
    const [sx, sy] = [x0 + dx, y0 + dy];
    if (sx < 0 || sy < 0 || sx >= t.width || sy >= t.height || w === 0) {
      continue;
    }
    const i = (sy * t.width + sx) * 4;
    const a = t.data[i + 3]!;
    out[0] += t.data[i]! * a * w;
    out[1] += t.data[i + 1]! * a * w;
    out[2] += t.data[i + 2]! * a * w;
    out[3] += a * w;
  }
  const a = out[3]!;
  return a > 1e-6 ? [out[0]! / a, out[1]! / a, out[2]! / a, a] : [0, 0, 0, 0];
}

/** One nebula bank: two soft field-tone veils in an elliptical envelope. */
function nebulaTexture(seed: number, variant: number, colors: Record<string, string>): Texture {
  const { display, scale } = RULES.phenomena.nebula;
  const [w, h] = [display[0] / scale, display[1] / scale];
  const salt = `nebula-${variant}`;
  const noise = (x: number, y: number, s: number, tag: string) =>
    0.65 * vn(seed, x, y, s, `${salt}-${tag}-1`) +
    0.35 * vn(seed, x, y, s / 2.3, `${salt}-${tag}-2`);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const [cores, veils]: [number[], number[]] = [[], []];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const [x, y] = [(i + 0.5) * scale - display[0]! / 2, (j + 0.5) * scale - display[1]! / 2];
      const envelope = Math.exp(-((x / 280) ** 2 + (y / 105) ** 2) * 1.6);
      // A window that reaches zero at the texture edge, so no seam shows.
      const edge = (1 - ((2 * x) / display[0]!) ** 8) * (1 - ((2 * y) / display[1]!) ** 8);
      const core = envelope * ((noise(x, y * 1.6, 160, "core") * 0.5 + 0.5) * 1.6 - 0.3);
      const veil = envelope * (noise(x, y, 90, "veil") * 0.5 + 0.2);
      cores.push(clamp(core) * edge);
      veils.push(clamp(veil) * edge);
    }
  }
  const core = blur1(cores, w, h, 6 / scale);
  const veil = blur1(veils, w, h, 10 / scale);
  const data = new Float32Array(w * h * 4);
  const [veilC, coreC] = [float(colors.veil!), float(colors.core!)];
  for (let p = 0; p < w * h; p++) {
    // The veil at its alpha, then the core over it at its own, as one straight-alpha texel.
    const av = veil[p]! * RULES.phenomena.nebula.alpha.veil;
    const ac = core[p]! * RULES.phenomena.nebula.alpha.core;
    const a = ac + av * (1 - ac);
    const c = [0, 1, 2].map((k) =>
      a > 1e-6 ? (coreC[k]! * ac + veilC[k]! * av * (1 - ac)) / a : 0,
    );
    data.set([c[0]!, c[1]!, c[2]!, a], p * 4);
  }
  return { width: w, height: h, data };
}

const vn = (seed: number, x: number, y: number, scale: number, salt: string) => {
  const [i, j] = [Math.floor(x / scale), Math.floor(y / scale)];
  const s = (t: number) => t * t * (3 - 2 * t);
  const [fx, fy] = [s(x / scale - i), s(y / scale - j)];
  const at = (a: number, b: number) => unit(seed, `${a},${b}`, salt);
  return (
    ((at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) +
      (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy) *
      2 -
    1
  );
};

function blur1(values: number[], w: number, h: number, sigma: number): number[] {
  const reach = Math.ceil(sigma * 3);
  const kernel = Array.from({ length: 2 * reach + 1 }, (_, k) =>
    Math.exp(-((k - reach) ** 2) / (2 * sigma * sigma)),
  );
  const sum = kernel.reduce((a, b) => a + b, 0);
  const pass = (src: number[], horizontal: boolean) => {
    const out = new Array<number>(w * h).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0;
        for (let k = -reach; k <= reach; k++) {
          const [sx, sy] = horizontal ? [x + k, y] : [x, y + k];
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            v += src[sy * w + sx]! * kernel[k + reach]!;
          }
        }
        out[y * w + x] = v / sum;
      }
    }
    return out;
  };
  return pass(pass(values, true), false);
}

function writeTexture(path: string, t: Texture) {
  const image = blankImage(t.width, t.height);
  for (let i = 0; i < t.data.length; i++) {
    image.data[i] = Math.max(0, Math.min(255, Math.round(t.data[i]! * 255)));
  }
  writePng(path, image);
}

// ---------------------------------------------------------------- area raster for the checks

type Raster = { rgb: Float32Array };
const [W, H] = VIEW;

/** The view-space planet for a chunk item in the planets layer. */
function planetsInView(data: GalaxyBackdrop, camera: Xy, checker = false) {
  const rule = RULES.phenomena.planets;
  const origin = layerOrigin(camera, rule.parallax);
  const rect: Rect = [
    origin[0] - W / 2 - 220,
    origin[1] - H / 2 - 120,
    origin[0] + W / 2 + 220,
    origin[1] + H / 2 + 120,
  ];
  return chunkItems(data.seed, rule.salt, rule as unknown as { chunk: Xy; chance: number }, rect)
    .filter((item) => !checker || (item.i + item.j) % 2 === 0)
    .map((item) => {
      const planet =
        data.planets[Math.floor(unit(data.seed, item.id, "planet-look") * data.planets.length)]!;
      const r =
        (rule.radius[0] +
          (rule.radius[1] - rule.radius[0]) * unit(data.seed, item.id, "planet-r")) *
        planet.size;
      const tilt =
        rule.ring.tilt[0] +
        (rule.ring.tilt[1] - rule.ring.tilt[0]) * unit(data.seed, item.id, "planet-tilt");
      return { planet, r, tilt, x: item.x - origin[0] + W / 2, y: item.y - origin[1] + H / 2 };
    });
}

function farInView(data: GalaxyBackdrop, camera: Xy) {
  if (data.far.length === 0) {
    return [];
  }
  const rule = RULES.phenomena.far;
  const origin = layerOrigin(camera, rule.parallax);
  const rect: Rect = [
    origin[0] - W / 2 - 400,
    origin[1] - H / 2 - 200,
    origin[0] + W / 2 + 400,
    origin[1] + H / 2 + 200,
  ];
  return chunkItems(
    data.seed,
    rule.salt,
    rule as unknown as { chunk: Xy; chance: number },
    rect,
  ).map((item) => ({
    recipe: data.far[Math.floor(unit(data.seed, item.id, "far-look") * data.far.length)]!,
    variant: Math.floor(unit(data.seed, item.id, "far-variant") * 2),
    x: item.x - origin[0] + W / 2,
    y: item.y - origin[1] + H / 2,
  }));
}

const facet = (angle: number, n: number) =>
  Math.cos(Math.PI / n) /
  Math.cos(
    (((angle % ((2 * Math.PI) / n)) + (2 * Math.PI) / n) % ((2 * Math.PI) / n)) - Math.PI / n,
  );

function renderArea(
  data: GalaxyBackdrop,
  camera: Xy,
  nebulae: Texture[],
  field?: FieldPlates,
): Raster {
  const rgbOut = new Float32Array(W * H * 3);
  const sky = data.sky;
  const [from, to] = [float(sky.from), float(sky.to)];
  const put = (p: number, c: readonly number[], a: number) => {
    for (let k = 0; k < 3; k++) {
      rgbOut[p * 3 + k] = c[k]! * a + rgbOut[p * 3 + k]! * (1 - a);
    }
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = sky.flip ? 1 - x / W : x / W;
      let t = Math.min(1, Math.max(0, fx * sky.weights[0] + (y / H) * sky.weights[1] + sky.offset));
      t = t * t * (3 - 2 * t);
      const p = y * W + x;
      for (let k = 0; k < 3; k++) {
        rgbOut[p * 3 + k] = from[k]! * (1 - t) + to[k]! * t;
      }
    }
  }
  // L2 fixed: the haze texture, centred on the view at its texel scale.
  if (data.fixed.includes("backdropHaze")) {
    const s = HAZE.texel;
    const [dw, dh] = [hazeTexture.width * s, hazeTexture.height * s];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = sample(
          hazeTexture,
          (x + 0.5 + (dw - W) / 2) / s - 0.5,
          (y + 0.5 + (dh - H) / 2) / s - 0.5,
        );
        put(y * W + x, c, c[3]);
      }
    }
  }
  // L2 fixed: the band's summed Gaussian profile across its line through `through`.
  if (data.fixed.includes("needleBand")) {
    const a = (band.angle * Math.PI) / 180;
    const [px, py] = [band.through[0] * W, band.through[1] * H];
    const colour = float(band.color);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = -(x + 0.5 - px) * Math.sin(a) + (y + 0.5 - py) * Math.cos(a);
        const alpha = band.profile.reduce(
          (sum, { alpha: k, sigma }) => sum + k * Math.exp(-((d / sigma) ** 2)),
          0,
        );
        put(y * W + x, colour, alpha);
      }
    }
  }
  // L2 far items.
  for (const item of farInView(data, camera)) {
    if (item.recipe.look === "nebula") {
      const t = nebulae[item.variant]!;
      const scale = RULES.phenomena.nebula.scale;
      const [dw, dh] = RULES.phenomena.nebula.display;
      for (
        let y = Math.max(0, Math.floor(item.y - dh! / 2));
        y < Math.min(H, item.y + dh! / 2);
        y++
      ) {
        for (
          let x = Math.max(0, Math.floor(item.x - dw! / 2));
          x < Math.min(W, item.x + dw! / 2);
          x++
        ) {
          const s = sample(
            t,
            (x + 0.5 - item.x + dw! / 2) / scale - 0.5,
            (y + 0.5 - item.y + dh! / 2) / scale - 0.5,
          );
          put(y * W + x, s, s[3]);
        }
      }
    } else {
      const { glow } = RULES.phenomena.cluster;
      const colour = float((item.recipe.colors as Record<string, string>).glow!);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const g = Math.exp(
            -(
              ((x + 0.5 - item.x) / glow.sigma[0]!) ** 2 +
              ((y + 0.5 - item.y) / glow.sigma[1]!) ** 2
            ),
          );
          if (g > 1e-3) {
            put(y * W + x, colour, g * glow.alpha);
          }
        }
      }
    }
  }
  // L2 planets.
  const rule = RULES.phenomena.planets;
  const [lx, ly] = rule.light;
  const fieldPlanets = FIELD_RULES.phenomena.planets;
  for (const { planet, r, x: cx, y: cy } of field ? planetsInView(data, camera, true) : []) {
    const c = Object.fromEntries(Object.entries(planet.colors).map(([k, v]) => [k, float(v)]));
    const push = fieldPlanets.lit.push[planet.look === "crescent" ? "crescent" : "gibbous"];
    const ringed = planet.look === "ringed";
    const tilt = (fieldPlanets.ring.tilt * Math.PI) / 180;
    const ext = r * 2.15;
    for (let y = Math.max(0, Math.floor(cy - ext)); y < Math.min(H, cy + ext); y++) {
      for (let x = Math.max(0, Math.floor(cx - ext)); x < Math.min(W, cx + ext); x++) {
        const [dx, dy] = [x + 0.5 - cx, y + 0.5 - cy];
        const p = y * W + x;
        const ru = dx * Math.cos(tilt) + dy * Math.sin(tilt);
        const rv = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
        const e = Math.hypot(
          ru / (r * fieldPlanets.ring.radii[0]!),
          rv / (r * fieldPlanets.ring.radii[1]!),
        );
        const onRing = ringed && e > fieldPlanets.ring.band.from && e < fieldPlanets.ring.band.to;
        if (onRing && rv < 0) put(p, c.ring!, 1);
        if (Math.hypot(dx, dy) <= r) {
          put(p, c.night!, 1);
          if (Math.hypot(dx - lx * push * r, dy - ly * push * r) <= r * fieldPlanets.lit.radius) {
            put(p, c.lit!, 1);
          }
        }
        if (onRing && rv >= 0) put(p, c.ring!, 1);
      }
    }
  }
  for (const { planet, r, tilt, x: cx, y: cy } of field ? [] : planetsInView(data, camera)) {
    const c = Object.fromEntries(Object.entries(planet.colors).map(([k, v]) => [k, float(v)]));
    const push = planet.look === "crescent" ? rule.push.crescent : rule.push.gibbous;
    const ringed = planet.look === "ringed";
    const [ca, sa] = [Math.cos((tilt * Math.PI) / 180), Math.sin((tilt * Math.PI) / 180)];
    const ext = r * 2.15;
    for (let y = Math.max(0, Math.floor(cy - ext)); y < Math.min(H, cy + ext); y++) {
      for (let x = Math.max(0, Math.floor(cx - ext)); x < Math.min(W, cx + ext); x++) {
        const [dx, dy] = [x + 0.5 - cx, y + 0.5 - cy];
        const p = y * W + x;
        let ringAlpha = 0;
        let front = false;
        if (ringed) {
          const ru = dx * ca + dy * sa;
          const rv = -dx * sa + dy * ca;
          const e = Math.hypot(ru / (r * rule.ring.radii[0]!), rv / (r * rule.ring.radii[1]!));
          for (const b of rule.ring.bands) {
            if (e > b.from && e < b.to) {
              ringAlpha = b.alpha;
            }
          }
          front = rv >= 0;
          if (!front && ringAlpha > 0) {
            put(p, c.ring!, ringAlpha);
          }
        }
        if (Math.hypot(dx, dy) <= r) {
          put(p, c.night!, 1);
          const [s1x, s1y] = [dx + lx * r * push, dy + ly * r * push];
          if (Math.hypot(s1x, s1y) / facet(Math.atan2(s1y, s1x), rule.facets) > r) {
            put(p, c.body!, 1);
          }
          const [s2x, s2y] = [
            dx + lx * r * push * rule.lit.push,
            dy + ly * r * push * rule.lit.push,
          ];
          if (
            Math.hypot(s2x, s2y) / facet(Math.atan2(s2y, s2x), rule.facets) >
            r * rule.lit.inset
          ) {
            put(p, c.lit!, planet.look === "moon" ? rule.moonLitAlpha : 1);
          }
        }
        if (ringed && front && ringAlpha > 0) {
          put(p, c.ring!, ringAlpha);
        }
      }
    }
  }
  // L1 plates: grey multiply for darker steps, screen for lighter ones.
  const origin = layerOrigin(camera, RULES.plates.parallax);
  const rect: Rect = [origin[0] - W / 2, origin[1] - H / 2, origin[0] + W / 2, origin[1] + H / 2];
  const drawn = field
    ? motifPlates(MOTIF_RULES, field.motif.rings, rect, 2 * MOTIF_SIZE).map(({ even, rings }) => ({
        paint: field.steps[even ? 0 : 1],
        rings,
      }))
    : plates(data.seed, PLATE_RULES, data.plates, rect).map((plate) => ({
        paint: data.plates.steps.find((s) => s.step === plate.step)!,
        rings: [plate.points],
      }));
  for (const { paint, rings } of drawn) {
    const shape = rings.map((ring) => ring.map(([u, v]): Xy => [u - rect[0], v - rect[1]]));
    const pts = shape[0]!;
    const xs = pts.map(([u]) => u);
    const ys = pts.map(([, v]) => v);
    const s = paint.screen ? float(paint.screen) : undefined;
    for (
      let y = Math.max(0, Math.floor(Math.min(...ys)));
      y < Math.min(H, Math.ceil(Math.max(...ys)));
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor(Math.min(...xs)));
        x < Math.min(W, Math.ceil(Math.max(...xs)));
        x++
      ) {
        if (!insideRings(shape, x + 0.5, y + 0.5)) {
          continue;
        }
        const p = y * W + x;
        for (let k = 0; k < 3; k++) {
          let v = rgbOut[p * 3 + k]!;
          if (paint.multiply !== undefined) {
            v *= paint.multiply;
          }
          if (s) {
            v = 1 - (1 - v) * (1 - s[k]!);
          }
          rgbOut[p * 3 + k] = v;
        }
      }
    }
  }
  return { rgb: rgbOut };
}

/** Grey opening (erode then dilate) with a size by size square, separable. */
function opening(values: Float64Array, size: number, light: boolean): Float64Array {
  const half = Math.floor(size / 2);
  // A light field's extreme is its darkest tone: open the negated map.
  const pick = (a: number, b: number, erode: boolean) =>
    erode !== light ? Math.min(a, b) : Math.max(a, b);
  const pass = (src: Float64Array, horizontal: boolean, erode: boolean) => {
    const out = new Float64Array(src.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = src[y * W + x]!;
        for (let k = -half; k <= half; k++) {
          const [sx, sy] = horizontal ? [x + k, y] : [x, y + k];
          if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
            v = pick(v, src[sy * W + sx]!, erode);
          }
        }
        out[y * W + x] = v;
      }
    }
    return out;
  };
  return pass(pass(pass(pass(values, true, true), false, true), true, false), false, false);
}

/**
 * Preview only: the stars (twinkle at rest, 0.85) and dust streaks over an area raster, by the
 * rules in art/backdrop.md, with 4 by 4 supersampled coverage.
 */
function drawPoints(data: GalaxyBackdrop, camera: Xy, raster: Raster, field = false) {
  const put = (x: number, y: number, c: readonly number[], a: number) => {
    const [px, py] = [Math.floor(x), Math.floor(y)];
    if (px < 0 || py < 0 || px >= W || py >= H) {
      return;
    }
    const p = (py * W + px) * 3;
    for (let k = 0; k < 3; k++) {
      raster.rgb[p + k] = c[k]! * a + raster.rgb[p + k]! * (1 - a);
    }
  };
  const disc = (cx: number, cy: number, r: number, c: readonly number[], a: number) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        let hits = 0;
        for (let s = 0; s < 16; s++) {
          const [sx, sy] = [x + ((s % 4) + 0.5) / 4, y + (Math.floor(s / 4) + 0.5) / 4];
          if (Math.hypot(sx - cx, sy - cy) <= r) {
            hits++;
          }
        }
        if (hits > 0) {
          put(x, y, c, (a * hits) / 16);
        }
      }
    }
  };
  const { stars } = RULES;
  const starColour = float(data.stars.color);
  for (const layer of stars.layers) {
    const origin = layerOrigin(camera, layer.parallax);
    const [x0, y0] = [origin[0] - W / 2, origin[1] - H / 2];
    for (let i = Math.floor(x0 / stars.chunk); i <= Math.floor((x0 + W) / stars.chunk); i++) {
      for (let j = Math.floor(y0 / stars.chunk); j <= Math.floor((y0 + H) / stars.chunk); j++) {
        const id = `${i},${j}`;
        for (let k = 0; k < layer.perChunk; k++) {
          const s = `star-${layer.name}-${k}`;
          const x = (i + unit(data.seed, id, `${s}-x`)) * stars.chunk - x0;
          const y = (j + unit(data.seed, id, `${s}-y`)) * stars.chunk - y0;
          const large = unit(data.seed, id, `${s}-l`) > 1 - stars.large.share;
          const r = layer.radius * (large ? stars.large.scale : 1);
          const alpha =
            data.stars.alpha[layer.name as "far" | "near"] *
            (0.55 + 0.45 * unit(data.seed, id, `${s}-b`)) *
            stars.twinkle.reducedMotion;
          disc(x, y, r, starColour, alpha);
        }
      }
    }
  }
  const rule = RULES.debris.streaks;
  const origin = layerOrigin(camera, rule.parallax);
  const rect: Rect = [
    origin[0] - W / 2 - 80,
    origin[1] - H / 2 - 80,
    origin[0] + W / 2 + 80,
    origin[1] + H / 2 + 80,
  ];
  const streakColour = float(data.streaks.color);
  if (field) {
    const { cell, length, parallax } = FIELD_RULES.debris.streaks;
    const base = layerOrigin(camera, parallax);
    const angle = (data.streaks.angle * Math.PI) / 180;
    for (const item of checkerItems(cell, [
      base[0] - W / 2 - 80,
      base[1] - H / 2 - 80,
      base[0] + W / 2 + 80,
      base[1] + H / 2 + 80,
    ])) {
      const [cx, cy] = [item.x - base[0] + W / 2, item.y - base[1] + H / 2];
      for (let t = 0; t <= length; t += 0.5) {
        put(
          cx + Math.cos(angle) * (t - length / 2),
          cy + Math.sin(angle) * (t - length / 2),
          streakColour,
          data.streaks.alpha * 0.5,
        );
      }
    }
    return;
  }
  for (const item of chunkItems(
    data.seed,
    rule.salt,
    rule as unknown as { chunk: Xy; chance: number },
    rect,
  )) {
    const length =
      rule.length[0]! +
      (rule.length[1]! - rule.length[0]!) * unit(data.seed, item.id, "streak-length");
    const angle =
      ((data.streaks.angle + (unit(data.seed, item.id, "streak-angle") - 0.5) * rule.spread) *
        Math.PI) /
      180;
    const [cx, cy] = [item.x - origin[0] + W / 2, item.y - origin[1] + H / 2];
    for (let t = 0; t <= length; t += 0.5) {
      const fade = Math.sin((Math.PI * t) / length);
      const x = cx + Math.cos(angle) * (t - length / 2);
      const y = cy + Math.sin(angle) * (t - length / 2);
      put(x, y, streakColour, data.streaks.alpha * fade * 0.5);
    }
  }
}

// ---------------------------------------------------------------- run

const previewArg = process.argv.indexOf("--preview");
const previewDir = previewArg === -1 ? undefined : process.argv[previewArg + 1];
if (previewDir) {
  mkdirSync(previewDir, { recursive: true });
}

const failures: string[] = [];
const fail = (message: string) => failures.push(message);

/** A camera that puts the first chunk item with `pick` at the view centre. */
function centring(
  data: GalaxyBackdrop,
  kind: "planets" | "far",
  pick: (id: string) => boolean,
): Xy | undefined {
  const rule = RULES.phenomena[kind];
  for (let i = 0; i < 400; i++) {
    for (let j = 0; j < 4; j++) {
      const items = chunkItems(
        data.seed,
        rule.salt,
        rule as unknown as { chunk: Xy; chance: number },
        [i * rule.chunk[0]!, j * rule.chunk[1]!, i * rule.chunk[0]! + 1, j * rule.chunk[1]! + 1],
      ).filter((item) => item.i === i && item.j === j && pick(item.id));
      const item = items[0];
      if (item) {
        const [sx, sy] = [item.x / rule.parallax, item.y / rule.parallax];
        return [sy + sx / 2, sy - sx / 2];
      }
    }
  }
  return undefined;
}

const writes: (() => void)[] = [];
for (const galaxy of GALAXIES) {
  const full = build(galaxy);
  writes.push(() => writeDecorations(full.planets[0]!.colors, galaxy));
  const data = muted(full);
  const bg = data.background;
  const yb = luminance(float(bg));
  const light = data.light;
  // Per-layer caps, from the colours alone.
  const skyRatio = ratio(luminance(float(data.sky.to)), yb);
  const skyCap = light ? CAPS.sky.light : CAPS.sky.dark;
  if (skyRatio > skyCap + 0.005 || luminance(float(data.sky.to)) > yb) {
    fail(`${galaxy}: sky ${data.sky.to} ${skyRatio.toFixed(2)}:1 passes ${skyCap}:1 or lightens`);
  }
  const plateCaps = light ? CAPS.plates.light : CAPS.plates.dark;
  for (const paint of data.plates.steps) {
    const { step } = paint;
    const result =
      paint.multiply !== undefined
        ? (float(bg).map((v) => v * paint.multiply!) as Float3)
        : screen(float(bg), float(paint.screen!));
    const r = ratio(luminance(result), yb);
    const cap = Number(step) < 0 ? plateCaps.darker : plateCaps.lighter;
    if (r > cap + 0.01) {
      fail(`${galaxy}: plate step ${step} ${r.toFixed(3)}:1 passes ${cap}:1`);
    }
  }
  for (const planet of data.planets) {
    const r = ratio(luminance(float(planet.colors.body!)), yb);
    if (!light && r > CAPS.phenomena.body + 0.005) {
      fail(`${galaxy}: ${planet.look} body ${r.toFixed(2)}:1 passes ${CAPS.phenomena.body}:1`);
    }
  }
  const starCaps = light ? CAPS.stars.light : CAPS.stars.dark;
  for (const layer of ["far", "near"] as const) {
    const r = ratio(
      luminance(over(float(data.stars.color), data.stars.alpha[layer], float(bg))),
      yb,
    );
    if (r > starCaps[layer] + 0.01) {
      fail(`${galaxy}: ${layer} stars ${r.toFixed(2)}:1 pass ${starCaps[layer]}:1`);
    }
  }
  const streak = ratio(
    luminance(over(float(data.streaks.color), data.streaks.alpha, float(bg))),
    yb,
  );
  if (streak > CAPS.streaks + 0.01) {
    fail(`${galaxy}: streaks ${streak.toFixed(2)}:1 pass ${CAPS.streaks}:1`);
  }

  // Nebula textures.
  const nebulae: Texture[] = [];
  for (const recipe of data.far) {
    if (recipe.look !== "nebula") {
      continue;
    }
    const assets = recipe.assets as string[];
    const entries = assets.map((id, k) => {
      const texture = nebulaTexture(data.seed, k + 1, recipe.colors as Record<string, string>);
      nebulae.push(texture);
      writes.push(() => writeTexture(`${art}${galaxy}/nebula-${k + 1}.png`, texture));
      const { display } = RULES.phenomena.nebula;
      return {
        id,
        path: `/art/${galaxy}/nebula-${k + 1}.png`,
        width: texture.width,
        height: texture.height,
        displayWidth: display[0],
        displayHeight: display[1],
        facing: "fixed",
        pivot: { x: 0.5, y: 0.5 },
      };
    });
    writes.push(() => replaceEntries(galaxy, (id) => id.startsWith(`nebula-${galaxy}-`), entries));
  }

  // Area check over sampled cameras.
  const today = todayTone(galaxy);
  const yToday = luminance(today);
  const cameras: Xy[] = Array.from({ length: RULES.check.cameras }, (_, k) => [
    unit(data.seed, `${k}`, "camera-x") * 120000 - 60000,
    unit(data.seed, `${k}`, "camera-y") * 120000 - 60000,
  ]);
  for (const look of new Set(data.planets.map((p) => p.look))) {
    const camera = centring(
      data,
      "planets",
      (id) =>
        data.planets[Math.floor(unit(data.seed, id, "planet-look") * data.planets.length)]!.look ===
        look,
    );
    if (camera) {
      cameras.push(camera);
    }
  }
  for (const look of new Set(data.far.map((f) => f.look))) {
    const camera = centring(
      data,
      "far",
      (id) =>
        data.far[Math.floor(unit(data.seed, id, "far-look") * data.far.length)]!.look === look,
    );
    if (camera) {
      cameras.push(camera);
    }
  }
  // The area check of one field over its cameras: each signal's sampled minimum against today's,
  // and the extreme tone. `tag` names the field in previews and failures.
  const measure = (
    tag: string,
    views: readonly Xy[],
    render: (camera: Xy) => Raster,
    points: (camera: Xy, raster: Raster) => void,
  ) => {
    type ContrastSample = {
      color: string;
      minimum: number;
      location?: {
        camera: number;
        x: number;
        y: number;
        luminance: number;
        sourceColor?: string;
        sourceX?: number;
        sourceY?: number;
      };
    };
    const explicitEdge = fields.galaxies[galaxy]?.foregroundEdge;
    const signals: Record<string, string> = explicitEdge
      ? { foregroundEdge: explicitEdge }
      : light
        ? { ink: fields.lightField.ink }
        : { obstacle: palette.obstacle!, shipWhite: SHIP_WHITE, shipHullDark: SHIP_HULL_DARK };
    const recognition = Object.entries(signals).map(([name, color]) => ({
      name,
      sample: { color, minimum: Infinity } as ContrastSample,
      luminance: luminance(float(color)),
    }));
    const shipContrast: Record<string, ContrastSample> = {
      white: { color: SHIP_WHITE, minimum: Infinity },
      hullDark: { color: SHIP_HULL_DARK, minimum: Infinity },
    };
    const samples = [
      ...recognition,
      ...Object.entries(shipContrast).map(([name, sample]) => ({
        name,
        sample,
        luminance: luminance(float(sample.color)),
      })),
    ];
    let extreme = light ? Infinity : -Infinity;
    let extremeColour: Float3 = float(bg);
    views.forEach((camera, k) => {
      const raster = render(camera);
      const lum = new Float64Array(W * H);
      for (let p = 0; p < W * H; p++) {
        lum[p] = luminance([raster.rgb[p * 3]!, raster.rgb[p * 3 + 1]!, raster.rgb[p * 3 + 2]!]);
      }
      const opened = opening(lum, RULES.check.opening, light);
      for (let p = 0; p < W * H; p++) {
        const v = opened[p]!;
        for (const target of samples) {
          const measured = ratio(target.luminance, v);
          if (measured < target.sample.minimum) {
            target.sample.minimum = measured;
            target.sample.location = { camera: k, x: p % W, y: Math.floor(p / W), luminance: v };
          }
        }
        if (light ? v < extreme : v > extreme) {
          extreme = v;
          extremeColour = [raster.rgb[p * 3]!, raster.rgb[p * 3 + 1]!, raster.rgb[p * 3 + 2]!];
        }
      }
      for (const target of samples) {
        const location = target.sample.location;
        if (location?.camera !== k) continue;
        const source = lum.indexOf(location.luminance);
        if (source < 0) throw new Error("Opened sample has no source tone");
        location.sourceColor = hexOf([
          raster.rgb[source * 3]!,
          raster.rgb[source * 3 + 1]!,
          raster.rgb[source * 3 + 2]!,
        ]);
        location.sourceX = source % W;
        location.sourceY = Math.floor(source / W);
      }
      if (previewDir) {
        points(camera, raster);
        const image = blankImage(W, H);
        for (let p = 0; p < W * H; p++) {
          image.data.set(
            [...[0, 1, 2].map((c) => Math.round(raster.rgb[p * 3 + c]! * 255)), 255],
            p * 4,
          );
        }
        writePng(`${previewDir}/${galaxy}${tag}-${k}.png`, image);
      }
    });
    const checked: Record<string, unknown> = {};
    for (const target of recognition) {
      const before = ratio(target.luminance, yToday);
      const after = target.sample.minimum;
      checked[target.name] = {
        color: target.sample.color,
        today: round(before),
        after: round(after),
        location: target.sample.location,
      };
      if (after < before - 0.005) {
        fail(
          `${galaxy}${tag}: ${target.name} sampled minimum ${after.toFixed(2)}:1 is under today's ${before.toFixed(2)}:1`,
        );
      }
    }
    console.log(
      `${galaxy}${tag}: extreme ${hexOf(extremeColour)} ${ratio(extreme, yb).toFixed(2)}:1, today ${hexOf(today)} ${ratio(yToday, yb).toFixed(2)}:1, ${views.length} cameras`,
    );
    return {
      cameras: views.length,
      today: hexOf(today),
      todayContrast: round(ratio(yToday, yb)),
      extreme: hexOf(extremeColour),
      extremeContrast: round(ratio(extreme, yb)),
      signals: checked,
      shipContrast: Object.fromEntries(
        Object.entries(shipContrast).map(([role, sample]) => [
          role,
          { color: sample.color, minimum: round(sample.minimum), location: sample.location },
        ]),
      ),
    };
  };
  const check = measure(
    "",
    cameras,
    (camera) => renderArea(data, camera, nebulae),
    (camera, raster) => drawPoints(data, camera, raster),
  );
  const { galaxy: id, ...rest } = data;
  const text = json({ version: 1, galaxy: id, ...rest, check });
  writes.push(() => {
    writeFileSync(`${art}${galaxy}/backdrop.json`, text);
    linkData(galaxy, { backdrop: `/art/${galaxy}/backdrop.json` });
  });

  // The staged motif field: the same tones, with the galaxy's first lighter and first darker
  // plate steps (its two darker steps where it has no lighter one), checked over the random
  // cameras and one centred on each planet look and far look it draws.
  const paint = (step: number) => data.plates.steps.find((s) => s.step === step)!;
  const field: FieldPlates = {
    motif: { name: MOTIFS[galaxy].name, rings: motifRings(galaxy) },
    steps: data.plates.lighter ? [paint(1), paint(-1)] : [paint(-2), paint(-1)],
  };
  const drawn = (item: string) => {
    const [i, j] = item.split(",").map(Number) as [number, number];
    return (i + j) % 2 === 0;
  };
  const fieldCameras = [
    ...cameras.slice(0, RULES.check.cameras),
    ...[...new Set(data.planets.map((p) => p.look))].flatMap((look) => {
      const camera = centring(
        data,
        "planets",
        (item) =>
          drawn(item) &&
          data.planets[Math.floor(unit(data.seed, item, "planet-look") * data.planets.length)]!
            .look === look,
      );
      return camera ? [camera] : [];
    }),
    ...[...new Set(data.far.map((f) => f.look))].flatMap((look) => {
      const camera = centring(
        data,
        "far",
        (item) =>
          data.far[Math.floor(unit(data.seed, item, "far-look") * data.far.length)]!.look === look,
      );
      return camera ? [camera] : [];
    }),
  ];
  const fieldCheck = measure(
    "-lattice",
    fieldCameras,
    (camera) => renderArea(data, camera, nebulae, field),
    (camera, raster) => drawPoints(data, camera, raster, true),
  );
  const { plates: shipped, ...kept } = rest;
  const fieldText = json({
    version: 2,
    galaxy: id,
    ...kept,
    plates: { lighter: shipped.lighter, ...field },
    check: fieldCheck,
  });
  const fieldPath = `/art/${galaxy}/backdrop-lattice.json`;
  writes.push(() => {
    writeFileSync(`${art}${galaxy}/backdrop-lattice.json`, fieldText);
    stageRows(`field-${galaxy}`, {
      manifest: galaxy,
      links: { backdrop: fieldPath },
      replaces: `/art/${galaxy}/backdrop.json`,
    });
  });
}

// Nothing is written unless every galaxy passes.
if (failures.length > 0) {
  throw new Error(`backdrop caps failed:\n${failures.join("\n")}`);
}
// A placeholder galaxy without its own manifest gets one holding only its backdrop link; a
// built galaxy's manifest replaces it. The core map names every galaxy by its id.
for (const galaxy of GALAXIES) {
  const path = `${art}${galaxy}/manifest.json`;
  if (CONFIG[galaxy].placeholder && !existsSync(path)) {
    mkdirSync(`${art}${galaxy}`, { recursive: true });
    writeFileSync(path, json({ version: 1, assets: [] }));
  }
}
editManifest("core", (manifest) => {
  manifest.galaxies = Object.fromEntries(GALAXIES.map((galaxy) => [galaxy, manifestUrl(galaxy)]));
});
for (const write of writes) {
  write();
}
writeFileSync(`${art}backdrop.json`, json(RULES));
linkData("core", { backdropLayers: "/art/backdrop.json" });
writeFileSync(`${art}backdrop-lattice.json`, json(FIELD_RULES));
stageRows("field", {
  manifest: "core",
  links: { backdropLayers: "/art/backdrop-lattice.json" },
  replaces: "/art/backdrop.json",
});
