import { SCREEN } from "../data/screen.ts";
import { unit } from "./asteroid-art.ts";
import {
  chunkItems,
  layerOrigin,
  type Pattern,
  type PlateRules,
  plates,
  type Step,
  viewRect,
  type Xy,
} from "./backdrop-field.ts";

// The layered backdrop (art/backdrop.md): Art's shared rules (backdrop.json) and each galaxy's
// tones and recipes ({galaxy}/backdrop.json), placed in the play view for a camera, and the
// rasters the scene bakes into textures. A layer point (u, v) draws at (u, v) - origin plus the
// view's centre, the origin being the camera's projected world position times the parallax.

const VIEW: Xy = [SCREEN.width, SCREEN.height];
const CENTRE: Xy = [SCREEN.width / 2, SCREEN.height / 2];
/** Logical px drawn past each edge of the view, so a camera shake shows no bare field. */
export const VIEW_MARGIN = 16;
const EDGE: Xy = [VIEW_MARGIN, VIEW_MARGIN];

type Rgb = readonly [number, number, number];

interface ChunkLayer {
  readonly chance: number;
  readonly chunk: Xy;
  readonly parallax: number;
  readonly salt: string;
}

/** backdrop.json, version 1: the rules every galaxy shares. */
export interface BackdropRules {
  readonly cluster: {
    readonly glow: { readonly alpha: number; readonly sigma: Xy };
    readonly stars: {
      readonly count: number;
      readonly largeShare: number;
      readonly radius: Xy;
      readonly spread: Xy;
    };
  };
  readonly far: ChunkLayer;
  readonly nebula: { readonly display: Xy };
  readonly planets: ChunkLayer & {
    readonly facets: number;
    readonly light: Xy;
    readonly lit: { readonly inset: number; readonly push: number };
    readonly moonLitAlpha: number;
    readonly push: { readonly crescent: number; readonly gibbous: number };
    readonly radius: Xy;
    readonly ring: {
      readonly bands: readonly {
        readonly alpha: number;
        readonly from: number;
        readonly to: number;
      }[];
      readonly radii: Xy;
      readonly tilt: Xy;
    };
  };
  readonly plates: PlateRules & { readonly parallax: number };
  readonly rocks: { readonly parallax: number };
  readonly specks: { readonly parallax: number };
  readonly stars: {
    readonly brightness: Xy;
    readonly chunk: number;
    readonly large: { readonly scale: number; readonly share: number };
    readonly layers: readonly {
      readonly name: "far" | "near";
      readonly parallax: number;
      readonly perChunk: number;
      readonly radius: number;
    }[];
    readonly salt: string;
    readonly twinkle: { readonly period: Xy; readonly range: Xy; readonly reducedMotion: number };
  };
  readonly streaks: ChunkLayer & {
    readonly length: Xy;
    readonly spread: number;
    readonly width: number;
  };
}

export type PlanetLook = "crescent" | "gibbous" | "moon" | "ringed";

export interface PlanetRecipe {
  readonly colors: {
    readonly body: string;
    readonly lit: string;
    readonly night: string;
    readonly ring: string;
  };
  readonly look: PlanetLook;
  readonly size: number;
}

export type FarRecipe =
  | { readonly assets: readonly [string, string]; readonly look: "nebula" }
  | {
      readonly alpha: number;
      readonly colors: { readonly glow: string; readonly star: string };
      readonly look: "cluster";
    };

export interface PlateStep {
  readonly multiply?: number;
  readonly screen?: string;
  readonly step: Step;
}

/** {galaxy}/backdrop.json, version 1: one galaxy's tones and recipes. */
export interface GalaxyBackdrop {
  readonly far: readonly FarRecipe[];
  /** The manifest links of the fixed L2 layers: backdropHaze, needleBand. */
  readonly fixed: readonly string[];
  readonly galaxy: string;
  readonly planets: readonly PlanetRecipe[];
  readonly plates: {
    readonly jitter: number;
    readonly lattice: readonly [Xy, Xy];
    readonly lighter: boolean;
    readonly pattern: Pattern;
    readonly split: boolean;
    readonly steps: readonly PlateStep[];
  };
  readonly seed: number;
  readonly sky: {
    readonly flip: boolean;
    readonly from: string;
    readonly offset: number;
    readonly to: string;
    readonly weights: Xy;
  };
  readonly stars: {
    readonly alpha: { readonly far: number; readonly near: number };
    readonly color: string;
  };
  readonly streaks: { readonly alpha: number; readonly angle: number; readonly color: string };
}

