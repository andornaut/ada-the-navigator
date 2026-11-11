import { WEAPON_CATALOG } from "../data/weapon-catalog.ts";
import type { Vec } from "../model/types.ts";

// Art's weapon effects (art/weapons.md) as screen-space shapes in logical px, for the scene to
// fill and stroke. Each shape is a plain record, so the geometry and timing are testable.

/** Art's effect colours: amber is the space palette's `weapon`. */
export const EFFECT_COLOURS = {
  amber: 0xf0bd68,
  cream: 0xead4aa,
  ink: 0x181425,
  white: 0xffffff,
} as const;
type Colour = number;

/** A filled polygon at one alpha. */
export interface PolygonShape {
  readonly alpha: number;
  readonly colour: Colour;
  readonly kind: "polygon";
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
 * An axis-aligned ellipse, filled or stroked at `stroke` px. A blast marks its ring stroke and
 * flash layers by `part`, which a light field edges in ink.
 */
export interface EllipseShape {
  readonly alpha: number;
  readonly at: Vec;
  readonly colour: Colour;
  readonly halfHeight: number;
  readonly halfWidth: number;
  readonly kind: "ellipse";
  readonly part?: "flash" | "ring";
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
const mirror = (points: readonly (readonly [number, number])[]) =>
  points.map(([u, v]) => [u, -v] as const);

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

/** The Rapid Missile: a white dart with amber fins and a long thin amber streak. */
export function rapidMissile(head: Vec, velocity: Vec, frameIndex: 0 | 1): EffectShape[] {
  const at = frame(head, screenAngle(velocity));
  const f = headingFactor(velocity);
  const { amber, cream, white } = EFFECT_COLOURS;
  const streakTail = -(6 + (frameIndex === 0 ? 20 : 23) * f);
  const fin = [
    [-4.6, -1.2],
    [-7.6, -2.8],
    [-7.6, -1.2],
  ] as const;
  const polygon = (colour: Colour, points: readonly (readonly [number, number])[]) =>
    ({
      alpha: 1,
      colour,
      kind: "polygon",
      points: points.map(([u, v]) => at(u, v)),
    }) as const;
  return [
    {
      colour: amber,
      head: { alpha: 0.85, at: at(-6, 0), width: 1.6 },
      kind: "taper",
      tail: { alpha: 0, at: at(streakTail, 0), width: 0.5 },
    },
    {
      colour: cream,
      head: { alpha: 0.9, at: at(-6, 0), width: 1 },
      kind: "taper",
      tail: { alpha: 0, at: at(-(6 + 6 * f), 0), width: 0.4 },
    },
    polygon(amber, fin),
    polygon(amber, mirror(fin)),
    polygon(white, [
      [0, 0],
      [-2.2, -1.2],
      [-7, -1.2],
      [-7, 1.2],
      [-2.2, 1.2],
    ]),
  ];
}

/** The Heavy Missile: a fat white body, amber warhead, cream band and fins, ink keyline, plume. */
export function heavyMissile(head: Vec, velocity: Vec, frameIndex: 0 | 1): EffectShape[] {
  const at = frame(head, screenAngle(velocity));
  const f = headingFactor(velocity);
  const { amber, cream, ink, white } = EFFECT_COLOURS;
  const tail = 13.2 + (frameIndex === 0 ? 16.8 : 11.8) * f;
  const polygon = (colour: Colour, points: readonly (readonly [number, number])[]) =>
    ({
      alpha: 1,
      colour,
      kind: "polygon",
      points: points.map(([u, v]) => at(u, v)),
    }) as const;
  const keyFin = [
    [-7.67, -2.53],
    [-14.18, -6.82],
    [-15.4, -6.59],
    [-13.61, -1.99],
  ] as const;
  const fin = [
    [-8.6, -2.9],
    [-13.6, -6],
    [-14.6, -6],
    [-13.2, -2.9],
  ] as const;
  return [
    {
      colour: amber,
      head: { alpha: 0.95, at: at(-13.2, 0), width: 6.4 },
      kind: "taper",
      tail: { alpha: 0, at: at(-tail, 0), width: 0 },
    },
    {
      colour: cream,
      head: { alpha: 1, at: at(-13.2, 0), width: 3.2 },
      kind: "taper",
      tail: { alpha: 0, at: at(-(13.2 + (tail - 13.2) / 2), 0), width: 0 },
    },
    { alpha: 1, at: at(-13.6, 0), colour: white, kind: "disc", radius: 1.6 },
    polygon(ink, [
      [1, 0],
      [-0.65, -2.01],
      [-3.52, -3.63],
      [-12.87, -3.39],
      [-14.14, -2.64],
      [-14.14, 2.64],
      [-12.87, 3.39],
      [-3.52, 3.63],
      [-0.65, 2.01],
    ]),
    polygon(ink, keyFin),
    polygon(ink, mirror(keyFin)),
    polygon(cream, fin),
    polygon(cream, mirror(fin)),
    polygon(white, [
      [0, 0],
      [-1.6, -1.7],
      [-4.2, -2.9],
      [-12, -2.9],
      [-13.2, -2.3],
      [-13.2, 2.3],
      [-12, 2.9],
      [-4.2, 2.9],
      [-1.6, 1.7],
    ]),
    polygon(amber, [
      [0, 0],
      [-1.6, -1.7],
      [-3.6, -2.75],
      [-3.6, 2.75],
      [-1.6, 1.7],
    ]),
    polygon(cream, [
      [-6.4, -2.9],
      [-7.6, -2.9],
      [-7.6, 2.9],
      [-6.4, 2.9],
    ]),
  ];
}

/** Each blast's timing and strokes (art/weapons.md "Missile blasts"), in ms and px. */
export const BLASTS = {
  heavy: {
    debris: 8,
    flashSteps: [
      { q: 0.95, s: 1, toMs: 30 },
      { q: 0.6, s: 0.55, toMs: 60 },
    ],
    growMs: 180,
    kFlash: 0.34,
    reduced: { ms: 300, stroke: 3 },
    ring: [4, 1.5],
    tint: 0.16,
    totalMs: 340,
  },
  rapid: {
    debris: 0,
    flashSteps: [
      { q: 0.95, s: 1, toMs: 20 },
      { q: 0.6, s: 0.55, toMs: 40 },
    ],
    growMs: 110,
    kFlash: 0.42,
    reduced: { ms: 200, stroke: 2 },
    ring: [2.5, 1],
    tint: 0.14,
    totalMs: 220,
  },
} as const;

/** How long a blast draws, the longer of its full and reduced effects. */
export const BLAST_SECONDS = Math.max(BLASTS.heavy.totalMs, BLASTS.heavy.reduced.ms) / 1000;

// A ground-plane circle of world radius r draws as this ellipse about the blast point.
const ground = (at: Vec, r: number) => ({
  at,
  halfHeight: r * Math.SQRT1_2,
  halfWidth: r * Math.SQRT2,
});

/**
 * A missile blast `t` ms after detonation at screen point `at`, world radius `R`: tint, ring,
 * inner line, debris (Heavy) and one flash, played once; under reduced motion, a static ring
 * and tint at `R`, fading.
 */
export function blast(at: Vec, radius: number, reducedMotion: boolean, t: number): EffectShape[] {
  const kind = missileKind(radius);
  const spec = BLASTS[kind];
  const { amber, cream, white } = EFFECT_COLOURS;
  if (reducedMotion) {
    if (t >= spec.reduced.ms) {
      return [];
    }
    const a = 1 - t / spec.reduced.ms;
    return [
      { ...ground(at, radius), alpha: 0.15 * a, colour: amber, kind: "ellipse" },
      {
        ...ground(at, radius),
        alpha: 0.9 * a,
        colour: amber,
        kind: "ellipse",
        part: "ring",
        stroke: spec.reduced.stroke,
      },
    ];
  }
  if (t >= spec.totalMs) {
    return [];
  }
  const g = Math.min(1, t / spec.growMs);
  const r = Math.max(0.5, radius * (1 - (1 - g) ** 3));
  const a = t <= spec.growMs ? 1 : 1 - (t - spec.growMs) / (spec.totalMs - spec.growMs);
  const shapes: EffectShape[] = [
    {
      ...ground(at, r),
      alpha: spec.tint * (1 - t / spec.totalMs) ** 2,
      colour: amber,
      kind: "ellipse",
    },
    {
      ...ground(at, r),
      alpha: a,
      colour: amber,
      kind: "ellipse",
      part: "ring",
      stroke: spec.ring[0] + (spec.ring[1] - spec.ring[0]) * (t / spec.totalMs),
    },
  ];
  if (r > 6) {
    shapes.push({
      ...ground(at, r - 2.2),
      alpha: 0.8 * a,
      colour: cream,
      kind: "ellipse",
      stroke: 1,
    });
  }
  const debrisMs = spec.growMs + 40;
  if (spec.debris && t < debrisMs) {
    for (let i = 0; i < spec.debris; i++) {
      const th = (2 * Math.PI * i) / spec.debris + 0.3;
      const e = { x: Math.SQRT2 * Math.cos(th), y: Math.SQRT1_2 * Math.sin(th) };
      const length = Math.hypot(e.x, e.y);
      const n = { x: e.x / length, y: e.y / length };
      const from = { x: at.x + r * e.x + 3 * n.x, y: at.y + r * e.y + 3 * n.y };
      shapes.push({
        alpha: 1 - t / debrisMs,
        colour: cream,
        from,
        kind: "line",
        round: true,
        to: { x: from.x + 6 * n.x, y: from.y + 6 * n.y },
        width: 1.5,
      });
    }
  }
  const step = spec.flashSteps.find(({ toMs }) => t < toMs);
  if (step) {
    const fr = radius * spec.kFlash * step.s;
    for (const [scale, colour, alpha] of [
      [1.25, amber, 0.3],
      [1, amber, 0.85],
      [0.66, cream, 1],
      [0.36, white, 1],
    ] as const) {
      shapes.push({
        ...ground(at, fr * scale),
        alpha: alpha * step.q,
        colour,
        kind: "ellipse",
        part: "flash",
      });
    }
  }
  return shapes;
}

/** The beam's width factor and alpha keys over its 150 ms flash. */
const BEAM_KEYS = [
  { a: 0.85, ms: 0, w: 0.55 },
  { a: 1, ms: 20, w: 1 },
  { a: 1, ms: 70, w: 1 },
  { a: 0, ms: 150, w: 0.4 },
] as const;
export const BEAM_MS = 150;
/** A miss fades every layer over its last this many px. */
export const BEAM_MISS_FADE = 28;
export const SPARK_MS = 160;

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

// A taper from u0 to u1 along the beam, widths and alphas given at each end, with round caps.
function beamLayer(
  colour: Colour,
  along: (u: number) => Vec,
  length: number,
  widths: readonly [number, number],
  alpha: number,
  fadeLength: number,
): EffectShape[] {
  const width = (u: number) => widths[0] + ((widths[1] - widths[0]) * u) / length;
  const solidEnd = Math.max(0, length - fadeLength);
  const shapes: EffectShape[] = [
    { alpha, at: along(0), colour, kind: "disc", radius: width(0) / 2 },
    {
      colour,
      head: { alpha, at: along(solidEnd), width: width(solidEnd) },
      kind: "taper",
      tail: { alpha, at: along(0), width: width(0) },
    },
  ];
  if (fadeLength > 0) {
    shapes.push({
      colour,
      head: { alpha: 0, at: along(length), width: width(length) },
      kind: "taper",
      tail: { alpha, at: along(solidEnd), width: width(solidEnd) },
    });
  } else {
    shapes.push({ alpha, at: along(length), colour, kind: "disc", radius: width(length) / 2 });
  }
  return shapes;
}

/**
 * The beam's outermost layers, which a light field turns to ink (art/galaxies.md "Light
 * fields"): the glow taper's start and end widths in `w` and alpha in `a`, the bloom's outer disc
 * radius in `w` and alpha in `a`, and the reduced-motion edge's alpha in `a`.
 */
export interface BeamGlow {
  readonly bloom: { readonly alpha: number; readonly radius: number };
  readonly colour: Colour;
  readonly edgeAlpha: number;
  readonly glow: { readonly alpha: number; readonly width: readonly [number, number] };
}

/** The beam's amber glow on a dark field (art/weapons.md "Phaser beam"). */
export const AMBER_BEAM_GLOW: BeamGlow = {
  bloom: { alpha: 0.3, radius: 5 },
  colour: EFFECT_COLOURS.amber,
  edgeAlpha: 0.35,
  glow: { alpha: 0.38, width: [8, 5] },
};

/**
 * The Phaser beam `t` ms after firing, from the screen nose point to the contact (hit) or the
 * level's full range (miss), with its muzzle bloom; under reduced motion a steady line.
 */
export function beam(
  from: Vec,
  to: Vec,
  hit: boolean,
  reducedMotion: boolean,
  t: number,
): EffectShape[] {
  return glowingBeam(AMBER_BEAM_GLOW, from, to, hit, reducedMotion, t);
}

/** The Phaser beam with the given outer glow: amber on a dark field, ink on a light one. */
export function glowingBeam(
  glow: BeamGlow,
  from: Vec,
  to: Vec,
  hit: boolean,
  reducedMotion: boolean,
  t: number,
): EffectShape[] {
  if (t >= BEAM_MS) {
    return [];
  }
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length === 0) {
    return [];
  }
  const at = frame(from, Math.atan2(to.y - from.y, to.x - from.x));
  const along = (u: number) => at(u, 0);
  const fade = hit ? 0 : Math.min(BEAM_MISS_FADE, length);
  const { cream, white } = EFFECT_COLOURS;
  if (reducedMotion) {
    const a = t <= 90 ? 1 : 1 - (t - 90) / (BEAM_MS - 90);
    const steady = (colour: Colour, width: number, alpha: number): EffectShape[] => {
      const solidEnd = length - fade;
      const shapes: EffectShape[] = [
        {
          colour,
          head: { alpha, at: along(solidEnd), width },
          kind: "taper",
          tail: { alpha, at: along(0), width },
        },
      ];
      if (fade > 0) {
        shapes.push({
          colour,
          head: { alpha: 0, at: along(length), width },
          kind: "taper",
          tail: { alpha, at: along(solidEnd), width },
        });
      }
      return shapes;
    };
    return [...steady(glow.colour, 4, glow.edgeAlpha * a), ...steady(cream, 2, a)];
  }
  const { a, w } = beamKeys(t);
  const [start, end] = glow.glow.width;
  return [
    ...beamLayer(glow.colour, along, length, [start * w, end * w], glow.glow.alpha * a, fade),
    ...beamLayer(cream, along, length, [4 * w, 2.4 * w], 0.95 * a, fade),
    ...beamLayer(white, along, length, [1.8 * w, w], a, fade),
    {
      alpha: glow.bloom.alpha * a,
      at: from,
      colour: glow.colour,
      kind: "disc",
      radius: glow.bloom.radius * w,
    },
    { alpha: 0.9 * a, at: from, colour: cream, kind: "disc", radius: 2.9 * w },
    { alpha: a, at: from, colour: white, kind: "disc", radius: 1.6 * w },
  ];
}

const degrees = (value: number) => (value * Math.PI) / 180;
const SPARK_RAYS = [-150, -95, -35, 25, 80, 140].map(degrees);
const SPARK_FLECKS = [-120, -10, 100].map(degrees);

/**
 * The beam's hit spark `t` ms after a hit, centred on the contact and rotated by the beam's
 * screen angle: rays, core and flecks; under reduced motion an unrotated cream ring.
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
        alpha: 1 - p,
        at,
        colour: cream,
        halfHeight: 3,
        halfWidth: 3,
        kind: "ellipse",
        stroke: 1.5,
      },
    ];
  }
  const point = (direction: number, radius: number): Vec => ({
    x: at.x + Math.cos(angle + direction) * radius,
    y: at.y + Math.sin(angle + direction) * radius,
  });
  const shapes: EffectShape[] = [];
  if (p < 0.6) {
    const k = p / 0.6;
    for (const ray of SPARK_RAYS) {
      shapes.push({
        alpha: 1 - 0.6 * k,
        colour: p < 0.25 ? white : cream,
        from: point(ray, 1.5 + 5 * k),
        kind: "line",
        round: true,
        to: point(ray, 7.5 + 3 * k),
        width: 1.5,
      });
    }
  }
  if (p < 0.35) {
    shapes.push({ alpha: 1, at, colour: white, kind: "disc", radius: 3 * (1 - p / 0.35) + 0.5 });
  }
  if (p > 0.2) {
    const m = (p - 0.2) / 0.8;
    for (const fleck of SPARK_FLECKS) {
      shapes.push({
        alpha: 1 - m,
        at: point(fleck, 6 + 5 * (1 - (1 - m) ** 2)),
        colour: amber,
        kind: "disc",
        radius: 1.1,
      });
    }
  }
  return shapes;
}
