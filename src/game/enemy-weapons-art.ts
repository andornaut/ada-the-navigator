import type { Vec } from "../model/types.ts";
import { type EffectShape, headingFactor, type LineShape, screenAngle } from "./weapon-effects.ts";

// Art's enemy-only weapon effects and the enemy Phaser (art/weapons.md "Enemy Phaser" and
// "Enemy-only weapons") from public/art/enemy-weapons.json, as screen-space shapes in logical px
// for the scene to fill and stroke. Each builder returns the shapes and the subset a light field
// edges in ink.

/** What a weapon effect draws and which of those shapes take ink edges on a light field. */
export interface EnemyEffect {
  readonly edged: readonly EffectShape[];
  readonly shapes: readonly EffectShape[];
}

const NONE: EnemyEffect = { edged: [], shapes: [] };

type Colours = Readonly<
  Record<"coralSide" | "ink" | "obstacle" | "plate" | "weapon" | "white", number>
>;

/** A beam's timing, layers, bloom, light-field glow and reduced-motion line. */
interface BeamArt {
  readonly bloom: readonly { colour: number; radius: number; alpha: number }[];
  readonly keys: readonly (readonly [number, number, number])[];
  readonly layers: readonly { colour: number; width: readonly [number, number]; alpha: number }[];
  readonly lightField: {
    readonly bloomAlpha: number;
    readonly glow: { readonly alpha: number; readonly width: readonly [number, number] };
  };
  readonly ms: number;
  readonly reducedMotion: {
    readonly edge: { alpha: number; colour: number; lightAlpha: number; width: number };
    readonly holdMs: number;
    readonly line: { colour: number; width: number };
    readonly spark: { colour: number; radius: number; stroke: number };
  };
  readonly spark: { readonly ms: number; readonly scale: number };
}