const HEX = /^#[0-9a-f]{6}$/iu;
type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : {};
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const fraction = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1;
const hex = (value: unknown): value is string => typeof value === "string" && HEX.test(value);
const pair = (value: unknown, each = finite): value is Xy =>
  Array.isArray(value) && value.length === 2 && value.every((entry) => each(entry));

class Malformed extends Error {}

/** `value` when `valid` holds for it; otherwise the read fails. */
function must<T>(valid: (value: unknown) => value is T, value: unknown): T {
  if (!valid(value)) {
    throw new Malformed();
  }
  return value;
}

function readChunkLayer(value: unknown): ChunkLayer {
  const data = fields(value);
  return {
    chance: must(fraction, data.chance),
    chunk: must((entry) => pair(entry, positive), data.chunk),
    parallax: must(fraction, data.parallax),
    salt: must((entry) => typeof entry === "string", data.salt),
  };
}

/** Art's shared backdrop rules, version 1; undefined if any part is missing or malformed. */
export function readBackdropRules(value: unknown): BackdropRules | undefined {
  const data = fields(value);
  if (data.version !== 1) {
    return undefined;
  }
  try {
    const phenomena = fields(data.phenomena);
    const planets = fields(phenomena.planets);
    const ring = fields(planets.ring);
    const cluster = fields(phenomena.cluster);
    const plateData = fields(data.plates);
    const starData = fields(data.stars);
    const twinkle = fields(starData.twinkle);
    const debris = fields(data.debris);
    const streaks = fields(debris.streaks);
    const edges = must(
      (entry): entry is [number, number, number, number] =>
        Array.isArray(entry) && entry.length === 4 && entry.every(finite),
      plateData.edges,
    );
    const layers = must((entry): entry is unknown[] => Array.isArray(entry), starData.layers).map(
      (entry) => {
        const layer = fields(entry);
        return {
          name: must(
            (name): name is "far" | "near" => name === "far" || name === "near",
            layer.name,
          ),
          parallax: must(fraction, layer.parallax),
          perChunk: must(positive, layer.perChunk),
          radius: must(positive, layer.radius),
        };
      },
    );
    return {
      cluster: {
        glow: {
          alpha: must(fraction, fields(cluster.glow).alpha),
          sigma: must((entry) => pair(entry, positive), fields(cluster.glow).sigma),
        },
        stars: {
          count: must(positive, fields(cluster.stars).count),
          largeShare: must(fraction, fields(cluster.stars).largeShare),
          radius: must((entry) => pair(entry, positive), fields(cluster.stars).radius),
          spread: must((entry) => pair(entry, positive), fields(cluster.stars).spread),
        },
      },
      far: readChunkLayer(phenomena.far),
      nebula: { display: must((entry) => pair(entry, positive), fields(phenomena.nebula).display) },
      planets: {
        ...readChunkLayer(planets),
        facets: must(positive, planets.facets),
        light: must(pair, planets.light),
        lit: {
          inset: must(positive, fields(planets.lit).inset),
          push: must(finite, fields(planets.lit).push),
        },
        moonLitAlpha: must(fraction, planets.moonLitAlpha),
        push: {
          crescent: must(finite, fields(planets.push).crescent),
          gibbous: must(finite, fields(planets.push).gibbous),
        },
        radius: must((entry) => pair(entry, positive), planets.radius),
        ring: {
          bands: must((entry): entry is unknown[] => Array.isArray(entry), ring.bands).map(
            (entry) => {
              const band = fields(entry);
              return {
                alpha: must(fraction, band.alpha),
                from: must(positive, band.from),
                to: must(positive, band.to),
              };
            },
          ),
          radii: must((entry) => pair(entry, positive), ring.radii),
          tilt: must(pair, ring.tilt),
        },
      },
      plates: {
        edges,
        jitterWeight: must(finite, plateData.jitterWeight),
        parallax: must(fraction, plateData.parallax),
        patternWeight: must(finite, plateData.patternWeight),
      },
      rocks: { parallax: must(fraction, fields(debris.rocks).parallax) },
      specks: { parallax: must(fraction, fields(debris.specks).parallax) },
      stars: {
        brightness: must(pair, starData.brightness),
        chunk: must(positive, starData.chunk),
        large: {
          scale: must(positive, fields(starData.large).scale),
          share: must(fraction, fields(starData.large).share),
        },
        layers,
        salt: must((entry) => typeof entry === "string", starData.salt),
        twinkle: {
          period: must((entry) => pair(entry, positive), twinkle.period),
          range: must((entry) => pair(entry, fraction), twinkle.range),
          reducedMotion: must(fraction, twinkle.reducedMotion),
        },
      },
      streaks: {
        ...readChunkLayer(streaks),
        length: must((entry) => pair(entry, positive), streaks.length),
        spread: must(finite, streaks.spread),
        width: must(positive, streaks.width),
      },
    };
  } catch (error) {
    if (error instanceof Malformed) {
      return undefined;
    }
    throw error;
  }
}

