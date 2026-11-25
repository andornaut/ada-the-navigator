import { fromScreen } from "../model/convex.ts";
import type { Vec } from "../model/types.ts";
import {
  type BeamBands,
  type EdgedShapes,
  type EffectShape,
  type FanBand,
  fanBands,
  flatBeam,
  heldAlpha,
  type HeldFade,
  heldFade,
  IMPACT_STYLE,
  impactEffect,
  type LineShape,
  missileFlame,
  type PolygonShape,
  type RippleArt,
  screenAngle,
  SPARK_MS,
} from "./weaponEffects.ts";

// Art's enemy shots, enemy-only weapon effects and the enemy Phaser (art/weapons.md "Enemy
// shots", "Enemy Phaser" and "Enemy-only weapons") from public/art/enemy-weapons.json, as
// screen-space shapes in logical px for the scene to fill and stroke. Each builder returns the
// shapes and the subset that draws over the field edge on a light field or Phantom.

/** What a weapon effect draws and which of those shapes take the field edge. */
export type EnemyEffect = EdgedShapes;

const NONE: EnemyEffect = { edged: [], shapes: [] };

type Colours = Readonly<
  Record<"coralSide" | "ink" | "obstacle" | "plate" | "weapon" | "white", number>
>;

/** (u, v) points in logical px: u along the heading, v across it. */
type Points = readonly (readonly [number, number])[];

/**
 * A beam's timing, its opaque bands (width at the nose and at the end, in px times `w`) and
 * bloom discs, and its reduced-motion bands: at `widthFactor`, with or without bloom, alpha 1
 * to `holdMs`, then the held fade.
 */
interface BeamArt extends BeamBands {
  readonly keys: readonly (readonly [number, number, number])[];
  readonly ms: number;
  readonly reducedMotion: {
    readonly bloom: boolean;
    readonly holdMs: number;
    readonly widthFactor: number;
  };
  readonly spark: { readonly ms: number };
}

/** A shape of a body over an inner shape and, for darts and bolts, a tail behind it. */
interface Dart {
  readonly inner: Points;
  readonly innerColour: number;
  readonly outer: Points;
  readonly outerColour: number;
}

/** Art's enemy-weapons.json, version 1, with colours as numbers. */
export interface EnemyWeaponsArt {
  /** The enemy bolt: body and core over a tail wedge, the head at the shot's point. */
  readonly bolt: Dart & { readonly tail: { readonly colour: number; readonly points: Points } };
  readonly colours: Colours;
  /** The held fade every enemy linear fade takes. */
  readonly fade: HeldFade;
  /** The enemy Multi-Laser: its near band and its far darts. */
  readonly fan: {
    readonly far: { readonly colour: number; readonly points: Points };
    readonly near: FanBand & { readonly colour: number; readonly innerColour: number };
  };
  readonly lance: BeamArt & {
    readonly charge: { radius: readonly [number, number]; core: readonly [number, number] };
    readonly locked: {
      readonly halo: { alpha: number; colour: number; radius: number };
      readonly pulses: readonly (readonly [number, number])[];
      readonly width: number;
    };
    readonly lockMs: number;
    readonly trackMs: number;
    readonly tracking: { dash: readonly [number, number]; march: number; width: number };
  };
  readonly lightField: { readonly dash: readonly [number, number]; readonly edge: number };
  /** Enemy missiles: their frames' projectile names and their flame colours. */
  readonly missiles: {
    readonly flame: { readonly colour: number; readonly innerColour: number };
    readonly heavy: string;
    readonly rapid: string;
  };
  readonly mine: {
    readonly blink: readonly { aboveRemainingMs: number; onMs: number; periodMs: number }[];
    readonly fizzleMs: number;
    readonly hint: { ms: number; radius: number; startDeg: number; stroke: number };
    /** The pop's shape parts that take an ink edge on a light field. */
    readonly popEdged: readonly string[];
    readonly reducedFizzleMs: number;
    readonly reducedPopMs: number;
    /** Degrees a second, and degrees per frame of the mine's spin. */
    readonly spin: { readonly degPerSecond: number; readonly stepDeg: number };
  };
  readonly phaser: BeamArt & {
    readonly aimMs: number;
    readonly aiming: { dash: readonly [number, number]; width: number };
    readonly charge: { core: readonly [number, number]; radius: readonly [number, number] };
    /** The aim's end chevron, u measured from the aim's end. */
    readonly chevron: Points;
    readonly missFade: number;
    readonly solidFromMs: number;
    readonly solidWidth: number;
  };
  /** The enemy Scattershot pellet: a diamond over its core. */
  readonly pellet: Dart;
  readonly ringBurst: {
    readonly dart: Dart & { readonly tail: { readonly colour: number; readonly points: Points } };
    /** The emission ring: alpha held to each step's end in ms. */
    readonly emission: { alpha: Points; ms: number; stroke: number };
    readonly muzzle: {
      readonly core: { radius: readonly [number, number]; untilMs: number };
      readonly ms: number;
      readonly radius: readonly [number, number];
    };
  };
  readonly ripple: RippleArt;
}

