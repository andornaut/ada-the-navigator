import { SCREEN } from "../data/screen.ts";
import { type BackdropRockRule, unit } from "./asteroidArt.ts";
import {
  checkerItems,
  chunkItems,
  evenCell,
  layerOrigin,
  type MotifLattice,
  motifPlates,
  viewRect,
  type Xy,
} from "./backdropField.ts";
import { type DecorationLayer, readDecorations } from "./rareDecorations.ts";

// The layered backdrop (art/backdrop.md): Art's shared rules (backdrop-lattice.json) and each
// galaxy's tones and recipes ({galaxy}/backdrop-lattice.json), placed in the play view for a
// camera, and the rasters the scene bakes into textures. A layer point (u, v) draws at
// (u, v) - origin plus the view's centre, the origin being the camera's projected world position
// times the parallax.

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

/** backdrop-lattice.json, version 2: the rules every galaxy shares. */
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
    /** A planet draws only in the chunks whose i + j is even. */
    readonly checker: boolean;
    readonly light: Xy;
    /**
     * The lit disc: `radius` times the planet's, its centre `push` radii toward the light by
     * look, clipped to the planet.
     */
    readonly lit: {
      readonly push: { readonly crescent: number; readonly gibbous: number };
      readonly radius: number;
    };
    readonly radius: Xy;
    /** One opaque band from `band.from` to `band.to` of the ellipse `radii`, tilted `tilt`. */
    readonly ring: {
      readonly band: { readonly from: number; readonly to: number };
      readonly radii: Xy;
      readonly tilt: number;
    };
  };
  /** The far backdrop rock depth, under the specks and rocks. */
  readonly farRocks: BackdropRockRule;
  readonly plates: MotifLattice & { readonly parallax: number };
  readonly rocks: BackdropRockRule;
  /** Dust specks: one per `cell` layer px at `alpha`. */
  readonly specks: { readonly alpha: number; readonly cell: number; readonly parallax: number };
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
  /** One streak at the centre of every `cell` layer px cell whose i + j is even. */
  readonly streaks: {
    readonly cell: number;
    readonly length: number;
    readonly parallax: number;
    readonly width: number;
  };
}

export type PlanetLook = "crescent" | "gibbous" | "moon" | "ringed";