const LOOKS: readonly PlanetLook[] = ["crescent", "gibbous", "moon", "ringed"];

function readPlanet(value: unknown): PlanetRecipe {
  const data = fields(value);
  const colors = fields(data.colors);
  return {
    colors: {
      body: must(hex, colors.body),
      lit: must(hex, colors.lit),
      night: must(hex, colors.night),
      ring: must(hex, colors.ring),
    },
    look: must((look): look is PlanetLook => LOOKS.includes(look as PlanetLook), data.look),
    size: must(positive, data.size),
  };
}

function readFar(value: unknown): FarRecipe {
  const data = fields(value);
  if (data.look === "nebula") {
    return {
      assets: must(
        (assets): assets is [string, string] =>
          Array.isArray(assets) &&
          assets.length === 2 &&
          assets.every((id) => typeof id === "string"),
        data.assets,
      ),
      look: "nebula",
    };
  }
  const colors = fields(data.colors);
  must((look) => look === "cluster", data.look);
  return {
    alpha: must(fraction, data.alpha),
    colors: { glow: must(hex, colors.glow), star: must(hex, colors.star) },
    look: "cluster",
  };
}

function readStep(value: unknown): PlateStep {
  const data = fields(value);
  const step = must(
    (entry): entry is Step => entry === -2 || entry === -1 || entry === 1 || entry === 2,
    data.step,
  );
  if (step < 0) {
    return { multiply: must(fraction, data.multiply), step };
  }
  return { screen: must(hex, data.screen), step };
}

/** A galaxy's backdrop, version 1; undefined if any part is missing or malformed. */
export function readGalaxyBackdrop(value: unknown): GalaxyBackdrop | undefined {
  const data = fields(value);
  if (data.version !== 1) {
    return undefined;
  }
  try {
    const sky = fields(data.sky);
    const plateData = fields(data.plates);
    const stars = fields(data.stars);
    const streaks = fields(data.streaks);
    const list = (entry: unknown): entry is unknown[] => Array.isArray(entry);
    return {
      far: must(list, data.far).map(readFar),
      fixed: must(list, data.fixed).map((link) =>
        must((name): name is string => typeof name === "string", link),
      ),
      galaxy: must((id): id is string => typeof id === "string", data.galaxy),
      planets: must(list, data.planets).map(readPlanet),
      plates: {
        jitter: must(finite, plateData.jitter),
        lattice: must(
          (entry): entry is [Xy, Xy] =>
            Array.isArray(entry) && entry.length === 2 && entry.every((node) => pair(node)),
          plateData.lattice,
        ),
        lighter: must((flag): flag is boolean => typeof flag === "boolean", plateData.lighter),
        pattern: must(
          (entry): entry is Pattern => Object.keys(fields(entry)).length > 0,
          plateData.pattern,
        ),
        split: must((flag): flag is boolean => typeof flag === "boolean", plateData.split),
        steps: must(list, plateData.steps).map(readStep),
      },
      seed: must(finite, data.seed),
      sky: {
        flip: must((flag): flag is boolean => typeof flag === "boolean", sky.flip),
        from: must(hex, sky.from),
        offset: must(finite, sky.offset),
        to: must(hex, sky.to),
        weights: must(pair, sky.weights),
      },
      stars: {
        alpha: {
          far: must(fraction, fields(stars.alpha).far),
          near: must(fraction, fields(stars.alpha).near),
        },
        color: must(hex, stars.color),
      },
      streaks: {
        alpha: must(fraction, streaks.alpha),
        angle: must(finite, streaks.angle),
        color: must(hex, streaks.color),
      },
    };
  } catch (error) {
    if (error instanceof Malformed) {
      return undefined;
    }
    throw error;
  }
}