type Fields = Record<string, unknown>;

/** Thrown inside the reader when a field is missing or malformed; the reader returns undefined. */
class Malformed extends Error {}

function at(value: unknown, path: string): unknown {
  let node: unknown = value;
  for (const key of path ? path.split(".") : []) {
    node = node && typeof node === "object" ? (node as Fields)[key] : undefined;
  }
  return node;
}

function num(value: unknown, path: string): number {
  const found = at(value, path);
  if (typeof found !== "number" || !Number.isFinite(found)) {
    throw new Malformed(path);
  }
  return found;
}

function pair(value: unknown, path: string): readonly [number, number] {
  const found = at(value, path);
  if (
    !Array.isArray(found) ||
    found.length !== 2 ||
    !found.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  ) {
    throw new Malformed(path);
  }
  return [found[0] as number, found[1] as number];
}

function list<T>(value: unknown, path: string, read: (entry: unknown) => T): T[] {
  const found = at(value, path);
  if (!Array.isArray(found) || found.length === 0) {
    throw new Malformed(path);
  }
  return found.map(read);
}

function bool(value: unknown, path: string): boolean {
  const found = at(value, path);
  if (typeof found !== "boolean") {
    throw new Malformed(path);
  }
  return found;
}

function text(value: unknown, path: string): string {
  const found = at(value, path);
  if (typeof found !== "string" || found.length === 0) {
    throw new Malformed(path);
  }
  return found;
}

function points(value: unknown, path: string): Points {
  return list(value, path, (entry) => pair(entry, ""));
}

const HEX = /^#[0-9a-f]{6}$/iu;

/**
 * Validate Art's enemy-weapons.json: version 1, every colour key a hex colour, and every timing,
 * size and colour reference the effects draw. Undefined when anything is missing.
 */