export interface PlanetRecipe {
  readonly colors: {
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

export type Step = -2 | -1 | 1 | 2;

export interface PlateStep {
  readonly multiply?: number;
  readonly screen?: string;
  readonly step: Step;
}

/** {galaxy}/backdrop-lattice.json, version 2: one galaxy's tones and recipes. */
export interface GalaxyBackdrop {
  /** The field background the tones derive from and muted rocks move toward. */
  readonly background: string;
  readonly decorations?: DecorationLayer;
  readonly far: readonly FarRecipe[];
  /** The manifest links of the fixed L2 layers: backdropHaze, needleBand. */
  readonly fixed: readonly string[];
  readonly galaxy: string;
  readonly planets: readonly PlanetRecipe[];
  readonly plates: {
    /** The galaxy's motif about its node, in layer px: an edge ring, then any hole rings. */
    readonly motif: { readonly name: string; readonly rings: readonly (readonly Xy[])[] };
    /** The paints of the nodes whose i + j is even, then odd. */
    readonly steps: readonly [PlateStep, PlateStep];
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

const flag = (value: unknown): value is boolean => typeof value === "boolean";
const integer = (value: unknown): value is number => Number.isInteger(value);

function readRockRule(value: unknown): BackdropRockRule {
  const data = fields(value);
  return {
    cell: must(positive, data.cell),
    chance: must(fraction, data.chance),
    checker: must(flag, data.checker),
    parallax: must(fraction, data.parallax),
    salt: must((entry) => typeof entry === "string", data.salt),
    scale: must((entry) => pair(entry, positive), data.scale),
    value: must(fraction, data.value),
  };
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

/** Art's shared backdrop rules, version 2; undefined if any part is missing or malformed. */
export function readBackdropRules(value: unknown): BackdropRules | undefined {
  const data = fields(value);
  if (data.version !== 2) {
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
    const specks = fields(debris.specks);
    const lit = fields(planets.lit);
    const empty = fields(plateData.empty);
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
      farRocks: readRockRule(debris.farRocks),
      nebula: { display: must((entry) => pair(entry, positive), fields(phenomena.nebula).display) },
      planets: {
        ...readChunkLayer(planets),
        checker: must(flag, planets.checker),
        light: must(pair, planets.light),
        lit: {
          push: {
            crescent: must(finite, fields(lit.push).crescent),
            gibbous: must(finite, fields(lit.push).gibbous),
          },
          radius: must(positive, lit.radius),
        },
        radius: must((entry) => pair(entry, positive), planets.radius),
        ring: {
          band: {
            from: must(positive, fields(ring.band).from),
            to: must(positive, fields(ring.band).to),
          },
          radii: must((entry) => pair(entry, positive), ring.radii),
          tilt: must(finite, ring.tilt),
        },
      },
      plates: {
        empty: {
          i: must(integer, empty.i),
          j: must(integer, empty.j),
          modulus: must((entry): entry is number => integer(entry) && entry > 0, empty.modulus),
        },
        lattice: must(
          (entry): entry is [Xy, Xy] =>
            Array.isArray(entry) && entry.length === 2 && entry.every((node) => pair(node)),
          plateData.lattice,
        ),
        parallax: must(fraction, plateData.parallax),
      },
      rocks: readRockRule(debris.rocks),
      specks: {
        alpha: must(fraction, specks.alpha),
        cell: must(positive, specks.cell),
        parallax: must(fraction, specks.parallax),
      },
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
        cell: must(positive, streaks.cell),
        length: must(positive, streaks.length),
        parallax: must(fraction, streaks.parallax),
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

/** A closed ring of at least three layer px points. */
const closedRing = (entry: unknown): entry is Xy[] =>
  Array.isArray(entry) && entry.length >= 3 && entry.every((point) => pair(point));

/** A galaxy's backdrop, version 2; undefined if any part is missing or malformed. */
export function readGalaxyBackdrop(value: unknown): GalaxyBackdrop | undefined {
  const data = fields(value);
  if (data.version !== 2) {
    return undefined;
  }
  try {
    const sky = fields(data.sky);
    const plateData = fields(data.plates);
    const motif = fields(plateData.motif);
    const stars = fields(data.stars);
    const streaks = fields(data.streaks);
    const list = (entry: unknown): entry is unknown[] => Array.isArray(entry);
    const decorations = readDecorations(data.decorations);
    return {
      background: must(hex, data.background),
      ...(decorations ? { decorations } : {}),
      far: must(list, data.far).map(readFar),
      fixed: must(list, data.fixed).map((link) =>
        must((name): name is string => typeof name === "string", link),
      ),
      galaxy: must((id): id is string => typeof id === "string", data.galaxy),
      planets: must(list, data.planets).map(readPlanet),
      plates: {
        motif: {
          name: must((name): name is string => typeof name === "string", motif.name),
          rings: must(
            (entry): entry is Xy[][] =>
              Array.isArray(entry) && entry.length > 0 && entry.every(closedRing),
            motif.rings,
          ),
        },
        steps: must(
          (entry): entry is [unknown, unknown] => list(entry) && entry.length === 2,
          plateData.steps,
        ).map(readStep) as unknown as readonly [PlateStep, PlateStep],
      },
      seed: must(finite, data.seed),
      sky: {
        flip: must(flag, sky.flip),
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
  return interpolateSky(sky, rgb(sky.from), rgb(sky.to), x, y);
}

function interpolateSky(sky: GalaxyBackdrop["sky"], from: Rgb, to: Rgb, x: number, y: number): Rgb {
  const fx = sky.flip ? 1 - x / VIEW[0] : x / VIEW[0];
  let t = Math.min(
    1,
    Math.max(0, fx * sky.weights[0] + (y / VIEW[1]) * sky.weights[1] + sky.offset),
  );
  t = t * t * (3 - 2 * t);
  return [0, 1, 2].map((k) => from[k]! * (1 - t) + to[k]! * t) as unknown as Rgb;
}

/** A layer point in the play view, in logical px. */
const toView = (origin: Xy, [u, v]: Xy): Xy => [
  u - origin[0] + CENTRE[0],
  v - origin[1] + CENTRE[1],
];

/**
 * A view plate: its motif's rings in the play view, filled even-odd, and its step's grey
 * multiply or screen colour.
 */
export interface ViewPlate {
  readonly multiply?: number;
  readonly rings: readonly (readonly Xy[])[];
  readonly screen?: string;
}

/** How far each motif reaches from its node along either axis, in layer px. */
const motifReach = new WeakMap<GalaxyBackdrop["plates"]["motif"], number>();

/**
 * The motif plates over the view (and its margin) for a camera at world `camera`: the even
 * nodes in the galaxy's first step and the odd ones in its second.
 */
export function viewPlates(rules: BackdropRules, galaxy: GalaxyBackdrop, camera: Xy): ViewPlate[] {
  const origin = layerOrigin(camera, rules.plates.parallax);
  const { motif, steps } = galaxy.plates;
  let reach = motifReach.get(motif);
  if (reach === undefined) {
    reach = Math.max(...motif.rings.flat().map(([u, v]) => Math.max(Math.abs(u), Math.abs(v))));
    motifReach.set(motif, reach);
  }
  return motifPlates(rules.plates, motif.rings, viewRect(origin, VIEW, EDGE), reach).map(
    ({ even, rings }) => {
      const { multiply, screen } = steps[even ? 0 : 1];
      return {
        ...(multiply === undefined ? {} : { multiply }),
        rings: rings.map((points) => points.map((point) => toView(origin, point))),
        ...(screen === undefined ? {} : { screen }),
      };
    },
  );
}

/** A planet in the play view: its chunk's id, recipe, radius and centre. */
export interface ViewPlanet {
  readonly id: string;
  readonly recipe: PlanetRecipe;
  readonly r: number;
  readonly x: number;
  readonly y: number;
}

/** A planet's extent from its centre in units of its radius: the ring's 2 r and its edge. */
const PLANET_EXTENT = 2.15;

/** Whether an item at view point (x, y) reaching `rx` by `ry` from it meets the view's margin. */
const meetsView = (x: number, y: number, rx: number, ry: number): boolean =>
  x + rx > -VIEW_MARGIN &&
  x - rx < VIEW[0] + VIEW_MARGIN &&
  y + ry > -VIEW_MARGIN &&
  y - ry < VIEW[1] + VIEW_MARGIN;

/** The planets that meet the view for a camera at world `camera`, on the chunk checker. */
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
  // The chunk lookup reaches the largest planet's extent; each planet stays only when its own
  // extent meets the view, so no off-screen planet is baked.
  return chunkItems(
    galaxy.seed,
    rule.salt,
    rule,
    viewRect(origin, VIEW, [largest, largest]),
  ).flatMap((item) => {
    if (rule.checker && !evenCell(item.i, item.j)) {
      return [];
    }
    const recipe = planets[Math.floor(unit(galaxy.seed, item.id, "planet-look") * planets.length)]!;
    const [x, y] = toView(origin, [item.x, item.y]);
    const r =
      (rule.radius[0] +
        (rule.radius[1] - rule.radius[0]) * unit(galaxy.seed, item.id, "planet-r")) *
      recipe.size;
    // Only a ringed planet draws past its disc.
    const reach = recipe.look === "ringed" ? r * PLANET_EXTENT : r;
    if (!meetsView(x, y, reach, reach)) {
      return [];
    }
    return [{ id: item.id, r, recipe, x, y }];
  });
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
  const nebula: Xy = [rules.nebula.display[0] / 2, rules.nebula.display[1] / 2];
  const cluster = clusterReach(rules);
  const reach: Xy = [Math.max(nebula[0], cluster[0]), Math.max(nebula[1], cluster[1])];
  // The chunk lookup reaches the wider look; each item stays only when its own look's extent
  // meets the view, so no off-screen cluster is baked.
  return chunkItems(galaxy.seed, rule.salt, rule, viewRect(origin, VIEW, reach)).flatMap((item) => {
    const [x, y] = toView(origin, [item.x, item.y]);
    const recipe = far[Math.floor(unit(galaxy.seed, item.id, "far-look") * far.length)]!;
    const [rx, ry] = recipe.look === "nebula" ? nebula : cluster;
    if (!meetsView(x, y, rx, ry)) {
      return [];
    }
    return [
      {
        id: item.id,
        recipe,
        variant: Math.floor(unit(galaxy.seed, item.id, "far-variant") * 2),
        x,
        y,
      },
    ];
  });
}

/** A star in the play view: its centre, radius in logical px and alpha with the twinkle. */
export interface ViewStar {
  readonly alpha: number;
  readonly r: number;
  readonly x: number;
  readonly y: number;
}

interface SeededStar {
  readonly u: number;
  readonly v: number;
  readonly shine: number;
  readonly r: number;
  readonly period: number;
  readonly phase: number;
}

// Immutable recipes use identity keys; only chunks meeting the current view remain resident.
const starChunks = new WeakMap<
  BackdropRules,
  WeakMap<GalaxyBackdrop, Map<string, readonly SeededStar[]>>
>();

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
  let galaxies = starChunks.get(rules);
  if (!galaxies) {
    galaxies = new WeakMap();
    starChunks.set(rules, galaxies);
  }
  let chunks = galaxies.get(galaxy);
  if (!chunks) {
    chunks = new Map();
    galaxies.set(galaxy, chunks);
  }
  const used = new Set<string>();
  const out: ViewStar[] = [];
  for (const layer of rules.stars.layers) {
    const origin = layerOrigin(camera, layer.parallax);
    const reach = layer.radius * large.scale;
    const rect = viewRect(origin, VIEW, [VIEW_MARGIN + reach, VIEW_MARGIN + reach]);
    for (let i = Math.floor(rect[0] / chunk); i <= Math.floor(rect[2] / chunk); i++) {
      for (let j = Math.floor(rect[1] / chunk); j <= Math.floor(rect[3] / chunk); j++) {
        const id = `${i},${j}`;
        const key = `${layer.name}:${id}`;
        used.add(key);
        let stars = chunks.get(key);
        if (!stars) {
          stars = Array.from({ length: layer.perChunk }, (_, k) => {
            const name = `${salt}-${layer.name}-${k}`;
            return {
              period:
                twinkle.period[0] +
                (twinkle.period[1] - twinkle.period[0]) * unit(seed, id, `${name}-p`),
              phase: 2 * Math.PI * unit(seed, id, `${name}-f`),
              r: layer.radius * (unit(seed, id, `${name}-l`) > 1 - large.share ? large.scale : 1),
              shine: brightness[0] + (brightness[1] - brightness[0]) * unit(seed, id, `${name}-b`),
              u: (i + unit(seed, id, `${name}-x`)) * chunk,
              v: (j + unit(seed, id, `${name}-y`)) * chunk,
            };
          });
          chunks.set(key, stars);
        }
        for (const star of stars) {
          if (star.u < rect[0] || star.u > rect[2] || star.v < rect[1] || star.v > rect[3]) {
            continue;
          }
          const [low, high] = twinkle.range;
          const pulse = reducedMotion
            ? twinkle.reducedMotion
            : low +
              (high - low) *
                (0.5 + 0.5 * Math.sin((2 * Math.PI * seconds) / star.period + star.phase));
          const [x, y] = toView(origin, [star.u, star.v]);
          out.push({
            alpha: galaxy.stars.alpha[layer.name] * star.shine * pulse,
            r: star.r,
            x,
            y,
          });
        }
      }
    }
  }
  for (const key of chunks.keys()) {
    if (!used.has(key)) {
      chunks.delete(key);
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

/**
 * The dust streaks that meet the view for a camera at world `camera`: one at the centre of each
 * even checker cell, all one length at the galaxy's angle.
 */
export function viewStreaks(
  rules: BackdropRules,
  galaxy: GalaxyBackdrop,
  camera: Xy,
): ViewStreak[] {
  const rule = rules.streaks;
  const origin = layerOrigin(camera, rule.parallax);
  const reach = rule.length / 2 + VIEW_MARGIN;
  const angle = (galaxy.streaks.angle * Math.PI) / 180;
  return checkerItems(rule.cell, viewRect(origin, VIEW, [reach, reach])).map((item) => {
    const [x, y] = toView(origin, [item.x, item.y]);
    return { angle, length: rule.length, x, y };
  });
}

/** A streak's two ends in the play view. */
export function streakEnds(streak: ViewStreak): readonly [Xy, Xy] {
  const dx = (Math.cos(streak.angle) * streak.length) / 2;
  const dy = (Math.sin(streak.angle) * streak.length) / 2;
  return [
    [streak.x - dx, streak.y - dy],
    [streak.x + dx, streak.y + dy],
  ];
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
  const from = rgb(sky.from);
  const to = rgb(sky.to);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      paint.over(
        y * width + x,
        interpolateSky(
          sky,
          from,
          to,
          SKY_AREA.x + (x + 0.5) / scale,
          SKY_AREA.y + (y + 0.5) / scale,
        ),
        1,
      );
    }
  }
  return paint.raster();
}

/** The logical px a planet's raster spans from its centre: its ring's reach. */
export const planetReach = (r: number): number => r * PLANET_EXTENT;

/**
 * A planet centred in a raster planetReach(r) logical px from its centre on each side, at
 * `scale` texels per logical px: a ringed planet's far ring half, the night disc with its lit
 * disc toward the light clipped to it, then the ring's near half (art/backdrop.md, Motif field).
 */
export function paintPlanet(rules: BackdropRules, planet: ViewPlanet, scale: number): Raster {
  const { light, lit, ring } = rules.planets;
  const { r, recipe } = planet;
  const size = Math.ceil(2 * planetReach(r) * scale);
  const paint = new Paint(size, size);
  const colors = {
    lit: rgb(recipe.colors.lit),
    night: rgb(recipe.colors.night),
    ring: rgb(recipe.colors.ring),
  };
  const push = (recipe.look === "crescent" ? lit.push.crescent : lit.push.gibbous) * r;
  const [litX, litY] = [light[0] * push, light[1] * push];
  const ringed = recipe.look === "ringed";
  const tilt = (ring.tilt * Math.PI) / 180;
  const [ca, sa] = [Math.cos(tilt), Math.sin(tilt)];
  const centre = size / 2 / scale;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [dx, dy] = [(x + 0.5) / scale - centre, (y + 0.5) / scale - centre];
      const p = y * size + x;
      let onRing = false;
      let front = false;
      if (ringed) {
        const ru = dx * ca + dy * sa;
        const rv = -dx * sa + dy * ca;
        const e = Math.hypot(ru / (r * ring.radii[0]), rv / (r * ring.radii[1]));
        onRing = e > ring.band.from && e < ring.band.to;
        front = rv >= 0;
      }
      if (onRing && !front) {
        paint.over(p, colors.ring, 1);
      }
      if (Math.hypot(dx, dy) <= r) {
        paint.over(p, colors.night, 1);
        if (Math.hypot(dx - litX, dy - litY) <= r * lit.radius) {
          paint.over(p, colors.lit, 1);
        }
      }
      if (onRing && front) {
        paint.over(p, colors.ring, 1);
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