/** A `#rrggbb` colour as 0 to 1 channels. */
function rgb(color: string): Rgb {
  const value = Number.parseInt(color.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** The sky's colour at view point (x, y) in logical px, 0 to 1 channels. */
export function skyColor(sky: GalaxyBackdrop["sky"], x: number, y: number): Rgb {
  const fx = sky.flip ? 1 - x / VIEW[0] : x / VIEW[0];
  let t = Math.min(
    1,
    Math.max(0, fx * sky.weights[0] + (y / VIEW[1]) * sky.weights[1] + sky.offset),
  );
  t = t * t * (3 - 2 * t);
  const [from, to] = [rgb(sky.from), rgb(sky.to)];
  return [0, 1, 2].map((k) => from[k]! * (1 - t) + to[k]! * t) as unknown as Rgb;
}

/** A layer point in the play view, in logical px. */
const toView = (origin: Xy, [u, v]: Xy): Xy => [
  u - origin[0] + CENTRE[0],
  v - origin[1] + CENTRE[1],
];

/** A view plate: its corners in the play view and the step's grey multiply or screen colour. */
export interface ViewPlate {
  readonly multiply?: number;
  readonly points: readonly Xy[];
  readonly screen?: string;
}

/** The plates over the view (and its margin) for a camera at world `camera`. */
export function viewPlates(rules: BackdropRules, galaxy: GalaxyBackdrop, camera: Xy): ViewPlate[] {
  const origin = layerOrigin(camera, rules.plates.parallax);
  const steps = new Map(galaxy.plates.steps.map((step) => [step.step, step]));
  return plates(galaxy.seed, rules.plates, galaxy.plates, viewRect(origin, VIEW, EDGE)).flatMap(
    (plate) => {
      const paint = steps.get(plate.step);
      return paint
        ? [{ ...paint, points: plate.points.map((point) => toView(origin, point)) }]
        : [];
    },
  );
}

/** A planet in the play view: its chunk's id, recipe, radius, ring tilt and centre. */
export interface ViewPlanet {
  readonly id: string;
  readonly recipe: PlanetRecipe;
  readonly r: number;
  readonly tilt: number;
  readonly x: number;
  readonly y: number;
}

/** A planet's extent from its centre in units of its radius: the ring's 2 r and its edge. */
const PLANET_EXTENT = 2.15;

/** The planets that meet the view for a camera at world `camera`. */
export function viewPlanets(
  rules: BackdropRules,
  galaxy: GalaxyBackdrop,
  camera: Xy,
): ViewPlanet[] {
  const { planets } = galaxy;
  if (planets.length === 0) {
    return [];
  }
  const rule = rules.planets;
  const origin = layerOrigin(camera, rule.parallax);
  const largest = rule.radius[1] * Math.max(...planets.map(({ size }) => size)) * PLANET_EXTENT;
  return chunkItems(galaxy.seed, rule.salt, rule, viewRect(origin, VIEW, [largest, largest])).map(
    (item) => {
      const recipe =
        planets[Math.floor(unit(galaxy.seed, item.id, "planet-look") * planets.length)]!;
      const [x, y] = toView(origin, [item.x, item.y]);
      return {
        id: item.id,
        r:
          (rule.radius[0] +
            (rule.radius[1] - rule.radius[0]) * unit(galaxy.seed, item.id, "planet-r")) *
          recipe.size,
        recipe,
        tilt:
          rule.ring.tilt[0] +
          (rule.ring.tilt[1] - rule.ring.tilt[0]) * unit(galaxy.seed, item.id, "planet-tilt"),
        x,
        y,
      };
    },
  );
}

/** A far item in the play view: a nebula texture variant or a star cluster, at its centre. */
export interface ViewFar {
  readonly id: string;
  readonly recipe: FarRecipe;
  readonly variant: number;
  readonly x: number;
  readonly y: number;
}

/** A cluster's glow reaches 3 sigma, past which it is under 1/8000. */
const GLOW_REACH = 3;

/** The far items that meet the view for a camera at world `camera`. */
export function viewFar(rules: BackdropRules, galaxy: GalaxyBackdrop, camera: Xy): ViewFar[] {
  const { far } = galaxy;
  if (far.length === 0) {
    return [];
  }
  const rule = rules.far;
  const origin = layerOrigin(camera, rule.parallax);
  const { sigma } = rules.cluster.glow;
  const reach: Xy = [
    Math.max(rules.nebula.display[0] / 2, sigma[0] * GLOW_REACH),
    Math.max(rules.nebula.display[1] / 2, sigma[1] * GLOW_REACH),
  ];
  return chunkItems(galaxy.seed, rule.salt, rule, viewRect(origin, VIEW, reach)).map((item) => {
    const [x, y] = toView(origin, [item.x, item.y]);
    return {
      id: item.id,
      recipe: far[Math.floor(unit(galaxy.seed, item.id, "far-look") * far.length)]!,
      variant: Math.floor(unit(galaxy.seed, item.id, "far-variant") * 2),
      x,
      y,
    };
  });
}

/** A star in the play view: its centre, radius in logical px and alpha with the twinkle. */
export interface ViewStar {
  readonly alpha: number;
  readonly r: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Both star depths over the view for a camera at world `camera` at `seconds`: each star's
 * brightness times its twinkle, which holds at the rules' reduced motion value when asked.
 */
export function viewStars(
  rules: BackdropRules,
  galaxy: GalaxyBackdrop,
  camera: Xy,
  seconds: number,
  reducedMotion: boolean,
): ViewStar[] {
  const { brightness, chunk, large, salt, twinkle } = rules.stars;
  const { seed } = galaxy;
  const out: ViewStar[] = [];
  for (const layer of rules.stars.layers) {
    const origin = layerOrigin(camera, layer.parallax);
    const reach = layer.radius * large.scale;
    const rect = viewRect(origin, VIEW, [VIEW_MARGIN + reach, VIEW_MARGIN + reach]);
    for (let i = Math.floor(rect[0] / chunk); i <= Math.floor(rect[2] / chunk); i++) {
      for (let j = Math.floor(rect[1] / chunk); j <= Math.floor(rect[3] / chunk); j++) {
        const id = `${i},${j}`;
        for (let k = 0; k < layer.perChunk; k++) {
          const name = `${salt}-${layer.name}-${k}`;
          const u = (i + unit(seed, id, `${name}-x`)) * chunk;
          const v = (j + unit(seed, id, `${name}-y`)) * chunk;
          if (u < rect[0] || u > rect[2] || v < rect[1] || v > rect[3]) {
            continue;
          }
          const shine =
            brightness[0] + (brightness[1] - brightness[0]) * unit(seed, id, `${name}-b`);
          const [x, y] = toView(origin, [u, v]);
          out.push({
            alpha:
              galaxy.stars.alpha[layer.name] *
              shine *
              twinkleAt(twinkle, seed, id, name, seconds, reducedMotion),
            r: layer.radius * (unit(seed, id, `${name}-l`) > 1 - large.share ? large.scale : 1),
            x,
            y,
          });
        }
      }
    }
  }
  return out;
}

/**
 * A star's twinkle at `seconds`: across the rules' range on a sine of period `period[0]` plus
 * up to `period[1] - period[0]` s (salt `-p`) from a phase (salt `-f`); its reduced motion value
 * when asked.
 */
export function twinkleAt(
  twinkle: BackdropRules["stars"]["twinkle"],
  seed: number,
  id: string,
  name: string,
  seconds: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) {
    return twinkle.reducedMotion;
  }
  const [low, high] = twinkle.range;
  const period =
    twinkle.period[0] + (twinkle.period[1] - twinkle.period[0]) * unit(seed, id, `${name}-p`);
  const phase = 2 * Math.PI * unit(seed, id, `${name}-f`);
  return low + (high - low) * (0.5 + 0.5 * Math.sin((2 * Math.PI * seconds) / period + phase));
}

/** A dust streak in the play view: its centre, angle in radians and length in logical px. */
export interface ViewStreak {
  readonly angle: number;
  readonly length: number;
  readonly x: number;
  readonly y: number;
}

/** The dust streaks that meet the view for a camera at world `camera`. */
export function viewStreaks(
  rules: BackdropRules,
  galaxy: GalaxyBackdrop,
  camera: Xy,
): ViewStreak[] {
  const rule = rules.streaks;
  const origin = layerOrigin(camera, rule.parallax);
  const reach = rule.length[1] / 2 + VIEW_MARGIN;
  return chunkItems(galaxy.seed, rule.salt, rule, viewRect(origin, VIEW, [reach, reach])).map(
    (item) => {
      const [x, y] = toView(origin, [item.x, item.y]);
      return {
        angle:
          ((galaxy.streaks.angle +
            (unit(galaxy.seed, item.id, "streak-angle") - 0.5) * rule.spread) *
            Math.PI) /
          180,
        length:
          rule.length[0] +
          (rule.length[1] - rule.length[0]) * unit(galaxy.seed, item.id, "streak-length"),
        x,
        y,
      };
    },
  );
}

/** A streak's run in `count` pieces, each with its share of the half-sine fade at its middle. */
export function streakPieces(
  streak: ViewStreak,
  count: number,
): { readonly fade: number; readonly from: Xy; readonly to: Xy }[] {
  const [dx, dy] = [Math.cos(streak.angle), Math.sin(streak.angle)];
  const at = (t: number): Xy => [
    streak.x + dx * (t - 0.5) * streak.length,
    streak.y + dy * (t - 0.5) * streak.length,
  ];
  return Array.from({ length: count }, (_, k) => ({
    fade: Math.sin((Math.PI * (k + 0.5)) / count),
    from: at(k / count),
    to: at((k + 1) / count),
  }));
}

/** A straight-alpha RGBA raster, `width` by `height` texels, for a canvas texture. */
export interface Raster {
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly height: number;
  readonly width: number;
}

/** Premultiplied float layers composited with `over`, written out as a straight-alpha raster. */
class Paint {
  readonly height: number;
  readonly width: number;
  private readonly values: Float32Array;

  constructor(width: number, height: number) {
    this.height = height;
    this.width = width;
    this.values = new Float32Array(width * height * 4);
  }

  /** Colour `c` at alpha `a` over texel `p`. */
  over(p: number, c: Rgb, a: number): void {
    const v = this.values;
    const q = p * 4;
    v[q] = c[0] * a + v[q]! * (1 - a);
    v[q + 1] = c[1] * a + v[q + 1]! * (1 - a);
    v[q + 2] = c[2] * a + v[q + 2]! * (1 - a);
    v[q + 3] = a + v[q + 3]! * (1 - a);
  }

  raster(): Raster {
    const data = new Uint8ClampedArray(this.width * this.height * 4);
    for (let p = 0; p < this.width * this.height; p++) {
      const a = this.values[p * 4 + 3]!;
      if (a <= 0) {
        continue;
      }
      for (let k = 0; k < 3; k++) {
        data[p * 4 + k] = Math.round((this.values[p * 4 + k]! / a) * 255);
      }
      data[p * 4 + 3] = Math.round(a * 255);
    }
    return { data, height: this.height, width: this.width };
  }
}

/** The view and its margin, in logical px from the view's top-left. */
export const SKY_AREA = {
  height: SCREEN.height + 2 * VIEW_MARGIN,
  width: SCREEN.width + 2 * VIEW_MARGIN,
  x: -VIEW_MARGIN,
  y: -VIEW_MARGIN,
} as const;

/** The sky over SKY_AREA at `scale` texels per logical px; a smooth ramp, so linear filtering fills in. */
export function paintSky(sky: GalaxyBackdrop["sky"], scale: number): Raster {
  const width = Math.ceil(SKY_AREA.width * scale);
  const height = Math.ceil(SKY_AREA.height * scale);
  const paint = new Paint(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      paint.over(
        y * width + x,
        skyColor(sky, SKY_AREA.x + (x + 0.5) / scale, SKY_AREA.y + (y + 0.5) / scale),
        1,
      );
    }
  }
  return paint.raster();
}

// One facet of an n-sided shadow edge: the polygon's radius at `angle` over its circumradius.
const facet = (angle: number, n: number) => {
  const wedge = (2 * Math.PI) / n;
  return Math.cos(Math.PI / n) / Math.cos((((angle % wedge) + wedge) % wedge) - Math.PI / n);
};

/** The logical px a planet's raster spans from its centre: its ring's reach. */
export const planetReach = (r: number): number => r * PLANET_EXTENT;

/**
 * A planet centred in a raster planetReach(r) logical px from its centre on each side, at
 * `scale` texels per logical px: the night disc, the body and lit sides outside their faceted
 * shadow discs, and a ringed planet's ring behind and in front (art/backdrop.md, Planets).
 */
export function paintPlanet(rules: BackdropRules, planet: ViewPlanet, scale: number): Raster {
  const rule = rules.planets;
  const { r, recipe } = planet;
  const reach = planetReach(r);
  const size = Math.ceil(2 * reach * scale);
  const paint = new Paint(size, size);
  const colors = {
    body: rgb(recipe.colors.body),
    lit: rgb(recipe.colors.lit),
    night: rgb(recipe.colors.night),
    ring: rgb(recipe.colors.ring),
  };
  const [lx, ly] = rule.light;
  const push = recipe.look === "crescent" ? rule.push.crescent : rule.push.gibbous;
  const ringed = recipe.look === "ringed";
  const litAlpha = recipe.look === "moon" ? rule.moonLitAlpha : 1;
  const tilt = (planet.tilt * Math.PI) / 180;
  const [ca, sa] = [Math.cos(tilt), Math.sin(tilt)];
  const centre = size / 2 / scale;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [dx, dy] = [(x + 0.5) / scale - centre, (y + 0.5) / scale - centre];
      const p = y * size + x;
      let ringAlpha = 0;
      let front = false;
      if (ringed) {
        const ru = dx * ca + dy * sa;
        const rv = -dx * sa + dy * ca;
        const e = Math.hypot(ru / (r * rule.ring.radii[0]), rv / (r * rule.ring.radii[1]));
        for (const band of rule.ring.bands) {
          if (e > band.from && e < band.to) {
            ringAlpha = band.alpha;
          }
        }
        front = rv >= 0;
        if (!front && ringAlpha > 0) {
          paint.over(p, colors.ring, ringAlpha);
        }
      }
      if (Math.hypot(dx, dy) <= r) {
        paint.over(p, colors.night, 1);
        const [s1x, s1y] = [dx + lx * r * push, dy + ly * r * push];
        if (Math.hypot(s1x, s1y) / facet(Math.atan2(s1y, s1x), rule.facets) > r) {
          paint.over(p, colors.body, 1);
        }
        const [s2x, s2y] = [dx + lx * r * push * rule.lit.push, dy + ly * r * push * rule.lit.push];
        if (Math.hypot(s2x, s2y) / facet(Math.atan2(s2y, s2x), rule.facets) > r * rule.lit.inset) {
          paint.over(p, colors.lit, litAlpha);
        }
      }
      if (ringed && front && ringAlpha > 0) {
        paint.over(p, colors.ring, ringAlpha);
      }
    }
  }
  return paint.raster();
}