export function readEnemyWeaponsArt(value: unknown): EnemyWeaponsArt | undefined {
  try {
    if (at(value, "version") !== 1) {
      return undefined;
    }
    const names = ["coralSide", "ink", "obstacle", "plate", "weapon", "white"] as const;
    const colours = Object.fromEntries(
      names.map((name) => {
        const hex = at(value, `colours.${name}`);
        if (typeof hex !== "string" || !HEX.test(hex)) {
          throw new Malformed(name);
        }
        return [name, Number.parseInt(hex.slice(1), 16)];
      }),
    ) as unknown as Colours;
    const colour = (root: unknown, path: string): number => {
      const name = at(root, path);
      if (typeof name !== "string" || !(name in colours)) {
        throw new Malformed(path);
      }
      return colours[name as keyof Colours];
    };
    const beam = (root: string): BeamArt => {
      const art = at(value, root);
      return {
        bloom: list(art, "bloom", (entry) => ({
          colour: colour(entry, "colour"),
          radius: num(entry, "radius"),
        })),
        keys: list(art, "keys", (entry) => {
          if (!Array.isArray(entry) || entry.length !== 3 || !entry.every(Number.isFinite)) {
            throw new Malformed(`${root}.keys`);
          }
          return [entry[0], entry[1], entry[2]] as const;
        }),
        layers: list(art, "layers", (entry) => ({
          colour: colour(entry, "colour"),
          width: pair(entry, "width"),
        })),
        ms: num(art, "flashMs"),
        reducedMotion: {
          bloom: bool(art, "reducedMotion.bloom"),
          holdMs: num(art, "reducedMotion.holdMs"),
          widthFactor: num(art, "reducedMotion.widthFactor"),
        },
        spark: { ms: num(art, "spark.ms") },
      };
    };
    const dart = (root: unknown): Dart => ({
      inner: points(root, "inner"),
      innerColour: colour(root, "innerColour"),
      outer: points(root, "outer"),
      outerColour: colour(root, "outerColour"),
    });
    const tail = (root: unknown) => ({
      colour: colour(root, "tail.colour"),
      points: points(root, "tail.points"),
    });
    const near = at(value, "fan.near");
    const fade = {
      last: num(value, "fade.last"),
      steps: points(value, "fade.steps"),
    };
    const mine = at(value, "mine");
    const ring = at(value, "ringBurst");
    const lance = at(value, "lance");
    const phaser = at(value, "phaser");
    return {
      bolt: { ...dart(at(value, "bolt")), tail: tail(at(value, "bolt")) },
      colours,
      fade,
      fan: {
        far: { colour: colour(value, "fan.far.colour"), points: points(value, "fan.far.points") },
        near: {
          colour: colour(near, "colour"),
          depth: num(near, "depth"),
          inner: { inset: num(near, "inner.inset"), offset: num(near, "inner.offset") },
          innerColour: colour(near, "innerColour"),
          minRadius: num(near, "minRadius"),
          notch: num(near, "notch"),
          spacing: num(near, "spacing"),
          widen: num(near, "widen"),
        },
      },
      lance: {
        ...beam("lance"),
        charge: { core: pair(lance, "charge.core"), radius: pair(lance, "charge.radius") },
        lockMs: num(lance, "lockMs"),
        locked: {
          halo: {
            alpha: num(lance, "locked.pulseHalo.alpha"),
            colour: colour(lance, "locked.pulseHalo.colour"),
            radius: num(lance, "locked.pulseHalo.radius"),
          },
          pulses: list(lance, "locked.pulses", (entry) => pair(entry, "")),
          width: num(lance, "locked.width"),
        },
        trackMs: num(lance, "trackMs"),
        tracking: {
          dash: pair(lance, "tracking.dash"),
          march: num(lance, "tracking.marchPxPerSecond"),
          width: num(lance, "tracking.width"),
        },
      },
      lightField: { dash: pair(value, "lightField.dash"), edge: num(value, "lightField.edge") },
      mine: {
        blink: list(mine, "blink", (entry) => ({
          aboveRemainingMs: num(entry, "aboveRemainingMs"),
          onMs: num(entry, "onMs"),
          periodMs: num(entry, "periodMs"),
        })),
        fizzleMs: num(mine, "fizzle.ms"),
        hint: {
          ms: num(mine, "hint.ms"),
          radius: num(mine, "hint.radius"),
          startDeg: num(mine, "hint.startDeg"),
          stroke: num(mine, "hint.stroke"),
        },
        popEdged: list(mine, "pop.edged", (entry) => {
          if (typeof entry !== "string") {
            throw new Malformed("mine.pop.edged");
          }
          return entry;
        }),
        reducedFizzleMs: num(mine, "reducedMotion.fizzleMs"),
        reducedPopMs: num(mine, "reducedMotion.pop.ms"),
        spin: { degPerSecond: num(mine, "spin.degPerSecond"), stepDeg: num(mine, "spin.stepDeg") },
      },
      missiles: {
        flame: {
          colour: colour(value, "missiles.flame.colour"),
          innerColour: colour(value, "missiles.flame.innerColour"),
        },
        heavy: text(value, "missiles.heavy"),
        rapid: text(value, "missiles.rapid"),
      },
      pellet: dart(at(value, "pellet")),
      phaser: {
        ...beam("phaser"),
        aimMs: num(phaser, "aimMs"),
        aiming: { dash: pair(phaser, "aiming.dash"), width: num(phaser, "aiming.width") },
        charge: { core: pair(phaser, "charge.core"), radius: pair(phaser, "charge.radius") },
        chevron: points(phaser, "chevron"),
        missFade: num(phaser, "missFade"),
        solidFromMs: num(phaser, "solidFromMs"),
        solidWidth: num(phaser, "solid.width"),
      },
      ringBurst: {
        dart: { ...dart(at(ring, "dart")), tail: tail(at(ring, "dart")) },
        emission: {
          alpha: points(ring, "emission.alpha"),
          ms: num(ring, "emission.ms"),
          stroke: num(ring, "emission.stroke"),
        },
        muzzle: {
          core: {
            radius: pair(ring, "muzzle.core.radius"),
            untilMs: num(ring, "muzzle.core.untilMs"),
          },
          ms: num(ring, "muzzle.ms"),
          radius: pair(ring, "muzzle.radius"),
        },
      },
      ripple: {
        colour: colour(value, "ripple.colour"),
        fade,
        reducedStroke: num(value, "ripple.reducedMotion.stroke"),
        stroke: pair(value, "ripple.stroke"),
      },
    };
  } catch (error) {
    if (error instanceof Malformed) {
      return undefined;
    }
    throw error;
  }
}

const lerp = (from: number, to: number, k: number) => from + (to - from) * k;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** A screen frame: u forward along `angle` from `origin`, v sideways. */
function frame(origin: Vec, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (u: number, v: number): Vec => ({
    x: origin.x + u * cos - v * sin,
    y: origin.y + u * sin + v * cos,
  });
}

/**
 * Dashes `on` px long and `off` px apart from `from` to `to`, the pattern shifted forward by
 * `offset` px so a positive offset marches the dashes outward.
 */
