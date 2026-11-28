import { BEAM, WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import type { Vec } from "../model/types.ts";
import type { WeaponImpact } from "../model/weaponImpacts.ts";
import { shipDirection } from "./shipArt.ts";

// Art's weapon effects in their flat look (art/weapons.md "Flat look") as screen-space shapes in
// logical px, for the scene to fill and stroke: solid shapes in opaque flat tones, tapers made by
// geometry and fades in held steps. Each shape is a plain record, so the geometry and timing are
// testable. The missiles and the mine draw as Art's frames (`readWeaponSolids`).

/** Art's effect colours: amber is the space palette's `weapon`. */
export const EFFECT_COLOURS = {
  amber: 0xf0bd68,
  cream: 0xead4aa,
  ink: 0x181425,
  white: 0xffffff,
} as const;
type Colour = number;

/** A filled polygon at one alpha. A blast marks its flash bursts by `part`. */
export interface PolygonShape {
  readonly alpha: number;
  readonly colour: Colour;
  readonly kind: "polygon";
  readonly part?: "flash";
  readonly points: readonly Vec[];
}
/** A quad from tail to head along one axis, full widths and alphas interpolated linearly. */
export interface TaperShape {
  readonly colour: Colour;
  readonly head: { readonly alpha: number; readonly at: Vec; readonly width: number };
  readonly kind: "taper";
  readonly tail: { readonly alpha: number; readonly at: Vec; readonly width: number };
}
/** A filled disc. */
export interface DiscShape {
  readonly alpha: number;
  readonly at: Vec;
  readonly colour: Colour;
  readonly kind: "disc";
  readonly radius: number;
}
/**
 * An axis-aligned ellipse, filled or stroked at `stroke` px. A blast marks its ring stroke by
 * `part`, which a light field edges in ink.
 */
export interface EllipseShape {
  readonly alpha: number;
  readonly at: Vec;
  readonly colour: Colour;
  readonly halfHeight: number;
  readonly halfWidth: number;
  readonly kind: "ellipse";
  readonly part?: "ring";
  readonly stroke?: number;
}
/** A straight stroke, with round caps when `round`. */
export interface LineShape {
  readonly alpha: number;
  readonly colour: Colour;
  readonly from: Vec;
  readonly kind: "line";
  readonly round: boolean;
  readonly to: Vec;
  readonly width: number;
}
export type EffectShape = DiscShape | EllipseShape | LineShape | PolygonShape | TaperShape;

/** Tech's projection of a world vector onto the screen. */
function project(v: Vec): Vec {
  return { x: v.x - v.y, y: (v.x + v.y) / 2 };
}

/** The screen angle of a world velocity. */
export function screenAngle(velocity: Vec): number {
  const p = project(velocity);
  return Math.atan2(p.y, p.x);
}

/**
 * The heading factor `f = |P(d)| / sqrt 2` for a world direction: 1 along heading 14 (screen
 * right), 0.5 at headings 2 and 10. Trail lengths given at heading 14 multiply by it.
 */
export function headingFactor(direction: Vec): number {
  const length = Math.hypot(direction.x, direction.y);
  if (length === 0) {
    return 1;
  }
  const p = project({ x: direction.x / length, y: direction.y / length });
  return Math.hypot(p.x, p.y) / Math.SQRT2;
}

/** A (u, v) frame on the screen: u forward along `angle` from `head`, v sideways. */
function frame(head: Vec, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (u: number, v: number): Vec => ({
    x: head.x + u * cos - v * sin,
    y: head.y + u * sin + v * cos,
  });
}
const degrees = (value: number) => (value * Math.PI) / 180;

/** A polygon of `points` in a (u, v) frame. */
function polygon(
  at: (u: number, v: number) => Vec,
  colour: Colour,
  alpha: number,
  points: readonly (readonly [number, number])[],
): PolygonShape {
  return { alpha, colour, kind: "polygon", points: points.map(([u, v]) => at(u, v)) };
}

/** The alpha of the first held step whose end `value` is under, else `last`. */
export function heldAlpha(
  value: number,
  steps: readonly (readonly [number, number])[],
  last: number,
): number {
  return steps.find(([until]) => value < until)?.[1] ?? last;
}

/**
 * A star of `points` points about `at`, the first along `angle`: tips at `radius` and the
 * notches between them at `waist` times it.
 */
export function burst(
  at: Vec,
  angle: number,
  points: number,
  radius: number,
  waist: number,
  colour: Colour,
  alpha: number,
): PolygonShape {
  const corners: Vec[] = [];
  for (let index = 0; index < points * 2; index++) {
    const r = index % 2 === 0 ? radius : radius * waist;
    const a = angle + (Math.PI * index) / points;
    corners.push({ x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r });
  }
  return { alpha, colour, kind: "polygon", points: corners };
}

/** A wedge pointing out from `at` along `angle`: its base `width` across at `from`, tip at `to`. */
function radialWedge(
  at: Vec,
  angle: number,
  from: number,
  to: number,
  width: number,
  colour: Colour,
  alpha: number,
): PolygonShape {
  return polygon(frame(at, angle), colour, alpha, [
    [from, -width / 2],
    [to, 0],
    [from, width / 2],
  ]);
}

/**
 * The shapes with every polygon cut at the line through `from` across screen `angle`, keeping
 * only what lies ahead of it: a fresh shot's trail drawn from its fire point rather than behind
 * it. Polygons wholly behind drop out; other shapes pass unchanged.
 */
export function clipBehind(
  from: Vec,
  angle: number,
  shapes: readonly EffectShape[],
): EffectShape[] {
  const ahead = (point: Vec) =>
    (point.x - from.x) * Math.cos(angle) + (point.y - from.y) * Math.sin(angle);
  return shapes.flatMap((shape): EffectShape[] => {
    if (shape.kind !== "polygon") {
      return [shape];
    }
    const points: Vec[] = [];
    shape.points.forEach((point, index) => {
      const next = shape.points[(index + 1) % shape.points.length]!;
      const [a, b] = [ahead(point), ahead(next)];
      if (a >= 0) {
        points.push(point);
      }
      if (a >= 0 ? b < 0 : b >= 0) {
        const t = a / (a - b);
        points.push({ x: point.x + (next.x - point.x) * t, y: point.y + (next.y - point.y) * t });
      }
    });
    return points.length >= 3 ? [{ ...shape, points }] : [];
  });
}

// ---------------------------------------------------------------------------------------------
// Bolt, pellet and fan

/** Ada's bolt slug in (u, v) logical px back from the head (art/weapons.md "Bolt, pellet and fan"). */
const SLUG = [
  [0, 0],
  [-1.62, -1.275],
  [-8.4, -1.275],
  [-9.3, 0],
  [-8.4, 1.275],
  [-1.62, 1.275],
] as const;
const SLUG_CORE = [
  [-0.9, 0],
  [-1.98, -0.675],
  [-5.208, -0.675],
  [-5.208, 0.675],
  [-1.98, 0.675],
] as const;
/** The Laser bolt's tail step: 1.275 px wide from 8.4 to 16.2 px behind the head. */
const SLUG_TAIL = { from: 8.4, to: 16.2, width: 1.275 } as const;
/** A far Multi-Laser bolt: the slug scaled to 1.87 px wide with its shoulder 6 px behind the head. */
const FAN_SLUG = { shoulder: 6, width: 1.87 } as const;

/**
 * A fan band (art/weapons.md "Bolt, pellet and fan"), drawn while neighbouring heads are under
 * `spacing` px apart on screen. For each head at distance `h` from the nose, the outer band runs
 * back to `max(minRadius, h - depth)`, its two end heads widened `widen` px sideways; the inner
 * band runs from `h - inner.inset` back to the outer band's inner edge plus `inner.offset`. Both
 * trailing edges move `notch` px forward at the middle head, falling to 0 at the end heads.
 */
export interface FanBand {
  readonly depth: number;
  readonly inner: { readonly inset: number; readonly offset: number };
  readonly minRadius: number;
  readonly notch: number;
  readonly spacing: number;
  readonly widen: number;
}

/** Ada's fan band: amber back 6.6 px, widened 0.935 px, over a cream band 1.5 and 2.4 px in. */
export const ADA_FAN: FanBand = {
  depth: 6.6,
  inner: { inset: 1.5, offset: 2.4 },
  minRadius: 4,
  notch: 0,
  spacing: 5.6,
  widen: 0.935,
};

/** The Laser bolt with its head at `head`, along screen `angle`: tail step, slug and core. */
export function laserBolt(head: Vec, angle: number, alpha = 1): PolygonShape[] {
  const at = frame(head, angle);
  const { amber, cream } = EFFECT_COLOURS;
  const half = SLUG_TAIL.width / 2;
  return [
    polygon(at, amber, alpha, [
      [-SLUG_TAIL.from, -half],
      [-SLUG_TAIL.to, -half],
      [-SLUG_TAIL.to, half],
      [-SLUG_TAIL.from, half],
    ]),
    polygon(at, amber, alpha, SLUG),
    polygon(at, cream, alpha, SLUG_CORE),
  ];
}

/** A far Multi-Laser bolt: the slug 1.87 px wide, its shoulder 6 px back, with no core or tail. */
export function fanBolt(head: Vec, angle: number, alpha = 1): PolygonShape {
  const u = FAN_SLUG.shoulder / -SLUG[2][0];
  const v = FAN_SLUG.width / (2 * -SLUG[2][1]);
  return polygon(
    frame(head, angle),
    EFFECT_COLOURS.amber,
    alpha,
    SLUG.map(([a, b]) => [a * u, b * v] as const),
  );
}

/**
 * A fan volley's bands fired from screen point `nose` with its bolts at `heads` (screen
 * points): the outer band in `colours.outer` over the inner band in `colours.inner` while
 * neighbouring heads, ordered across the fan, are under `band.spacing` px apart on screen and
 * every head is past `band.minRadius`. Undefined while the volley draws as single bolts.
 */
export function fanBands(
  band: FanBand,
  colours: { readonly inner: Colour; readonly outer: Colour },
  nose: Vec,
  heads: readonly Vec[],
  alpha = 1,
): PolygonShape[] | undefined {
  const rays = heads.map((at) => {
    const h = Math.hypot(at.x - nose.x, at.y - nose.y);
    return {
      at,
      h,
      unit: h > 0 ? { x: (at.x - nose.x) / h, y: (at.y - nose.y) / h } : { x: 0, y: 0 },
    };
  });
  if (rays.length < 2 || rays.some(({ h }) => h <= band.minRadius)) {
    return undefined;
  }
  // Order the heads across the fan, from the clockwise edge to the anticlockwise one.
  const mean = rays.reduce((sum, { unit }) => ({ x: sum.x + unit.x, y: sum.y + unit.y }), {
    x: 0,
    y: 0,
  });
  const side = ({ unit }: (typeof rays)[number]) => mean.x * unit.y - mean.y * unit.x;
  rays.sort((a, b) => side(a) - side(b));
  const near = rays.every(
    ({ at }, index) =>
      index === 0 ||
      Math.hypot(at.x - rays[index - 1]!.at.x, at.y - rays[index - 1]!.at.y) < band.spacing,
  );
  if (!near) {
    return undefined;
  }
  const along = ({ unit }: (typeof rays)[number], radius: number, sideways = 0): Vec => ({
    x: nose.x + unit.x * radius - unit.y * sideways,
    y: nose.y + unit.y * radius + unit.x * sideways,
  });
  const last = rays.length - 1;
  const middle = last / 2;
  const notch = (index: number) => band.notch * (1 - Math.abs(index - middle) / middle);
  const inner = rays.map(({ h }) => Math.max(band.minRadius, h - band.depth));
  // The ends move outward: clockwise for the first head, anticlockwise for the last.
  const widen = (index: number) => (index === 0 ? -band.widen : index === last ? band.widen : 0);
  const outline = (
    outer: (index: number) => number,
    from: (index: number) => number,
    ends: boolean,
  ) => [
    ...rays.map((ray, index) => along(ray, outer(index), ends ? widen(index) : 0)),
    ...rays.map((ray, index) => along(ray, from(index), ends ? widen(index) : 0)).reverse(),
  ];
  const shapes: PolygonShape[] = [
    {
      alpha,
      colour: colours.outer,
      kind: "polygon",
      points: outline(
        (index) => rays[index]!.h,
        (index) => inner[index]! + notch(index),
        true,
      ),
    },
  ];
  const innerOuter = (index: number) => rays[index]!.h - band.inner.inset;
  const innerFrom = (index: number) => inner[index]! + band.inner.offset + notch(index);
  if (rays.every((_, index) => innerOuter(index) > innerFrom(index))) {
    shapes.push({
      alpha,
      colour: colours.inner,
      kind: "polygon",
      points: outline(innerOuter, innerFrom, false),
    });
  }
  return shapes;
}

/**
 * Ada's Multi-Laser volley fired from screen point `nose`, with its bolts still in flight at
 * `heads` (screen points and world velocities): one amber band through the heads over a cream
 * band while they are close, else each bolt as a far slug.
 */
export function fanVolley(
  nose: Vec,
  heads: readonly { readonly at: Vec; readonly velocity: Vec }[],
  alpha = 1,
): PolygonShape[] {
  return (
    fanBands(
      ADA_FAN,
      { inner: EFFECT_COLOURS.cream, outer: EFFECT_COLOURS.amber },
      nose,
      heads.map(({ at }) => at),
      alpha,
    ) ?? heads.map(({ at, velocity }) => fanBolt(at, screenAngle(velocity), alpha))
  );
}

/** The Scattershot pellet: an amber disc lit by a cream disc 0.45 px up and left of its centre. */
export function pellet(at: Vec, alpha = 1): DiscShape[] {
  return [
    { alpha, at, colour: EFFECT_COLOURS.amber, kind: "disc", radius: 1.7 },
    {
      alpha,
      at: { x: at.x - 0.45, y: at.y - 0.45 },
      colour: EFFECT_COLOURS.cream,
      kind: "disc",
      radius: 0.7,
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// Missiles and mine frames

// The Rapid Missile's blast radius at every level tells its shots and blasts from the Heavy's.
const RAPID_BLASTS = new Set(WEAPON_CATALOG.rapidMissile.map(({ blastRadius }) => blastRadius));

/** Which missile a blast radius belongs to. */
export function missileKind(blast: number): "heavy" | "rapid" {
  return RAPID_BLASTS.has(blast) ? "rapid" : "heavy";
}

/** Missile flicker: two frames looping, Rapid 50 ms and Heavy 90 ms each; reduced motion holds 0. */
export const MISSILE_FRAME_MS = { heavy: 90, rapid: 50 } as const;

export function missileFrame(
  kind: "heavy" | "rapid",
  reducedMotion: boolean,
  nowMs: number,
): 0 | 1 {
  return reducedMotion ? 0 : Math.floor(nowMs / MISSILE_FRAME_MS[kind]) % 2 === 0 ? 0 : 1;
}

/**
 * Each missile's flat flame behind its frame (art/weapons.md "Missile and mine frames"): the tail
 * `tail` px behind the nose, an amber wedge `width` px across and its length at heading 14 in
 * flicker frames 0 and 1, with a cream wedge half as wide and half as long.
 */
export const MISSILE_FLAMES = {
  heavy: { length: [16.8, 11.8], tail: 13.2, width: 5.6 },
  rapid: { length: [12, 15], tail: 7, width: 2.6 },
} as const;

/**
 * A missile's flame behind its tail, the nose at `head`, along world `velocity`: the outer wedge
 * in `colours.outer` and the inner one in `colours.inner`, amber and cream for Ada's.
 */
export function missileFlame(
  kind: "heavy" | "rapid",
  head: Vec,
  velocity: Vec,
  frameIndex: 0 | 1,
  colours: { readonly inner: Colour; readonly outer: Colour } = {
    inner: EFFECT_COLOURS.cream,
    outer: EFFECT_COLOURS.amber,
  },
): PolygonShape[] {
  const { length, tail, width } = MISSILE_FLAMES[kind];
  const at = frame(head, screenAngle(velocity));
  const reach = length[frameIndex] * headingFactor(velocity);
  const wedge = (colour: Colour, across: number, long: number) =>
    polygon(at, colour, 1, [
      [-tail, -across / 2],
      [-(tail + long), 0],
      [-tail, across / 2],
    ]);
  return [wedge(colours.outer, width, reach), wedge(colours.inner, width / 2, reach / 2)];
}

/** One model's frame ids by heading or spin step, shown `width` by `height` about `pivot`. */
export interface SolidFrames {
  readonly height: number;
  readonly ids: readonly string[];
  readonly pivot: Vec;
  readonly width: number;
}

/**
 * The core manifest's missile and mine frames (art/weapons.md "Missile and mine frames"): each
 * missile model by its rows' `projectile`, Ada's `rapidMissile` and `heavyMissile` among them.
 */
export interface WeaponSolids {
  readonly mine: SolidFrames & { readonly blink: readonly string[] };
  readonly missiles: ReadonlyMap<string, SolidFrames>;
}

type Row = Readonly<Record<string, unknown>>;

/**
 * Reads the missile and mine frames from the core manifest's assets: each model's frames by
 * heading or spin step, numbered from 0 without gaps, with one display size per model and as
 * many blinking mine frames as lit ones. Undefined when any model's frame is missing or
 * malformed, or Ada's missiles or the mine are absent.
 */
export function readWeaponSolids(assets: readonly object[]): WeaponSolids | undefined {
  const model = (
    member: (row: Row) => boolean,
    index: (row: Row) => unknown,
  ): SolidFrames | undefined => {
    const rows = (assets as readonly Row[]).filter(member);
    const count = rows.length;
    const ids: (string | undefined)[] = Array.from({ length: count }, () => undefined);
    let size: Omit<SolidFrames, "ids"> | undefined;
    for (const row of rows) {
      const at = index(row);
      const { displayHeight: height, displayWidth: width, id } = row;
      const pivot = row.pivot as Partial<Vec> | undefined;
      if (
        typeof id !== "string" ||
        typeof at !== "number" ||
        !Number.isInteger(at) ||
        at < 0 ||
        at >= count ||
        ids[at] !== undefined ||
        typeof width !== "number" ||
        typeof height !== "number" ||
        !(width > 0 && height > 0) ||
        typeof pivot?.x !== "number" ||
        typeof pivot.y !== "number" ||
        (size !== undefined &&
          (size.width !== width ||
            size.height !== height ||
            size.pivot.x !== pivot.x ||
            size.pivot.y !== pivot.y))
      ) {
        return undefined;
      }
      ids[at] = id;
      size = { height, pivot: { x: pivot.x, y: pivot.y }, width };
    }
    const complete = ids.filter((id): id is string => id !== undefined);
    return size && complete.length === count ? { ...size, ids: complete } : undefined;
  };
  const missile = (projectile: string) =>
    model(
      (row) => row.projectile === projectile,
      (row) => row.directionIndex,
    );
  const mine = (blink: boolean) =>
    model(
      (row) => row.projectile === "mine" && row.blink === blink,
      (row) => row.spinIndex,
    );
  const names = new Set(
    (assets as readonly Row[]).flatMap(({ projectile }) =>
      typeof projectile === "string" && projectile !== "mine" ? [projectile] : [],
    ),
  );
  const missiles = new Map<string, SolidFrames>();
  for (const name of names) {
    const frames = missile(name);
    if (!frames) {
      return undefined;
    }
    missiles.set(name, frames);
  }
  const lit = mine(false);
  const blink = mine(true);
  return missiles.has("rapidMissile") &&
    missiles.has("heavyMissile") &&
    lit &&
    blink &&
    blink.ids.length === lit.ids.length
    ? { mine: { ...lit, blink: blink.ids }, missiles }
    : undefined;
}

/** Ada's missile models by kind. */
export const ADA_MISSILES = { heavy: "heavyMissile", rapid: "rapidMissile" } as const;

/**
 * A missile model's frame for its world `velocity`, the nearest of its headings, with the
 * model's display size; undefined without that model.
 */
export function missileSolid(
  solids: WeaponSolids,
  projectile: string,
  velocity: Vec,
): (Omit<SolidFrames, "ids"> & { readonly id: string }) | undefined {
  const frames = solids.missiles.get(projectile);
  return frames && { ...frames, id: frames.ids[shipDirection(frames.ids.length, velocity)]! };
}

/** The mine's frame id for spin step `step`, which the frame count wraps. */
export function mineSolid(solids: WeaponSolids, step: number, blink: boolean): string {
  const ids = blink ? solids.mine.blink : solids.mine.ids;
  return ids[((step % ids.length) + ids.length) % ids.length]!;
}

// ---------------------------------------------------------------------------------------------
// Missile blasts

/**
 * The blast every missile contact shares (art/weapons.md "Blast"), in ms and px: the envelope
 * `r = R (1 - (1 - g)^3)` for `g = min(1, t / growMs)`, ending at `totalMs`; each alpha holds
 * its value until the step's end. Reduced motion holds the ring at `R` with the same steps.
 */
export const BLAST = {
  debris: {
    count: 8,
    from: 3.5,
    startDeg: 22.5,
    steps: [
      [108, 1],
      [220, 0.6],
    ],
    to: 10,
    width: 3.2,
  },
  flash: {
    core: 0.3,
    cream: 0.66,
    points: 8,
    radius: 0.425,
    steps: [
      [30, 1],
      [60, 0.55],
    ],
    turnDeg: 22.5,
    waist: 0.62,
  },
  growMs: 180,
  inner: { from: 6, inset: 2.2, stroke: 1.2 },
  reduced: { ms: 300, stroke: 3 },
  ring: {
    last: 0.33,
    steps: [
      [180, 1],
      [260, 0.66],
    ],
    stroke: [4, 2],
  },
  totalMs: 340,
} as const;

/** How long a blast draws, the longer of its full and reduced effects. */
export const BLAST_SECONDS = Math.max(BLAST.totalMs, BLAST.reduced.ms) / 1000;

// A ground-plane circle of world radius r draws as this ellipse about the impact point.
const ground = (at: Vec, r: number) => ({
  at,
  halfHeight: r * Math.SQRT1_2,
  halfWidth: r * Math.SQRT2,
});
// A missile blast is a circle on screen of radius r px about the blast point.
const circle = (at: Vec, r: number) => ({ at, halfHeight: r, halfWidth: r });

/**
 * A missile blast `t` ms after detonation at screen point `at`, an on-screen circle of radius
 * `R` px: the amber ring and its cream inner line, eight cream debris wedges and one flash of
 * an amber and a cream eight-point burst over a white core, played once; under reduced motion
 * a still ring at `R`.
 */
export function blast(at: Vec, radius: number, reducedMotion: boolean, t: number): EffectShape[] {
  const { amber, cream, white } = EFFECT_COLOURS;
  const { debris, flash, inner, reduced, ring } = BLAST;
  const ringAlpha = heldAlpha(t, ring.steps, ring.last);
  if (reducedMotion) {
    return t >= reduced.ms
      ? []
      : [
          {
            ...circle(at, radius),
            alpha: ringAlpha,
            colour: amber,
            kind: "ellipse",
            part: "ring",
            stroke: reduced.stroke,
          },
        ];
  }
  if (t >= BLAST.totalMs) {
    return [];
  }
  const g = Math.min(1, t / BLAST.growMs);
  const r = Math.max(0.5, radius * (1 - (1 - g) ** 3));
  const shapes: EffectShape[] = [
    {
      ...circle(at, r),
      alpha: ringAlpha,
      colour: amber,
      kind: "ellipse",
      part: "ring",
      stroke: ring.stroke[0] + ((ring.stroke[1] - ring.stroke[0]) * t) / BLAST.totalMs,
    },
  ];
  if (r > inner.from) {
    shapes.push({
      ...circle(at, r - inner.inset),
      alpha: ringAlpha,
      colour: cream,
      kind: "ellipse",
      stroke: inner.stroke,
    });
  }
  const debrisAlpha = heldAlpha(t, debris.steps, 0);
  if (debrisAlpha > 0) {
    for (let index = 0; index < debris.count; index++) {
      shapes.push(
        radialWedge(
          at,
          degrees(debris.startDeg + (360 * index) / debris.count),
          r + debris.from,
          r + debris.to,
          debris.width,
          cream,
          debrisAlpha,
        ),
      );
    }
  }
  const size = flash.steps.find(([until]) => t < until)?.[1];
  if (size !== undefined) {
    const outer = radius * flash.radius * size;
    shapes.push(
      { ...burst(at, 0, flash.points, outer, flash.waist, amber, 1), part: "flash" },
      {
        ...burst(
          at,
          degrees(flash.turnDeg),
          flash.points,
          outer * flash.cream,
          flash.waist,
          cream,
          1,
        ),
        part: "flash",
      },
      { alpha: 1, at, colour: white, kind: "disc", radius: outer * flash.core },
    );
  }
  return shapes;
}

// ---------------------------------------------------------------------------------------------
// Beams

export const BEAM_MS = BEAM.flashSeconds * 1000;
export const SPARK_MS = BEAM.sparkSeconds * 1000;

/** The beam's width factor and alpha keys over its flash. */
const BEAM_KEYS = [
  { a: 0.85, ms: 0, w: 0.55 },
  { a: 1, ms: 20, w: 1 },
  { a: 1, ms: 70, w: 1 },
  { a: 0, ms: BEAM_MS, w: 0.4 },
] as const;
/** A miss tapers every band to a point over its last this many px. */
export const BEAM_MISS_FADE = 28;

/** The beam's width factor `w` and alpha `a` at `t` ms, linear between keys. */
export function beamKeys(t: number): { a: number; w: number } {
  const next = BEAM_KEYS.findIndex(({ ms }) => ms > t);
  if (next === -1) {
    return { a: 0, w: BEAM_KEYS[BEAM_KEYS.length - 1]!.w };
  }
  if (next === 0) {
    return { a: BEAM_KEYS[0].a, w: BEAM_KEYS[0].w };
  }
  const from = BEAM_KEYS[next - 1]!;
  const to = BEAM_KEYS[next]!;
  const k = (t - from.ms) / (to.ms - from.ms);
  return { a: from.a + (to.a - from.a) * k, w: from.w + (to.w - from.w) * k };
}

/**
 * A held fade (art/weapons.md "Conventions"): while a linear fade's value is over a step's
 * threshold it draws at that step's alpha, the first such step, and below them all at `last`.
 */
export interface HeldFade {
  readonly last: number;
  readonly steps: readonly (readonly [number, number])[];
}

/** The held fade of Ada's effects: alpha 1 over 0.6, 0.6 over 0.3, then 0.3. */
export const HELD_FADE: HeldFade = {
  last: 0.3,
  steps: [
    [0.6, 1],
    [0.3, 0.6],
  ],
};

/** The alpha of a linear fade at value `x`, from 1 down to 0, by the held fade. */
export function heldFade(x: number, fade: HeldFade = HELD_FADE): number {
  return fade.steps.find(([threshold]) => x > threshold)?.[1] ?? fade.last;
}

/**
 * An opaque beam band from `from` along screen `angle` for `length` px, its width running from
 * `widths[0]` at the nose to `widths[1]` at the end, with butt ends; a miss tapers it to a
 * point over its last `taper` px.
 */
export function beamBand(
  from: Vec,
  angle: number,
  length: number,
  widths: readonly [number, number],
  taper: number,
  colour: Colour,
  alpha: number,
): PolygonShape {
  const width = (u: number) => widths[0] + ((widths[1] - widths[0]) * u) / length;
  const side = (u: number, sign: number) => [u, (sign * width(u)) / 2] as const;
  const end = length - taper;
  return polygon(
    frame(from, angle),
    colour,
    alpha,
    taper > 0
      ? [side(0, -1), side(end, -1), [length, 0], side(end, 1), side(0, 1)]
      : [side(0, -1), side(length, -1), side(length, 1), side(0, 1)],
  );
}

/** A beam's opaque bands, nose and end widths in px times `w`, and its bloom discs, outermost first. */
export interface BeamBands {
  readonly bloom: readonly { readonly colour: Colour; readonly radius: number }[];
  readonly layers: readonly {
    readonly colour: Colour;
    readonly width: readonly [number, number];
  }[];
}

/** What an effect draws and the shapes a field edge grows beneath. */
export interface EdgedShapes {
  readonly edged: readonly EffectShape[];
  readonly shapes: readonly EffectShape[];
}

/**
 * A beam from `from` to `to` on screen: its bands at width factor `w` and one `alpha`, tapering
 * over the last `taper` px, then its bloom discs when `bloom`. The outermost band and bloom disc
 * take the field edge.
 */
export function flatBeam(
  bands: BeamBands,
  from: Vec,
  to: Vec,
  taper: number,
  w: number,
  alpha: number,
  bloom: boolean,
): EdgedShapes {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length === 0) {
    return { edged: [], shapes: [] };
  }
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const layers = bands.layers.map(({ colour, width }) =>
    beamBand(
      from,
      angle,
      length,
      [width[0] * w, width[1] * w],
      Math.min(taper, length),
      colour,
      alpha,
    ),
  );
  const discs: DiscShape[] = bloom
    ? bands.bloom.map(({ colour, radius }) => ({
        alpha,
        at: from,
        colour,
        kind: "disc",
        radius: radius * w,
      }))
    : [];
  return {
    edged: [...layers.slice(0, 1), ...discs.slice(0, 1)],
    shapes: [...layers, ...discs],
  };
}

/** Ada's Phaser: amber 8 to 5, cream 4.6 to 2.8 and white 2.2 to 1.3, blooms 5, 3.1 and 1.6. */
export const PHASER_BANDS: BeamBands = {
  bloom: [
    { colour: EFFECT_COLOURS.amber, radius: 5 },
    { colour: EFFECT_COLOURS.cream, radius: 3.1 },
    { colour: EFFECT_COLOURS.white, radius: 1.6 },
  ],
  layers: [
    { colour: EFFECT_COLOURS.amber, width: [8, 5] },
    { colour: EFFECT_COLOURS.cream, width: [4.6, 2.8] },
    { colour: EFFECT_COLOURS.white, width: [2.2, 1.3] },
  ],
};

/** Reduced motion holds a beam's alpha this long, then fades it by the held fade. */
const BEAM_REDUCED_HOLD_MS = 90;

/**
 * Ada's Phaser beam `t` ms after firing, from the screen nose point to the contact (hit) or the
 * level's full range (miss): its bands and bloom keyed by `w` and the held fade of `a`; under
 * reduced motion its bands at `w` 1 without bloom, alpha 1 to 90 ms, then the held fade. The
 * amber band and bloom disc take the field edge.
 */
export function beam(
  from: Vec,
  to: Vec,
  hit: boolean,
  reducedMotion: boolean,
  t: number,
): EdgedShapes {
  if (t < 0 || t >= BEAM_MS) {
    return { edged: [], shapes: [] };
  }
  const taper = hit ? 0 : BEAM_MISS_FADE;
  if (reducedMotion) {
    const hold = BEAM_REDUCED_HOLD_MS;
    const alpha = heldFade(t <= hold ? 1 : 1 - (t - hold) / (BEAM_MS - hold));
    return flatBeam(PHASER_BANDS, from, to, taper, 1, alpha, false);
  }
  const { a, w } = beamKeys(t);
  return flatBeam(PHASER_BANDS, from, to, taper, w, heldFade(a), true);
}

// ---------------------------------------------------------------------------------------------
// Hit sparks and contacts

/**
 * The hit spark (art/weapons.md "Hit spark") in logical px before its family's scale: six ray
 * wedges about the incoming axis, a white core and three amber fleck diamonds.
 */
const SPARK = {
  core: { radius: 3, rest: 0.5, untilP: 0.35 },
  flecks: { degrees: [60, 180, 300], distance: 6, fromP: 0.2, reach: 5, size: 3 },
  rays: {
    base: 2.6,
    degrees: [30, 90, 150, 210, 270, 330],
    from: [1.5, 5],
    to: [8.5, 3],
    untilP: 0.6,
    whiteUntilP: 0.25,
  },
} as const;

/** A four-point burst's notches sit at this share of its tips, as the quantum jump star's do. */
const FOUR_POINT_WAIST = 0.3;

/**
 * The beam's hit spark `t` ms after a hit, centred on the contact and turned to the incoming
 * screen angle: ray wedges, core and fleck diamonds; under reduced motion a still cream ring of
 * radius 3 and width 2 at the held fade.
 */
export function spark(at: Vec, angle: number, reducedMotion: boolean, t: number): EffectShape[] {
  if (t >= SPARK_MS) {
    return [];
  }
  const p = t / SPARK_MS;
  const { amber, cream, white } = EFFECT_COLOURS;
  if (reducedMotion) {
    return [
      {
        alpha: heldFade(1 - p),
        at,
        colour: cream,
        halfHeight: 3,
        halfWidth: 3,
        kind: "ellipse",
        stroke: 2,
      },
    ];
  }
  const shapes: EffectShape[] = [];
  const { core, flecks, rays } = SPARK;
  if (p < rays.untilP) {
    const k = p / rays.untilP;
    for (const ray of rays.degrees) {
      shapes.push(
        radialWedge(
          at,
          angle + degrees(ray),
          rays.from[0] + rays.from[1] * k,
          rays.to[0] + rays.to[1] * k,
          rays.base,
          p < rays.whiteUntilP ? white : cream,
          k < 0.5 ? 1 : 0.6,
        ),
      );
    }
  }
  if (p < core.untilP) {
    shapes.push({
      alpha: 1,
      at,
      colour: white,
      kind: "disc",
      radius: core.radius * (1 - p / core.untilP) + core.rest,
    });
  }
  if (p >= flecks.fromP) {
    const m = (p - flecks.fromP) / (1 - flecks.fromP);
    const half = flecks.size / 2;
    for (const fleck of flecks.degrees) {
      const direction = angle + degrees(fleck);
      const centre = frame(at, direction)(flecks.distance + flecks.reach * (1 - (1 - m) ** 2), 0);
      shapes.push(
        polygon(frame(centre, direction), amber, m < 0.5 ? 1 : 0.5, [
          [half, 0],
          [0, -half],
          [-half, 0],
          [0, half],
        ]),
      );
    }
  }
  return shapes;
}

/** Presentation coefficients only; no collision or weapon tuning is derived here. */
export const IMPACT_STYLE = {
  compact: { alpha: 0.8, duration: 0.8, scale: 0.75 },
  compactBright: { alpha: 1, duration: 1, scale: 0.75 },
  lance: { duration: 1 },
  pellet: { alpha: 0.8, duration: 0.4, scale: 0.35 },
  ripple: { duration: 1, radius: 12 },
  shockwave: { duration: 1.8, inner: 0.55, radius: 16 },
} as const;

function scaleImpact(at: Vec, scale: number, alpha: number, shape: EffectShape): EffectShape {
  const point = (p: Vec): Vec => ({
    x: at.x + (p.x - at.x) * scale,
    y: at.y + (p.y - at.y) * scale,
  });
  if (shape.kind === "line") {
    return {
      ...shape,
      alpha: shape.alpha * alpha,
      from: point(shape.from),
      to: point(shape.to),
      width: shape.width * scale,
    };
  }
  if (shape.kind === "disc") {
    return {
      ...shape,
      alpha: shape.alpha * alpha,
      at: point(shape.at),
      radius: shape.radius * scale,
    };
  }
  if (shape.kind === "ellipse") {
    return {
      ...shape,
      alpha: shape.alpha * alpha,
      at: point(shape.at),
      halfHeight: shape.halfHeight * scale,
      halfWidth: shape.halfWidth * scale,
      ...(shape.stroke === undefined ? {} : { stroke: shape.stroke * scale }),
    };
  }
  if (shape.kind === "polygon") {
    return { ...shape, alpha: shape.alpha * alpha, points: shape.points.map(point) };
  }
  return {
    ...shape,
    head: {
      ...shape.head,
      alpha: shape.head.alpha * alpha,
      at: point(shape.head.at),
      width: shape.head.width * scale,
    },
    tail: {
      ...shape.tail,
      alpha: shape.tail.alpha * alpha,
      at: point(shape.tail.at),
      width: shape.tail.width * scale,
    },
  };
}

/** Held alpha steps for a contact ring: 1 to 0.5 of its life, 0.6 to 0.78, then 0.3. */
const CONTACT_RING_STEPS = [
  [0.5, 1],
  [0.78, 0.6],
] as const;

const PHASER_CONTACT_RINGS = [
  { colour: EFFECT_COLOURS.cream, peak: 1, start: 0 },
  { colour: EFFECT_COLOURS.amber, peak: 0.85, start: 26 },
  { colour: EFFECT_COLOURS.cream, peak: 0.72, start: 52 },
] as const;

function phaserContactRings(at: Vec, reducedMotion: boolean, age: number): EllipseShape[] {
  if (reducedMotion) {
    return age < 136
      ? [
          {
            ...circle(at, 5.5),
            alpha: 0.95 * Math.min(1, (136 - age) / 88),
            colour: EFFECT_COLOURS.cream,
            kind: "ellipse",
            stroke: 1.75,
          },
        ]
      : [];
  }
  const rings: EllipseShape[] = [];
  for (const { colour, peak, start } of PHASER_CONTACT_RINGS) {
    const elapsed = age - start;
    if (elapsed >= 0 && elapsed < 108) {
      rings.push({
        ...circle(at, 2.75 + (14.25 * elapsed) / 108),
        alpha: peak * Math.min(1, (108 - elapsed) / 92),
        colour,
        kind: "ellipse",
        stroke: 1.5,
      });
    }
  }
  return rings;
}

/**
 * The ring burst's contact ripple from enemy-weapons.json: its colour, its stroke from the start
 * to the end of its life and its still reduced-motion stroke, at `fade`.
 */
export interface RippleArt {
  readonly colour: Colour;
  readonly fade: HeldFade;
  readonly reducedStroke: number;
  readonly stroke: readonly [number, number];
}

/**
 * The procedural shapes for a contact; projects direction once and never infers family. A
 * ripple draws only with the enemy weapons' `ripple` art.
 */
export function impactEffect(
  context: { readonly at: Vec; readonly reducedMotion: boolean; readonly ripple?: RippleArt },
  impact: Pick<WeaponImpact, "age" | "blastRadius" | "direction" | "family">,
): EffectShape[] {
  const { at, reducedMotion, ripple } = context;
  const t = impact.age * 1000;
  if (!Number.isFinite(t) || t < 0) {
    return [];
  }
  if (impact.family === "missile") {
    return impact.blastRadius !== undefined && impact.blastRadius > 0
      ? blast(at, impact.blastRadius, reducedMotion, t)
      : [];
  }
  if (impact.family === "phaserRings") {
    return phaserContactRings(at, reducedMotion, t);
  }
  const angle = impact.direction ? screenAngle(impact.direction) : 0;
  if (
    impact.family === "compact" ||
    impact.family === "compactBright" ||
    impact.family === "pellet"
  ) {
    const style = IMPACT_STYLE[impact.family];
    return spark(at, angle, reducedMotion, t / style.duration).map((shape) =>
      scaleImpact(at, style.scale, style.alpha, shape),
    );
  }
  if (impact.family === "lance") {
    const p = t / (SPARK_MS * IMPACT_STYLE.lance.duration);
    if (!impact.direction || p >= 1) {
      return [];
    }
    if (reducedMotion) {
      return spark(at, angle, true, t);
    }
    // A white dart along the incoming direction under a cream four-point burst, both shrinking.
    const a = 1 - p;
    const alpha = p < 0.5 ? 1 : 0.6;
    return [
      polygon(frame(at, angle), EFFECT_COLOURS.white, alpha, [
        [-20 * a, 0],
        [0, -2.2 * a],
        [4 * a, 0],
        [0, 2.2 * a],
      ]),
      burst(at, angle, 4, 4.5 * a, FOUR_POINT_WAIST, EFFECT_COLOURS.cream, alpha),
    ];
  }
  if (impact.family === "ripple") {
    const style = IMPACT_STYLE.ripple;
    const p = t / (SPARK_MS * style.duration);
    if (!ripple || p >= 1) {
      return [];
    }
    const radius = (impact.blastRadius ?? style.radius) * (reducedMotion ? 1 : 0.2 + 0.8 * p);
    const [from, to] = ripple.stroke;
    return [
      {
        ...ground(at, radius),
        alpha: heldFade(1 - p, ripple.fade),
        colour: ripple.colour,
        kind: "ellipse",
        part: "ring",
        stroke: reducedMotion ? ripple.reducedStroke : from + (to - from) * p,
      },
    ];
  }
  if (impact.family === "shockwave") {
    // An amber ground ring thinning from 2.4 px over a cream ellipse 0.55 of its size until
    // p 0.6; reduced motion holds both at the full radius.
    const style = IMPACT_STYLE.shockwave;
    const p = t / (SPARK_MS * style.duration);
    if (p >= 1) {
      return [];
    }
    const radius = (impact.blastRadius ?? style.radius) * (reducedMotion ? 1 : 0.2 + 0.8 * p);
    const shapes: EffectShape[] = [
      {
        ...ground(at, radius),
        alpha: heldAlpha(p, CONTACT_RING_STEPS, 0.3),
        colour: EFFECT_COLOURS.amber,
        kind: "ellipse",
        part: "ring",
        stroke: 2.4 - 1.2 * p,
      },
    ];
    if (p < 0.6) {
      shapes.push({
        ...ground(at, radius * style.inner),
        alpha: p < 0.3 ? 1 : 0.6,
        colour: EFFECT_COLOURS.cream,
        kind: "ellipse",
      });
    }
    return shapes;
  }
  return [];
}