/** The logical px a cluster's raster spans from its centre, across and down. */
export function clusterReach(rules: BackdropRules): Xy {
  const { sigma } = rules.cluster.glow;
  return [sigma[0] * GLOW_REACH, sigma[1] * GLOW_REACH];
}

/** Coverage of a disc over one texel, from 4 by 4 samples. */
function coverage(x: number, y: number, cx: number, cy: number, r: number): number {
  let hits = 0;
  for (let s = 0; s < 16; s++) {
    if (Math.hypot(x + ((s % 4) + 0.5) / 4 - cx, y + (Math.floor(s / 4) + 0.5) / 4 - cy) <= r) {
      hits++;
    }
  }
  return hits / 16;
}

/** Antialiased disc of radius `r` texels centred at (cx, cy) in `paint`. */
function paintDiscAt(paint: Paint, cx: number, cy: number, r: number, c: Rgb, a: number): void {
  for (
    let y = Math.max(0, Math.floor(cy - r));
    y <= Math.min(paint.height - 1, Math.ceil(cy + r));
    y++
  ) {
    for (
      let x = Math.max(0, Math.floor(cx - r));
      x <= Math.min(paint.width - 1, Math.ceil(cx + r));
      x++
    ) {
      const share = coverage(x, y, cx, cy, r);
      if (share > 0) {
        paint.over(y * paint.width + x, c, a * share);
      }
    }
  }
}