/** Art's enemy-weapons.json, version 1, with colours as numbers. */
export interface EnemyWeaponsArt {
  readonly colours: Colours;
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
  readonly mine: {
    readonly blink: readonly { aboveRemainingMs: number; onMs: number; periodMs: number }[];
    readonly body: { colour: number; radius: number };
    readonly core: { flash: number; light: number; lightColour: number; ring: number };
    readonly fizzleMs: number;
    readonly hint: { ms: number; radius: number; startDeg: number; stroke: number };
    readonly reducedPop: { fill: number; ms: number; radius: number; stroke: number };
    readonly spikes: { base: number; count: number; halfWidth: number; tip: number };
    readonly spin: number;
    readonly top: { offset: Vec; radius: number };
  };
  readonly phaser: BeamArt & {
    readonly aimMs: number;
    readonly aiming: { dash: readonly [number, number]; width: number };
    readonly charge: { core: readonly [number, number]; radius: readonly [number, number] };
    readonly endTick: number;
    readonly missFade: number;
    readonly solidFromMs: number;
    readonly solidWidth: number;
  };
  readonly ringBurst: {
    readonly dart: {
      readonly inner: readonly Vec[];
      readonly outer: readonly Vec[];
      readonly tail: { alpha: readonly [number, number]; head: number; length: number };
      readonly tailWidth: readonly [number, number];
    };
    readonly emission: { ms: number; stroke: number };
    readonly muzzle: {
      readonly core: { radius: readonly [number, number]; untilMs: number };
      readonly ms: number;
      readonly radius: readonly [number, number];
    };
  };
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

function points(value: unknown, path: string): Vec[] {
  return list(value, path, (entry) => {
    const [x, y] = pair(entry, "");
    return { x, y };
  });
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
          alpha: num(entry, "alpha"),
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
          alpha: num(entry, "alpha"),
          colour: colour(entry, "colour"),
          width: pair(entry, "width"),
        })),
        lightField: {
          bloomAlpha: num(art, "lightField.bloomAlpha"),
          glow: {
            alpha: num(art, "lightField.glow.alpha"),
            width: pair(art, "lightField.glow.width"),
          },
        },
        ms: num(art, "flashMs"),
        reducedMotion: {
          edge: {
            alpha: num(art, "reducedMotion.edge.alpha"),
            colour: colour(art, "reducedMotion.edge.colour"),
            lightAlpha: num(art, "reducedMotion.edge.lightAlpha"),
            width: num(art, "reducedMotion.edge.width"),
          },
          holdMs: num(art, "reducedMotion.holdMs"),
          line: {
            colour: colour(art, "reducedMotion.line.colour"),
            width: num(art, "reducedMotion.line.width"),
          },
          spark: {
            colour: colour(art, "reducedMotion.spark.colour"),
            radius: num(art, "reducedMotion.spark.radius"),
            stroke: num(art, "reducedMotion.spark.stroke"),
          },
        },
        spark: { ms: num(art, "spark.ms"), scale: num(art, "spark.scale") },
      };
    };
    const mine = at(value, "mine");
    const ring = at(value, "ringBurst");
    const lance = at(value, "lance");
    const phaser = at(value, "phaser");
    return {
      colours,
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
        body: { colour: colour(mine, "body.colour"), radius: num(mine, "body.radius") },
        core: {
          flash: num(mine, "core.flash.radius"),
          light: num(mine, "core.light.radius"),
          lightColour: colour(mine, "core.light.colour"),
          ring: num(mine, "core.ring.radius"),
        },
        fizzleMs: num(mine, "fizzle.ms"),
        hint: {
          ms: num(mine, "hint.ms"),
          radius: num(mine, "hint.radius"),
          startDeg: num(mine, "hint.startDeg"),
          stroke: num(mine, "hint.stroke"),
        },
        reducedPop: {
          fill: num(mine, "reducedMotion.pop.fill"),
          ms: num(mine, "reducedMotion.pop.ms"),
          radius: num(mine, "reducedMotion.pop.radius"),
          stroke: num(mine, "reducedMotion.pop.stroke"),
        },
        spikes: {
          base: num(mine, "spikes.base"),
          count: num(mine, "spikes.count"),
          halfWidth: num(mine, "spikes.halfWidth"),
          tip: num(mine, "spikes.tip"),
        },
        spin: num(mine, "spin.degPerSecond"),
        top: {
          offset: (([x, y]) => ({ x, y }))(pair(mine, "top.offset")),
          radius: num(mine, "top.radius"),
        },
      },
      phaser: {
        ...beam("phaser"),
        aimMs: num(phaser, "aimMs"),
        aiming: { dash: pair(phaser, "aiming.dash"), width: num(phaser, "aiming.width") },
        charge: { core: pair(phaser, "charge.core"), radius: pair(phaser, "charge.radius") },
        endTick: num(phaser, "endTick.length"),
        missFade: num(phaser, "missFade"),
        solidFromMs: num(phaser, "solidFromMs"),
        solidWidth: num(phaser, "solid.width"),
      },
      ringBurst: {
        dart: {
          inner: points(ring, "dart.inner"),
          outer: points(ring, "dart.outer"),
          tail: {
            alpha: pair(ring, "dart.tail.alpha"),
            head: num(ring, "dart.tail.head"),
            length: num(ring, "dart.tail.length"),
          },
          tailWidth: pair(ring, "dart.tail.width"),
        },
        emission: { ms: num(ring, "emission.ms"), stroke: num(ring, "emission.stroke") },
        muzzle: {
          core: {
            radius: pair(ring, "muzzle.core.radius"),
            untilMs: num(ring, "muzzle.core.untilMs"),
          },
          ms: num(ring, "muzzle.ms"),
          radius: pair(ring, "muzzle.radius"),
        },
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
  return shapes.map((shape): EffectShape => {
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
      case "polygon": {
        // Grown about its centroid by `edge` px along each vertex's direction.
        const centre = shape.points.reduce(
          (sum, point) => ({
            x: sum.x + point.x / shape.points.length,
            y: sum.y + point.y / shape.points.length,
          }),
          { x: 0, y: 0 },
        );
        return {
          ...shape,
          colour: ink,
          points: shape.points.map((point) => {
            const dx = point.x - centre.x;
            const dy = point.y - centre.y;
            const distance = Math.hypot(dx, dy) || 1;
            return { x: point.x + (dx / distance) * edge, y: point.y + (dy / distance) * edge };
          }),
        };
      }
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
// Ring burst

/**
 * A ring burst `t` ms after firing at hull centre `centre` on screen: the bolts' spawn circle of
 * world radius `spawnRadius` as a ground ellipse for 180 ms and, without reduced motion, a
 * shrinking disc with a white core at each bolt's screen origin for 120 ms.
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
      alpha: 1 - t / emission.ms,
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
 * A ring bolt at screen point `head` flying along world `velocity`: a tapered coral tail, the
 * coral dart and its white core, turned to the projected heading. On a light field the body
 * takes an ink edge; the tail does not.
 */
export function ringDart(art: EnemyWeaponsArt, head: Vec, velocity: Vec): EnemyEffect {
  const { inner, outer, tail, tailWidth } = art.ringBurst.dart;
  const { obstacle, white } = art.colours;
  const at = frame(head, screenAngle(velocity));
  const f = headingFactor(velocity);
  const body: EffectShape = {
    alpha: 1,
    colour: obstacle,
    kind: "polygon",
    points: outer.map(({ x, y }) => at(x, y)),
  };
  return {
    edged: [body],
    shapes: [
      {
        colour: obstacle,
        head: { alpha: tail.alpha[0], at: at(tail.head, 0), width: tailWidth[0] },
        kind: "taper",
        tail: { alpha: tail.alpha[1], at: at(tail.head - tail.length * f, 0), width: tailWidth[1] },
      },
      body,
      { alpha: 1, colour: white, kind: "polygon", points: inner.map(({ x, y }) => at(x, y)) },
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

/** Whether the mine's core shows white: its blink period by remaining life, counted from the drop. */
export function mineBlink(art: EnemyWeaponsArt, ageMs: number, remainingMs: number): boolean {
  const rule =
    art.mine.blink.find(({ aboveRemainingMs }) => remainingMs > aboveRemainingMs) ??
    art.mine.blink[art.mine.blink.length - 1]!;
  return ageMs % rule.periodMs < rule.onMs;
}

/** The mine body at spin `spin` degrees, scaled by `scale` about `centre`. */
function mineBody(
  art: EnemyWeaponsArt,
  centre: Vec,
  spin: number,
  scale: number,
  white: boolean,
  alpha: number,
): { body: EffectShape[]; core: EffectShape[] } {
  const { body, core, spikes, top } = art.mine;
  const c = art.colours;
  const point = (degrees: number, radius: number, side = 0): Vec => {
    const angle = radians(degrees);
    return {
      x: centre.x + (Math.cos(angle) * radius - Math.sin(angle) * side) * scale,
      y: centre.y + (Math.sin(angle) * radius + Math.cos(angle) * side) * scale,
    };
  };
  const shapes: EffectShape[] = [];
  for (let index = 0; index < spikes.count; index++) {
    const direction = spin + (360 / spikes.count) * index;
    shapes.push({
      alpha,
      colour: c.obstacle,
      kind: "polygon",
      points: [
        point(direction, spikes.tip),
        point(direction, spikes.base, -spikes.halfWidth),
        point(direction, spikes.base, spikes.halfWidth),
      ],
    });
  }
  shapes.push(
    { alpha, at: centre, colour: body.colour, kind: "disc", radius: body.radius * scale },
    {
      alpha,
      at: { x: centre.x + top.offset.x * scale, y: centre.y + top.offset.y * scale },
      colour: c.obstacle,
      kind: "disc",
      radius: top.radius * scale,
    },
  );
  return {
    body: shapes,
    core: [
      { alpha, at: centre, colour: c.ink, kind: "disc", radius: core.ring * scale },
      white
        ? { alpha, at: centre, colour: c.white, kind: "disc", radius: core.flash * scale }
        : { alpha, at: centre, colour: core.lightColour, kind: "disc", radius: core.light * scale },
    ],
  };
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
 * A mine at screen point `centre` (art/weapons.md "Mine"): spikes spun to `60 x age` degrees, the
 * body and its blinking amber core, and the vanish hint over its last 4 s; then its fizzle or
 * pop. Reduced motion holds the spin and blink, fades the fizzle and draws a static pop ring.
 */
export function mine(
  art: EnemyWeaponsArt,
  centre: Vec,
  view: MineView,
  reducedMotion: boolean,
): EnemyEffect {
  const spec = art.mine;
  const { obstacle, plate, white } = art.colours;
  const spin = reducedMotion ? 0 : (spec.spin * view.ageMs) / 1000;
  if (view.end?.kind === "pop") {
    return minePop(art, centre, view.end.ageMs, reducedMotion);
  }
  if (view.end?.kind === "fizzle") {
    const t = view.end.ageMs;
    if (t >= spec.fizzleMs) {
      return NONE;
    }
    const p = t / spec.fizzleMs;
    if (reducedMotion) {
      const { body, core } = mineBody(art, centre, spin, 1, false, 1 - p);
      return { edged: body, shapes: [...body, ...core] };
    }
    const { body, core } = mineBody(art, centre, spin, 1 - p * p, true, 1);
    const sparks = flecks(centre, obstacle, 45, 1, 5 + 6 * p, 0.75, 1 - p);
    return { edged: [...body, ...sparks], shapes: [...body, ...core, ...sparks] };
  }
  const remaining = view.lifeMs - view.ageMs;
  const blink = !reducedMotion && mineBlink(art, view.ageMs, remaining);
  const { body, core } = mineBody(art, centre, spin, 1, blink, 1);
  const hint =
    remaining > 0 && remaining < spec.hint.ms
      ? arc(centre, spec.hint.radius, spec.hint.startDeg, (360 * remaining) / spec.hint.ms, {
          alpha: 1,
          colour: obstacle,
          width: spec.hint.stroke,
        })
      : [];
  void plate;
  void white;
  return { edged: [...body, ...hint], shapes: [...body, ...core, ...hint] };
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
  const { obstacle, plate, white } = art.colours;
  if (reducedMotion) {
    const pop = art.mine.reducedPop;
    if (t >= pop.ms) {
      return NONE;
    }
    const a = 1 - t / pop.ms;
    const ring: EffectShape = {
      alpha: 0.9 * a,
      at: centre,
      colour: obstacle,
      halfHeight: pop.radius / 2,
      halfWidth: pop.radius,
      kind: "ellipse",
      stroke: pop.stroke,
    };
    return {
      edged: [ring],
      shapes: [
        {
          alpha: pop.fill * a,
          at: centre,
          colour: obstacle,
          halfHeight: pop.radius / 2,
          halfWidth: pop.radius,
          kind: "ellipse",
        },
        ring,
      ],
    };
  }
  if (t >= MINE_POP_MS) {
    return NONE;
  }
  const g = Math.min(1, t / 110);
  const radius = 5 + 11 * (1 - (1 - g) ** 3);
  const ring: EffectShape = {
    alpha: t <= 110 ? 1 : 1 - (t - 110) / 110,
    at: centre,
    colour: obstacle,
    halfHeight: radius / 2,
    halfWidth: radius,
    kind: "ellipse",
    stroke: lerp(2, 1, t / MINE_POP_MS),
  };
  const tint: EffectShape = {
    alpha: 0.14 * (1 - t / MINE_POP_MS) ** 2,
    at: centre,
    colour: obstacle,
    halfHeight: radius / 2,
    halfWidth: radius,
    kind: "ellipse",
  };
  const sparks =
    t < 180
      ? flecks(centre, obstacle, 20, 1.1, 4 + 9 * (1 - (1 - t / 180) ** 2), 0.6, 1 - t / 180)
      : [];
  const step = t < 40 ? { q: 0.95, scale: 1 } : t < 80 ? { q: 0.6, scale: 0.55 } : undefined;
  const flash: EffectShape[] = step
    ? [
        [1.25, obstacle, 0.3],
        [1, obstacle, 0.85],
        [0.66, plate, 1],
        [0.36, white, 1],
      ].map(([scale, colour, alpha]) => ({
        alpha: (alpha as number) * step.q,
        at: centre,
        colour: colour as number,
        kind: "disc" as const,
        radius: 6 * step.scale * (scale as number),
      }))
    : [];
  return {
    edged: [ring, ...sparks, ...flash.slice(0, 1)],
    shapes: [tint, ring, ...sparks, ...flash],
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
 * The enemy spark `scale` times Art's hit spark `t` ms after a hit at `at`, rotated by the beam's
 * screen `angle`: rays white then coral, a white core and coral flecks; under reduced motion an
 * unrotated coral ring.
 */
export function enemySpark(
  art: EnemyWeaponsArt,
  beam: BeamArt,
  at: Vec,
  angle: number,
  reducedMotion: boolean,
  t: number,
): EnemyEffect {
  if (t < 0 || t >= beam.spark.ms) {
    return NONE;
  }
  const p = t / beam.spark.ms;
  const { obstacle, white } = art.colours;
  if (reducedMotion) {
    const { colour, radius, stroke } = beam.reducedMotion.spark;
    const ring: EffectShape = {
      alpha: 1 - p,
      at,
      colour,
      halfHeight: radius,
      halfWidth: radius,
      kind: "ellipse",
      stroke,
    };
    return { edged: [ring], shapes: [ring] };
  }
  const s = beam.spark.scale;
  const point = (direction: number, radius: number): Vec => ({
    x: at.x + Math.cos(angle + radians(direction)) * radius * s,
    y: at.y + Math.sin(angle + radians(direction)) * radius * s,
  });
  const shapes: EffectShape[] = [];
  if (p < 0.6) {
    const k = p / 0.6;
    for (const ray of [-150, -95, -35, 25, 80, 140]) {
      shapes.push({
        alpha: 1 - 0.6 * k,
        colour: p < 0.25 ? white : obstacle,
        from: point(ray, 1.5 + 5 * k),
        kind: "line",
        round: true,
        to: point(ray, 7.5 + 3 * k),
        width: 1.5,
      });
    }
  }
  if (p < 0.35) {
    shapes.push({
      alpha: 1,
      at,
      colour: white,
      kind: "disc",
      radius: (3 * (1 - p / 0.35) + 0.5) * s,
    });
  }
  if (p > 0.2) {
    const m = (p - 0.2) / 0.8;
    for (const fleck of [-120, -10, 100]) {
      shapes.push({
        alpha: 1 - m,
        at: point(fleck, 6 + 5 * (1 - (1 - m) ** 2)),
        colour: obstacle,
        kind: "disc",
        radius: 1.1 * s,
      });
    }
  }
  return { edged: shapes, shapes };
}

/**
 * A coral beam `t` ms after it fires from `from` to `to` on screen: tapered glow, body and core
 * layers, its muzzle bloom, and a miss fade over the last `fade` px. On a light field the glow
 * and the bloom's outer disc are ink. Reduced motion draws a steady line over an edge.
 */
function enemyBeam(
  art: EnemyWeaponsArt,
  beam: BeamArt,
  from: Vec,
  to: Vec,
  fade: number,
  light: boolean,
  reducedMotion: boolean,
  t: number,
): EffectShape[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (t < 0 || t >= beam.ms || length === 0) {
    return [];
  }
  const along = frame(from, Math.atan2(to.y - from.y, to.x - from.x));
  const end = Math.max(0, length - Math.min(fade, length));
  const taper = (
    colour: number,
    widths: readonly [number, number],
    alpha: number,
  ): EffectShape[] => {
    const width = (u: number) => lerp(widths[0], widths[1], u / length);
    const shapes: EffectShape[] = [
      {
        colour,
        head: { alpha, at: along(end, 0), width: width(end) },
        kind: "taper",
        tail: { alpha, at: along(0, 0), width: width(0) },
      },
    ];
    if (end < length) {
      shapes.push({
        colour,
        head: { alpha: 0, at: along(length, 0), width: width(length) },
        kind: "taper",
        tail: { alpha, at: along(end, 0), width: width(end) },
      });
    }
    return shapes;
  };
  if (reducedMotion) {
    const { edge, holdMs, line } = beam.reducedMotion;
    const a = t <= holdMs ? 1 : 1 - (t - holdMs) / (beam.ms - holdMs);
    return [
      ...taper(
        light ? art.colours.ink : edge.colour,
        [edge.width, edge.width],
        (light ? edge.lightAlpha : edge.alpha) * a,
      ),
      ...taper(line.colour, [line.width, line.width], a),
    ];
  }
  const { a, w } = beamAt(beam, t);
  const shapes: EffectShape[] = [];
  beam.layers.forEach((layer, index) => {
    const glow = index === 0 && light;
    const widths = glow ? beam.lightField.glow.width : layer.width;
    shapes.push(
      ...taper(
        glow ? art.colours.ink : layer.colour,
        [widths[0] * w, widths[1] * w],
        (glow ? beam.lightField.glow.alpha : layer.alpha) * a,
      ),
    );
  });
  beam.bloom.forEach((disc, index) => {
    const outer = index === 0 && light;
    shapes.push({
      alpha: (outer ? beam.lightField.bloomAlpha : disc.alpha) * a,
      at: from,
      colour: outer ? art.colours.ink : disc.colour,
      kind: "disc",
      radius: disc.radius * w,
    });
  });
  return shapes;
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
  readonly end: Vec;
  readonly muzzle: Vec;
  readonly stopped: boolean;
}

/**
 * A charged lance (art/weapons.md "Charged lance"): marching coral dashes tracking for 700 ms,
 * the still pale-coral locked line with its white pulses for 300 ms, the growing charge at the
 * muzzle, then the beam for 300 ms, ending hard with the enemy spark where an obstacle stops it.
 */
export function lance(
  art: EnemyWeaponsArt,
  view: TellView,
  light: boolean,
  reducedMotion: boolean,
): EnemyEffect {
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
  // A full-length beam fades out over its end as a Phaser miss does; a stopped one ends hard.
  const fade = view.stopped ? 0 : art.phaser.missFade;
  const shapes = enemyBeam(art, spec, muzzle, end, fade, light, reducedMotion, beamMs);
  if (!view.stopped) {
    return { edged: [], shapes };
  }
  const spark = enemySpark(
    art,
    spec,
    end,
    Math.atan2(end.y - muzzle.y, end.x - muzzle.x),
    reducedMotion,
    beamMs,
  );
  return { edged: spark.edged, shapes: [...shapes, ...spark.shapes] };
}

/** How long a lance draws from the start of its tell. */
export function lanceMs(art: EnemyWeaponsArt): number {
  const spec = art.lance;
  return spec.trackMs + spec.lockMs + Math.max(spec.ms, spec.spark.ms);
}

/** How long an enemy Phaser shot draws from the start of its aim line. */
export function phaserMs(art: EnemyWeaponsArt): number {
  return art.phaser.aimMs + Math.max(art.phaser.ms, art.phaser.spark.ms);
}

/**
 * An enemy Phaser shot (art/weapons.md "Enemy Phaser"): the fixed aim line, coral dashes then
 * solid pale coral for its last 100 ms, an end tick and the muzzle charge for 400 ms, then the
 * coral beam for 150 ms with a miss fade, or the enemy spark where it hits.
 */
export function enemyPhaser(
  art: EnemyWeaponsArt,
  view: TellView,
  light: boolean,
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
    const length = Math.hypot(end.x - muzzle.x, end.y - muzzle.y) || 1;
    const across = {
      x: (-(end.y - muzzle.y) / length) * (spec.endTick / 2),
      y: ((end.x - muzzle.x) / length) * (spec.endTick / 2),
    };
    const tick: LineShape = {
      alpha: 1,
      colour,
      from: { x: end.x - across.x, y: end.y - across.y },
      kind: "line",
      round: false,
      to: { x: end.x + across.x, y: end.y + across.y },
      width,
    };
    const disc = charge(art, spec.charge, muzzle, t / spec.aimMs);
    return { edged: [...line, tick, disc[0]!], shapes: [...line, tick, ...disc] };
  }
  const beamMs = t - spec.aimMs;
  const fade = view.stopped ? 0 : spec.missFade;
  const shapes = enemyBeam(art, spec, muzzle, end, fade, light, reducedMotion, beamMs);
  if (!view.stopped) {
    return { edged: [], shapes };
  }
  const spark = enemySpark(
    art,
    spec,
    end,
    Math.atan2(end.y - muzzle.y, end.x - muzzle.x),
    reducedMotion,
    beamMs,
  );
  return { edged: spark.edged, shapes: [...shapes, ...spark.shapes] };
}

// ---------------------------------------------------------------------------------------------
// The model's view

/** A charged lance or enemy Phaser tell in world units, its `end` already stopped as drawn. */
export interface WorldTell {
  readonly ageMs: number;
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

/** A view with nothing to draw. */
export const NO_ENEMY_WEAPONS: EnemyWeaponsView = {
  lances: [],
  mines: [],
  phasers: [],
  ringBolts: [],
  rings: [],
};