export function dashes(
  from: Vec,
  to: Vec,
  on: number,
  off: number,
  offset: number,
  stroke: Omit<LineShape, "from" | "kind" | "round" | "to">,
): LineShape[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length === 0) {
    return [];
  }
  const along = (u: number): Vec => ({
    x: from.x + ((to.x - from.x) * u) / length,
    y: from.y + ((to.y - from.y) * u) / length,
  });
  const period = on + off;
  const shift = ((offset % period) + period) % period;
  const segments: LineShape[] = [];
  for (let start = shift - period; start < length; start += period) {
    const a = Math.max(0, start);
    const b = Math.min(length, start + on);
    if (b > a) {
      segments.push({ ...stroke, from: along(a), kind: "line", round: false, to: along(b) });
    }
  }
  return segments;
}

/**
 * Ink edges for the enemy effects on a light field (art/weapons.md "Enemy-only conventions"): a
 * stroke over an ink stroke 2 `edge` px wider that runs `edge` px past each end, so a dashed
 * line's ink dashes are 2 `edge` px longer and start `edge` px earlier; a filled shape over its
 * silhouette grown by `edge`. Each edge takes its shape's alpha.
 */
export function enemyInkEdges(
  ink: number,
  edge: number,
  shapes: readonly EffectShape[],
): EffectShape[] {
  return shapes.flatMap((shape): EffectShape | EffectShape[] => {
    switch (shape.kind) {
      case "disc":
        return { ...shape, colour: ink, radius: shape.radius + edge };
      case "ellipse":
        return shape.stroke === undefined
          ? {
              ...shape,
              colour: ink,
              halfHeight: shape.halfHeight + edge,
              halfWidth: shape.halfWidth + edge,
            }
          : { ...shape, colour: ink, stroke: shape.stroke + 2 * edge };
      case "line": {
        const length = Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y) || 1;
        const ux = ((shape.to.x - shape.from.x) / length) * edge;
        const uy = ((shape.to.y - shape.from.y) / length) * edge;
        return {
          ...shape,
          colour: ink,
          from: { x: shape.from.x - ux, y: shape.from.y - uy },
          to: { x: shape.to.x + ux, y: shape.to.y + uy },
          width: shape.width + 2 * edge,
        };
      }
      case "polygon":
        // The silhouette grown by `edge`: the polygon under its sides stroked 2 `edge` wide.
        return [
          { ...shape, colour: ink },
          ...shape.points.map((from, index): EffectShape => ({
            alpha: shape.alpha,
            colour: ink,
            from,
            kind: "line",
            round: true,
            to: shape.points[(index + 1) % shape.points.length]!,
            width: 2 * edge,
          })),
        ];
      case "taper":
        return {
          ...shape,
          colour: ink,
          head: { ...shape.head, width: shape.head.width + 2 * edge },
          tail: { ...shape.tail, width: shape.tail.width + 2 * edge },
        };
      default:
        return shape;
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Shapes

/** A polygon of (u, v) `points` about `origin` turned to screen `angle`. */
function turned(
  origin: Vec,
  angle: number,
  colour: number,
  points: Points,
  alpha = 1,
): PolygonShape {
  const at = frame(origin, angle);
  return { alpha, colour, kind: "polygon", points: points.map(([u, v]) => at(u, v)) };
}

// ---------------------------------------------------------------------------------------------
// Enemy shots

/**
 * An enemy bolt at screen point `head` flying along world `velocity` (art/weapons.md "Enemy
 * shots"): its tail wedge, body and core turned to the projected heading, at `alpha`. The body
 * and core take the field edge; the tail does not.
 */
export function enemyBolt(art: EnemyWeaponsArt, head: Vec, velocity: Vec, alpha = 1): EnemyEffect {
  const { inner, innerColour, outer, outerColour, tail } = art.bolt;
  const angle = screenAngle(velocity);
  const body = turned(head, angle, outerColour, outer, alpha);
  const core = turned(head, angle, innerColour, inner, alpha);
  return {
    edged: [body, core],
    shapes: [turned(head, angle, tail.colour, tail.points, alpha), body, core],
  };
}

/** An enemy Scattershot pellet: a diamond over its core, turned to its heading; both edged. */
export function enemyPellet(
  art: EnemyWeaponsArt,
  head: Vec,
  velocity: Vec,
  alpha = 1,
): EnemyEffect {
  const { inner, innerColour, outer, outerColour } = art.pellet;
  const angle = screenAngle(velocity);
  const shapes = [
    turned(head, angle, outerColour, outer, alpha),
    turned(head, angle, innerColour, inner, alpha),
  ];
  return { edged: shapes, shapes };
}

/**
 * An enemy Multi-Laser volley fired from screen point `nose` with its bolts at `heads`: Ada's
 * band rule in the enemy's colours, with its trailing edges notched, while the heads are close,
 * else each bolt as a far dart. Every part takes the field edge.
 */
export function enemyFan(
  art: EnemyWeaponsArt,
  nose: Vec,
  heads: readonly { readonly at: Vec; readonly velocity: Vec }[],
  alpha = 1,
): EnemyEffect {
  const { far, near } = art.fan;
  const shapes =
    fanBands(
      near,
      { inner: near.innerColour, outer: near.colour },
      nose,
      heads.map(({ at }) => at),
      alpha,
    ) ??
    heads.map(({ at, velocity }) =>
      turned(at, screenAngle(velocity), far.colour, far.points, alpha),
    );
  return { edged: shapes, shapes };
}

/** An enemy missile's flame in Ada's geometry and the enemy flame colours. */
export function enemyMissileFlame(
  art: EnemyWeaponsArt,
  kind: "heavy" | "rapid",
  head: Vec,
  velocity: Vec,
  frameIndex: 0 | 1,
): PolygonShape[] {
  const { colour, innerColour } = art.missiles.flame;
  return missileFlame(kind, head, velocity, frameIndex, { inner: innerColour, outer: colour });
}

// ---------------------------------------------------------------------------------------------
// Ring burst

/**
 * A ring burst `t` ms after firing at hull centre `centre` on screen: the bolts' spawn circle of
 * world radius `spawnRadius` as a ground ellipse in held alpha steps and, without reduced motion,
 * a shrinking disc with a white core at each bolt's screen origin.
 */
export function ringEmission(
  art: EnemyWeaponsArt,
  centre: Vec,
  spawnRadius: number,
  origins: readonly Vec[],
  reducedMotion: boolean,
  t: number,
): EnemyEffect {
  const { emission, muzzle } = art.ringBurst;
  const { obstacle, white } = art.colours;
  const shapes: EffectShape[] = [];
  if (t >= 0 && t < emission.ms) {
    shapes.push({
      alpha: heldAlpha(t, emission.alpha, emission.alpha.at(-1)![1]),
      at: centre,
      colour: obstacle,
      halfHeight: spawnRadius * Math.SQRT1_2,
      halfWidth: spawnRadius * Math.SQRT2,
      kind: "ellipse",
      stroke: emission.stroke,
    });
  }
  if (!reducedMotion && t >= 0 && t < muzzle.ms) {
    const k = t / muzzle.ms;
    for (const origin of origins) {
      shapes.push({
        alpha: 1,
        at: origin,
        colour: obstacle,
        kind: "disc",
        radius: lerp(muzzle.radius[0], muzzle.radius[1], k),
      });
      if (t < muzzle.core.untilMs) {
        shapes.push({
          alpha: 1,
          at: origin,
          colour: white,
          kind: "disc",
          radius: lerp(muzzle.core.radius[0], muzzle.core.radius[1], k),
        });
      }
    }
  }
  return { edged: shapes, shapes };
}

/**
 * A ring bolt at screen point `head` flying along world `velocity`: a coralSide tail wedge, the
 * coral dart and its white core, turned to the projected heading. On a light field the body
 * takes an ink edge; the tail does not.
 */
export function ringDart(art: EnemyWeaponsArt, head: Vec, velocity: Vec): EnemyEffect {
  const { inner, innerColour, outer, outerColour, tail } = art.ringBurst.dart;
  const angle = screenAngle(velocity);
  const body = turned(head, angle, outerColour, outer);
  return {
    edged: [body],
    shapes: [
      turned(head, angle, tail.colour, tail.points),
      body,
      turned(head, angle, innerColour, inner),
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Mine

/**
 * What the scene knows of one mine: its age since the drop, its full life, and how it ends once
 * it does, a fizzle when its life runs out or a pop when a shot or Ada sets it off.
 */
export interface MineView {
  readonly ageMs: number;
  readonly end?: { readonly ageMs: number; readonly kind: "fizzle" | "pop" };
  readonly lifeMs: number;
}

/** Whether the mine blinks white: its blink period by remaining life, counted from the drop. */
export function mineBlink(art: EnemyWeaponsArt, ageMs: number, remainingMs: number): boolean {
  const rule =
    art.mine.blink.find(({ aboveRemainingMs }) => remainingMs > aboveRemainingMs) ??
    art.mine.blink[art.mine.blink.length - 1]!;
  return ageMs % rule.periodMs < rule.onMs;
}

/**
 * The mine's frame (art/weapons.md "Missile and mine frames"): its spin step, `floor(th /
 * stepDeg)`, which the frame count wraps, from the blink set while its lamp shows white, scaled
 * about its centre and at its alpha.
 */
export interface MineSolid {
  readonly alpha: number;
  readonly blink: boolean;
  readonly scale: number;
  readonly step: number;
}

/** A mine's shapes and the frame drawn under them; a popped mine shows no frame. */
export interface MineEffect extends EnemyEffect {
  readonly solid?: MineSolid;
}

/** Four flecks of `radius` at `startDeg + 90 i` degrees, `distance` out, y times `yScale`. */
function flecks(
  centre: Vec,
  colour: number,
  startDeg: number,
  radius: number,
  distance: number,
  yScale: number,
  alpha: number,
): EffectShape[] {
  return [0, 1, 2, 3].map((index) => {
    const angle = radians(startDeg + 90 * index);
    return {
      alpha,
      at: {
        x: centre.x + Math.cos(angle) * distance,
        y: centre.y + Math.sin(angle) * distance * yScale,
      },
      colour,
      kind: "disc",
      radius,
    };
  });
}

/** Segments approximating a clockwise screen arc of `sweep` degrees from `startDeg`. */
function arc(
  centre: Vec,
  radius: number,
  startDeg: number,
  sweep: number,
  stroke: Omit<LineShape, "from" | "kind" | "round" | "to">,
): LineShape[] {
  const steps = Math.max(1, Math.ceil(sweep / 10));
  const point = (degrees: number): Vec => ({
    x: centre.x + Math.cos(radians(degrees)) * radius,
    y: centre.y + Math.sin(radians(degrees)) * radius,
  });
  return Array.from({ length: steps }, (_, index) => ({
    ...stroke,
    from: point(startDeg + (sweep * index) / steps),
    kind: "line" as const,
    round: true,
    to: point(startDeg + (sweep * (index + 1)) / steps),
  }));
}

/**
 * A mine at screen point `centre` (art/weapons.md "Mine"): its frame at the spin step for
 * `60 x age` degrees, from the blink set while it blinks, and the vanish hint over its last 4 s;
 * then its fizzle, the frame shrinking on a white lamp with four flecks, or its pop. Reduced
 * motion holds spin step 0 without a blink, fades the fizzle and draws a static pop.
 */
export function mine(
  art: EnemyWeaponsArt,
  centre: Vec,
  view: MineView,
  reducedMotion: boolean,
): MineEffect {
  const spec = art.mine;
  const { obstacle } = art.colours;
  const spin = reducedMotion ? 0 : (spec.spin.degPerSecond * view.ageMs) / 1000;
  const step = Math.floor(spin / spec.spin.stepDeg);
  if (view.end?.kind === "pop") {
    return minePop(art, centre, view.end.ageMs, reducedMotion);
  }
  if (view.end?.kind === "fizzle") {
    const t = view.end.ageMs;
    const duration = reducedMotion ? spec.reducedFizzleMs : spec.fizzleMs;
    if (t >= duration) {
      return NONE;
    }
    const p = t / duration;
    if (reducedMotion) {
      return { ...NONE, solid: { alpha: heldFade(1 - p, art.fade), blink: false, scale: 1, step } };
    }
    const sparks = flecks(centre, obstacle, 45, 1, 5 + 6 * p, 0.75, heldFade(1 - p, art.fade));
    return {
      edged: sparks,
      shapes: sparks,
      solid: { alpha: 1, blink: true, scale: 1 - p * p, step },
    };
  }
  const remaining = view.lifeMs - view.ageMs;
  const blink = !reducedMotion && mineBlink(art, view.ageMs, remaining);
  const hint =
    remaining > 0 && remaining < spec.hint.ms
      ? arc(centre, spec.hint.radius, spec.hint.startDeg, (360 * remaining) / spec.hint.ms, {
          alpha: 1,
          colour: obstacle,
          width: spec.hint.stroke,
        })
      : [];
  return { edged: hint, shapes: hint, solid: { alpha: 1, blink, scale: 1, step } };
}

/** How long a mine's pop draws, the longer of its full and reduced effects. */
export const MINE_POP_MS = 220;

/** A mine's pop `t` ms after a shot or Ada sets it off. */
function minePop(
  art: EnemyWeaponsArt,
  centre: Vec,
  t: number,
  reducedMotion: boolean,
): EnemyEffect {
  const duration = reducedMotion ? art.mine.reducedPopMs : MINE_POP_MS;
  const shapes =
    t < 0 || t >= duration
      ? []
      : impactEffect(
          { at: centre, reducedMotion },
          {
            age: ((t / duration) * SPARK_MS * IMPACT_STYLE.shockwave.duration) / 1000,
            family: "shockwave",
          },
        );
  return {
    edged: shapes.filter(
      (shape) =>
        "part" in shape && shape.part !== undefined && art.mine.popEdged.includes(shape.part),
    ),
    shapes,
  };
}

// ---------------------------------------------------------------------------------------------
// Beams and tells

/** A beam's width factor `w` and alpha `a` at `t` ms, linear between Art's keys. */
export function beamAt(beam: Pick<BeamArt, "keys">, t: number): { a: number; w: number } {
  const keys = beam.keys;
  const next = keys.findIndex(([ms]) => ms > t);
  if (next === -1) {
    return { a: keys[keys.length - 1]![2], w: keys[keys.length - 1]![1] };
  }
  if (next === 0) {
    return { a: keys[0]![2], w: keys[0]![1] };
  }
  const [fromMs, fromW, fromA] = keys[next - 1]!;
  const [toMs, toW, toA] = keys[next]!;
  const k = (t - fromMs) / (toMs - fromMs);
  return { a: lerp(fromA, toA, k), w: lerp(fromW, toW, k) };
}

/**
 * A beam `t` ms after it fires from `from` to `to` on screen: Art's opaque bands keyed by `w`
 * with the held fade of `a`, its muzzle bloom, and a miss tapering every band to a point over the
 * last `taper` px; under reduced motion its bands at `widthFactor`, with or without bloom, alpha
 * 1 to `holdMs`, then the held fade. The outer band and bloom disc take the field edge.
 */
function enemyBeam(
  art: EnemyWeaponsArt,
  beam: BeamArt,
  from: Vec,
  to: Vec,
  taper: number,
  reducedMotion: boolean,
  t: number,
): EnemyEffect {
  if (t < 0 || t >= beam.ms) {
    return NONE;
  }
  if (reducedMotion) {
    const { bloom, holdMs, widthFactor } = beam.reducedMotion;
    const alpha = heldFade(t <= holdMs ? 1 : 1 - (t - holdMs) / (beam.ms - holdMs), art.fade);
    return flatBeam(beam, from, to, taper, widthFactor, alpha, bloom);
  }
  const { a, w } = beamAt(beam, t);
  return flatBeam(beam, from, to, taper, w, heldFade(a, art.fade), true);
}

/** A charge disc at the muzzle growing over `progress` 0 to 1, with its white core. */
function charge(
  art: EnemyWeaponsArt,
  spec: { core: readonly [number, number]; radius: readonly [number, number] },
  muzzle: Vec,
  progress: number,
): EffectShape[] {
  return [
    {
      alpha: 1,
      at: muzzle,
      colour: art.colours.obstacle,
      kind: "disc",
      radius: lerp(spec.radius[0], spec.radius[1], progress),
    },
    {
      alpha: 1,
      at: muzzle,
      colour: art.colours.white,
      kind: "disc",
      radius: lerp(spec.core[0], spec.core[1], progress),
    },
  ];
}

/**
 * What the scene knows of one charged lance or enemy Phaser shot: its turret's muzzle and the
 * line's end on screen, already stopped at the first obstacle (or, for the lance, the game-area
 * edge), the ms since its tell began, and whether an obstacle or Ada stopped the line.
 */
export interface TellView {
  readonly ageMs: number;
  /**
   * A fired Phaser's visible beam where its ship holds it now; `muzzle` and `end` stay the
   * fire-time line, which the aim line and the hit use. Absent, the beam draws on that line.
   */
  readonly beam?: { readonly from: Vec; readonly to: Vec };
  readonly end: Vec;
  readonly muzzle: Vec;
  readonly stopped: boolean;
}

/**
 * A charged lance (art/weapons.md "Charged lance"): marching coral dashes tracking for 700 ms,
 * the still pale-coral locked line with its white pulses for 300 ms, the growing charge at the
 * muzzle, then the beam for 300 ms, ending hard with the enemy spark where an obstacle stops it.
 */
export function lance(art: EnemyWeaponsArt, view: TellView, reducedMotion: boolean): EnemyEffect {
  const spec = art.lance;
  const { end, muzzle } = view;
  const { obstacle, white } = art.colours;
  const t = view.ageMs;
  const tell = spec.trackMs + spec.lockMs;
  if (t < 0) {
    return NONE;
  }
  if (t < tell) {
    const shapes: EffectShape[] = [];
    const edged: EffectShape[] = [];
    let pulse = false;
    if (t < spec.trackMs) {
      const march = reducedMotion ? 0 : (spec.tracking.march * t) / 1000;
      const line = dashes(muzzle, end, spec.tracking.dash[0], spec.tracking.dash[1], march, {
        alpha: 1,
        colour: obstacle,
        width: spec.tracking.width,
      });
      shapes.push(...line);
      edged.push(...line);
    } else {
      const lock = t - spec.trackMs;
      pulse = !reducedMotion && spec.locked.pulses.some(([from, to]) => lock >= from && lock < to);
      const line: LineShape = {
        alpha: 1,
        colour: pulse ? white : art.colours.plate,
        from: muzzle,
        kind: "line",
        round: false,
        to: end,
        width: spec.locked.width,
      };
      shapes.push(line);
      edged.push(line);
    }
    if (pulse) {
      const { alpha, colour, radius } = spec.locked.halo;
      shapes.push({ alpha, at: muzzle, colour, kind: "disc", radius });
    }
    const disc = charge(art, spec.charge, muzzle, t / tell);
    shapes.push(...disc);
    edged.push(disc[0]!);
    return { edged, shapes };
  }
  const beamMs = t - tell;
  // A full-length beam tapers over its end as a Phaser miss does; a stopped one ends hard.
  const taper = view.stopped ? 0 : art.phaser.missFade;
  const beam = enemyBeam(art, spec, muzzle, end, taper, reducedMotion, beamMs);
  if (!view.stopped) {
    return beam;
  }
  const hitShapes =
    beamMs < 0 || beamMs >= spec.spark.ms
      ? []
      : impactEffect(
          { at: end, reducedMotion },
          {
            age: ((beamMs / spec.spark.ms) * SPARK_MS * IMPACT_STYLE.lance.duration) / 1000,
            direction: fromScreen({ x: end.x - muzzle.x, y: end.y - muzzle.y }),
            family: "lance",
          },
        );
  return { edged: [...beam.edged, ...hitShapes], shapes: [...beam.shapes, ...hitShapes] };
}

/**
 * An enemy Phaser shot (art/weapons.md "Enemy Phaser"): the fixed aim line, coral dashes then
 * solid pale coral for its last 100 ms, its end chevron and the muzzle charge for 400 ms, then
 * the coral beam for 150 ms with a miss taper, or the shared contact where it hits.
 */
export function enemyPhaser(
  art: EnemyWeaponsArt,
  view: TellView,
  reducedMotion: boolean,
): EnemyEffect {
  const spec = art.phaser;
  const { end, muzzle } = view;
  const t = view.ageMs;
  if (t < 0) {
    return NONE;
  }
  if (t < spec.aimMs) {
    const solid = t >= spec.solidFromMs;
    const colour = solid ? art.colours.plate : art.colours.obstacle;
    const width = solid ? spec.solidWidth : spec.aiming.width;
    const line: LineShape[] = solid
      ? [{ alpha: 1, colour, from: muzzle, kind: "line", round: false, to: end, width }]
      : dashes(muzzle, end, spec.aiming.dash[0], spec.aiming.dash[1], 0, {
          alpha: 1,
          colour,
          width,
        });
    // The chevron at the aim's end.
    const length = Math.hypot(end.x - muzzle.x, end.y - muzzle.y);
    const chevron = turned(
      muzzle,
      Math.atan2(end.y - muzzle.y, end.x - muzzle.x),
      colour,
      spec.chevron.map(([u, v]) => [length + u, v] as const),
    );
    const disc = charge(art, spec.charge, muzzle, t / spec.aimMs);
    return { edged: [...line, chevron, disc[0]!], shapes: [...line, chevron, ...disc] };
  }
  const beamMs = t - spec.aimMs;
  const taper = view.stopped ? 0 : spec.missFade;
  // The beam stays on the turret's muzzle and aim; its hit stays at the fire-time contact.
  const beam = enemyBeam(
    art,
    spec,
    view.beam?.from ?? muzzle,
    view.beam?.to ?? end,
    taper,
    reducedMotion,
    beamMs,
  );
  if (!view.stopped) {
    return beam;
  }
  const hitShapes =
    beamMs < 0 || beamMs >= spec.spark.ms
      ? []
      : impactEffect(
          { at: end, reducedMotion },
          {
            age: ((beamMs / spec.spark.ms) * SPARK_MS * IMPACT_STYLE.compactBright.duration) / 1000,
            direction: fromScreen({ x: end.x - muzzle.x, y: end.y - muzzle.y }),
            family: "compactBright",
          },
        );
  return { edged: [...beam.edged, ...hitShapes], shapes: [...beam.shapes, ...hitShapes] };
}

// ---------------------------------------------------------------------------------------------
// The model's view

/** A charged lance or enemy Phaser tell in world units, its `end` already stopped as drawn. */
export interface WorldTell {
  readonly ageMs: number;
  readonly beam?: { readonly from: Vec; readonly to: Vec };
  readonly end: Vec;
  readonly muzzle: Vec;
  readonly stopped: boolean;
}

/**
 * The enemy-only weapon state the scene draws each frame, in world units and ms. The model
 * stops each tell line at the first obstacle (or, for the lance, the game-area edge) and keeps
 * a mine's end until its fizzle or pop has played.
 */
export interface EnemyWeaponsView {
  readonly lances: readonly WorldTell[];
  readonly mines: readonly (MineView & { readonly at: Vec; readonly id: string })[];
  readonly phasers: readonly WorldTell[];
  readonly ringBolts: readonly { readonly at: Vec; readonly velocity: Vec }[];
  readonly rings: readonly {
    readonly ageMs: number;
    readonly at: Vec;
    readonly origins: readonly Vec[];
    readonly spawnRadius: number;
  }[];
}