/**
 * A star cluster centred in a raster clusterReach logical px from its centre, at `scale` texels
 * per logical px: its Gaussian glow, then its stars, normally spread from the salts of its cell
 * (art/backdrop.md, Far items).
 */
export function paintCluster(
  rules: BackdropRules,
  seed: number,
  item: Pick<ViewFar, "id">,
  recipe: Extract<FarRecipe, { look: "cluster" }>,
  scale: number,
): Raster {
  const { glow, stars } = rules.cluster;
  const [rx, ry] = clusterReach(rules);
  const width = Math.ceil(2 * rx * scale);
  const height = Math.ceil(2 * ry * scale);
  const paint = new Paint(width, height);
  const [cx, cy] = [width / 2 / scale, height / 2 / scale];
  const glowColor = rgb(recipe.colors.glow);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const g = Math.exp(
        -(
          (((x + 0.5) / scale - cx) / glow.sigma[0]) ** 2 +
          (((y + 0.5) / scale - cy) / glow.sigma[1]) ** 2
        ),
      );
      if (g > 1e-3) {
        paint.over(y * width + x, glowColor, g * glow.alpha);
      }
    }
  }
  const starColor = rgb(recipe.colors.star);
  for (let k = 0; k < stars.count; k++) {
    const name = `cluster-${k}`;
    // Box-Muller: a radius from one salt (1 - u keeps it finite) and an angle from another.
    const radius = Math.sqrt(-2 * Math.log(1 - unit(seed, item.id, `${name}-r`)));
    const angle = 2 * Math.PI * unit(seed, item.id, `${name}-a`);
    const x = cx + radius * Math.cos(angle) * stars.spread[0];
    const y = cy + radius * Math.sin(angle) * stars.spread[1];
    const r =
      unit(seed, item.id, `${name}-l`) < stars.largeShare ? stars.radius[1] : stars.radius[0];
    const alpha = recipe.alpha * (0.5 + 0.5 * unit(seed, item.id, `${name}-b`));
    paintDiscAt(paint, x * scale, y * scale, r * scale, starColor, alpha);
  }
  return paint.raster();
}

/**
 * A white antialiased disc of radius `r` logical px at `scale` texels per logical px, centred in
 * a raster with a texel of clear edge, for tinted stars that move smoothly at sub-pixel steps.
 */
export function paintDisc(r: number, scale: number): Raster {
  const size = Math.ceil(2 * r * scale) + 2;
  const paint = new Paint(size, size);
  paintDiscAt(paint, size / 2, size / 2, r * scale, [1, 1, 1], 1);
  return paint.raster();
}
