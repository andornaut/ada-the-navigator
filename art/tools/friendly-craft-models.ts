// Friendly craft models (art/friendly-redesign.md): the 32 craft as connected solids in mesh
// space (forward +x, port +y, up +z) in display px. A model is built per heading, because a
// rounded part splits its two tones on the light as that heading sees it.
import type { FriendlyManifest } from "./friendly-models.ts";
import { glow, guideBeacon, mat } from "./friendly-models.ts";
import type { Point } from "./projection.ts";
import {
  type Mesh,
  meshBall,
  meshBlock,
  meshBox,
  meshHoop,
  meshLoft,
  meshRing,
  meshScale,
  meshTube,
  type Tones,
} from "./solid.ts";

// Ada's canopy blue and jet blue: every friendly craft carries both.
const GLASS: Tones = ["#2585d0", "#1767b3", "#28558a"];
const JET = glow("#86deff");

type Palette = { body: Tones; trim: Tones; acc: Tones; lamp: Tones };
const slate = mat("#465066", "#333a4c", "#272c3a");
const teal = mat("#2a6676", "#1c4a57", "#123842");
const needleNavy = mat("#3a3f63", "#282c49", "#1b1d30");
const navy = mat("#34376f", "#25275a", "#1a1b3c");
const lilac = mat("#a292c8", "#7e6ea8", "#5f5088");
const SUN: Palette = {
  body: mat("#fff4d6"),
  trim: mat("#6a4630", "#4b3020", "#35211a"),
  acc: mat("#f2a51f", "#c98212", "#a66a0c"),
  lamp: glow("#fff4d6"),
};
const CART: Palette = {
  body: mat("#f3ece1", "#b9b0ae", "#8d8590"),
  trim: slate,
  acc: slate,
  lamp: glow("#ffc43d"),
};
const WH: Palette = {
  body: mat("#f6f1e4", "#c9c3b0", "#a39c88"),
  trim: teal,
  acc: teal,
  lamp: glow("#ff6f4e"),
};
const ND: Palette = {
  body: mat("#f3ecdd", "#c6bca5", "#a0957c"),
  trim: needleNavy,
  acc: needleNavy,
  lamp: glow("#b9a6dc"),
};
const AN: Palette = {
  body: mat("#f4ead3", "#cfc2a4", "#a99c80"),
  trim: navy,
  acc: navy,
  lamp: glow("#ffc43d"),
};
const PH: Palette = {
  body: mat("#f0e9f8", "#c3b6d8", "#a596bf"),
  trim: lilac,
  acc: lilac,
  lamp: glow("#62f0c4"),
};
const SAGE: Palette = { ...CART, body: mat("#a9c29a", "#84a078", "#647c5c") };
const PERIWINKLE: Palette = { ...CART, body: mat("#9aa8e0", "#7684bc", "#586498") };
// The Blocker: chartreuse over mid slate, with white lamps.
const CHARTREUSE: Palette = {
  ...CART,
  body: mat("#c7d63a", "#9caa22", "#74801a"),
  trim: mat("#6a7388", "#525a6e", "#3e4556"),
  lamp: glow("#ffffff"),
};
const SCRAP: Palette = { ...SUN, acc: mat("#9a7b5c", "#775c44", "#574332") };
const SLATE_BLUE: Palette = {
  ...AN,
  body: mat("#8d94c4", "#6c73a4", "#505682"),
  trim: mat("#f4ead3", "#cfc2a4", "#a99c80"),
};
const LAVENDER: Palette = { ...ND, body: mat("#d9cdee", "#b0a2cc", "#8a7ca8") };

// One drive port: the centre of its mouth and its radius.
export type CraftMouth = { at: Point; radius: number };
export type CraftBuild = { mesh: Mesh; mouths: CraftMouth[] };

// A chamfered box section at station `l`: half breadth, bottom, top and chamfer.
type Station = readonly [l: number, half: number, bottom: number, top: number, chamfer: number];
function section([l, half, bottom, top, chamfer]: Station): Point[] {
  const c = Math.min(chamfer, half * 0.8, (top - bottom) * 0.45);
  return [
    [l, -half, bottom + c * 0.5],
    [l, -half + c * 0.5, bottom],
    [l, half - c * 0.5, bottom],
    [l, half, bottom + c * 0.5],
    [l, half, top - c],
    [l, half - c, top],
    [l, -half + c, top],
    [l, -half, top - c],
  ];
}

// An elliptical section at station `l`: half width, half height and centre height.
type Ring = readonly [l: number, half: number, rise: number, centre: number];
const ellipse = ([l, half, rise, centre]: Ring, sides: number): Point[] =>
  Array.from({ length: sides }, (_, i) => {
    const a = (2 * Math.PI * (i + 0.5)) / sides;
    return [l, half * Math.cos(a), centre + rise * Math.sin(a)];
  });

// The solids of one craft, and the light as its heading sees it.
class Yard {
  readonly mesh: Mesh = [];
  readonly mouths: CraftMouth[] = [];
  // The yard hull's deck and roof heights and its cabin: aft end, glass start and half width.
  deck = 0;
  roof = 0;
  cabin: readonly [number, number, number] = [0, 0, 0];
  readonly light: Point;

  constructor(light: Point) {
    this.light = light;
  }

  hull(stations: readonly Station[], tones: Tones): void {
    meshLoft(this.mesh, stations.map(section), tones);
  }

  // Rounded body of elliptical sections.
  body(rings: readonly Ring[], tones: Tones, sides = 8): void {
    meshLoft(
      this.mesh,
      rings.map((ring) => ellipse(ring, sides)),
      tones,
    );
  }

  // Shuttle hull: a chamfered loaf whose nose tapers and slopes down to `nose` of its breadth.
  loaf(
    l0: number,
    l1: number,
    half: number,
    bottom: number,
    top: number,
    tones: Tones,
    chamfer: number,
    taper: number,
    nose: number,
  ): void {
    const rise = top - bottom;
    this.hull(
      [
        [l0, half, bottom, top, chamfer],
        [l1 - taper * (l1 - l0), half, bottom, top, chamfer],
        [l1, half * nose, bottom + rise * 0.12, bottom + rise * 0.6, chamfer * 0.6],
      ],
      tones,
    );
  }

  // Glass blister: level aft, sloping to the nose, sunk into the hull below `z0`.
  canopy(l0: number, l1: number, half: number, z0: number, z1: number, drop = 0.45, c = 1): void {
    const middle = l0 + (l1 - l0) * 0.4;
    this.hull(
      [
        [l0, half, z0 - 2, z1, c],
        [middle, half, z0 - 2, z1, c],
        [l1, half * 0.7, z0 - 2, z1 - (z1 - z0 + 2) * drop, c * 0.7],
      ],
      GLASS,
    );
  }

  box(l0: number, l1: number, w0: number, w1: number, z0: number, z1: number, tones: Tones): void {
    meshBox(this.mesh, [l0, w0, z0], [l1, w1, z1], tones);
  }

  // Drum or cone along the hull from `l0` to `l1`, with radius `r` aft and `r1` forward.
  pod(
    l0: number,
    l1: number,
    w: number,
    z: number,
    r: number,
    tones: Tones,
    options: { r1?: number; sides?: number; aft?: Tones } = {},
  ): void {
    const { r1 = r, sides = 12, aft } = options;
    meshTube(this.mesh, [l0, w, z], [l1, w, z], r, r1, tones, sides, aft ? { cap0: aft } : {});
  }

  // A drive port: a drum whose aft face is jet blue.
  port(l0: number, l1: number, w: number, z: number, r: number, tones: Tones, r1 = r): void {
    this.pod(l0, l1, w, z, r, tones, { r1, sides: 10, aft: JET });
    this.mouths.push({ at: [l0, w, z], radius: r });
  }

  // Upright drum on the vertical axis through (l, w).
  drum(l: number, w: number, z0: number, z1: number, r: number, tones: Tones, sides = 12): void {
    meshTube(this.mesh, [l, w, z0], [l, w, z1], r, r, tones, sides);
  }

  ball(centre: Point, radii: Point, tones: Tones, sides = 24, bands = 12): void {
    meshBall(this.mesh, centre, radii, tones, { sides, bands, light: this.light });
  }

  // A lamp: a half-sunk ball, on a base ring when `base` is given.
  lamp(l: number, w: number, z: number, r: number, tones: Tones, base?: Tones): void {
    if (base) this.drum(l, w, z - 0.6, z + 0.6, r * 1.25, base);
    this.ball([l, w, z + r * 0.5], [r, r, r], tones, 12, 6);
  }

  built(k: number): CraftBuild {
    return {
      mesh: meshScale(this.mesh, [k, k, k]),
      mouths: this.mouths.map(({ at, radius }) => ({
        at: [at[0] * k, at[1] * k, at[2] * k],
        radius: radius * k,
      })),
    };
  }
}

type YardShape = {
  length?: number;
  width?: number;
  height?: number;
  // The cabin's aft and forward ends, as shares of the length from the middle.
  cabin?: readonly [number, number];
  cabinWidth?: number;
  cabinHeight?: number;
  // The share of the length the nose tapers over, and the breadth it tapers to.
  taper?: number;
  nose?: number;
  engine?: number;
  engineWidth?: number;
  glass?: number;
};

// The yard hull, in three tiers: a lower hull with a sloped nose, a full-width stern engine
// block with two jet ports, and a cabin tier with a canopy front.
function yard(light: Point, pal: Palette, shape: YardShape = {}): Yard {
  const {
    length = 28,
    width = 13,
    height = 5.5,
    cabin = [-0.3, 0.24],
    cabinWidth = 0.7,
    cabinHeight = 3.4,
    taper = 0.34,
    nose = 0.5,
    engine = 0.2,
    engineWidth = 1.14,
    glass = 0.5,
  } = shape;
  const m = new Yard(light);
  const [x0, x1, half] = [-length / 2, length / 2, width / 2];
  const deck = 1 + height;
  m.loaf(x0 + engine * length * 0.5, x1, half, 1, deck, pal.body, 2, taper, nose);
  m.hull(
    [
      [x0, half * engineWidth, 0.4, deck - height * 0.12, 2],
      [x0 + engine * length, half * engineWidth, 0.4, deck - height * 0.12, 2],
    ],
    pal.trim,
  );
  for (const side of [1, -1]) {
    m.port(x0 - 1.4, x0 + 2, side * half * 0.52, 0.4 + height * 0.46, height * 0.3, pal.trim);
  }
  const [c0, c1] = [cabin[0] * length, cabin[1] * length];
  const glassStart = c1 - (c1 - c0) * glass;
  const cabinHalf = half * cabinWidth;
  m.hull(
    [
      [c0, cabinHalf, deck - 1, deck + cabinHeight, 1.6],
      [glassStart + 1, cabinHalf, deck - 1, deck + cabinHeight, 1.6],
    ],
    pal.body,
  );
  m.canopy(glassStart, c1, cabinHalf * 0.94, deck, deck + cabinHeight, 0.5, 1.5);
  m.deck = deck;
  m.roof = deck + cabinHeight;
  m.cabin = [c0, glassStart, cabinHalf];
  return m;
}

type Model = (light: Point, lit: boolean) => CraftBuild;

// Courier: the yard hull, short and broad, with one roof lamp, or a second canopy for two.
const courier =
  (pal: Palette, k: number, feature: "lamp" | "none" | "tandem" = "lamp"): Model =>
  (light) => {
    const tandem = feature === "tandem";
    const m = yard(light, pal, {
      glass: tandem ? 0.42 : 0.5,
      cabin: tandem ? [-0.34, 0.24] : [-0.3, 0.24],
    });
    const [c0, glassStart, half] = m.cabin;
    if (tandem) {
      m.hull(
        [
          [c0 + 1.2, half * 0.72, m.roof - 1, m.roof + 1.6, 1.2],
          [glassStart - 1.5, half * 0.72, m.roof - 1, m.roof + 1.6, 1.2],
        ],
        GLASS,
      );
    } else if (feature === "lamp") {
      m.lamp((c0 + glassStart) / 2, 0, m.roof, 1.8, pal.lamp, pal.trim);
    }
    return m.built(k);
  };

// Passenger shuttle: a long cabin tier with one window band.
const visitor =
  (pal: Palette): Model =>
  (light) => {
    const m = yard(light, pal, {
      length: 31,
      cabin: [-0.36, 0.3],
      cabinHeight: 4.2,
      glass: 0.3,
      taper: 0.26,
      nose: 0.62,
    });
    const [c0, glassStart, half] = m.cabin;
    m.box(c0 + 2, glassStart - 1, -half - 0.4, half + 0.4, m.deck + 1.2, m.deck + 3, GLASS);
    return m.built(1);
  };

// The Blocker: a broad blunt hull, an oversized engine tier and two white high beams.
const blocker: Model = (light) => {
  const pal = CHARTREUSE;
  const m = yard(light, pal, {
    length: 30,
    width: 18,
    height: 6.5,
    cabin: [-0.2, 0.2],
    cabinWidth: 0.6,
    cabinHeight: 3.6,
    taper: 0.2,
    nose: 0.82,
    engine: 0.36,
    engineWidth: 1.18,
  });
  for (const side of [1, -1]) m.lamp(11.5, side * 5.6, m.deck - 0.4, 2, pal.lamp, pal.trim);
  return m.built(0.95);
};

// Ore hauler: an engine block, two open side bins on a keel, a cab, and one blunt drill cone on
// a collar.
const hauler =
  (drill: boolean): Model =>
  (light) => {
    const pal = CART;
    const m = new Yard(light);
    const a = -23;
    m.hull(
      [
        [a, 9.5, 1, 10, 2.2],
        [a + 9, 9.5, 1, 10, 2.2],
      ],
      pal.trim,
    );
    for (const side of [1, -1]) m.port(a - 1.6, a + 3, side * 4.6, 5.5, 3.2, pal.trim);
    m.box(a + 8, 6, -3.2, 3.2, 2.5, 7.5, pal.trim);
    for (const side of [1, -1]) {
      m.box(a + 10.5, 4, side * 3, side * 11.5, 1.5, 8.5, pal.body);
      m.box(a + 12, 2.5, side * 4.5, side * 10, 8, 9, pal.acc);
    }
    m.loaf(5, 17, 6.5, 1.5, 9.5, pal.body, 2, 0.4, 0.8);
    m.canopy(6.5, 13.5, 4.4, 8.6, 11);
    if (drill) {
      m.pod(16, 23, 0, 4.8, 5, pal.trim, { r1: 2.2, sides: 10 });
      m.pod(15, 16.8, 0, 4.8, 5.8, pal.lamp, { sides: 10 });
    }
    return m.built(1);
  };

// Freighter: one long cargo hold in two stepped tiers, a cab at the bow and an engine block at
// the stern. The short one carries a single tier.
const barge =
  (pal: Palette, k: number, short = false): Model =>
  (light) => {
    const length = short ? 34 : 46;
    const m = yard(light, pal, {
      length,
      cabin: short ? [0.14, 0.4] : [0.22, 0.42],
      cabinWidth: 0.72,
      taper: 0.2,
      glass: 0.6,
      engine: 0.16,
    });
    const x0 = -length / 2;
    const hold = length * (short ? 0.12 : 0.2);
    m.hull(
      [
        [x0 + length * 0.14, 7.6, 0.6, 9.6, 2.4],
        [hold, 7.6, 0.6, 9.6, 2.4],
      ],
      pal.acc,
    );
    if (!short) {
      m.hull(
        [
          [x0 + length * 0.22, 5.2, 9, 12.4, 2],
          [hold - length * 0.16, 5.2, 9, 12.4, 2],
        ],
        pal.acc,
      );
    }
    return m.built(k);
  };

// Needle's slim yard hull, with one feature per craft: a long cabin with one window band, a
// lamp drum on the roof, or a blunt nose behind one bumper block.
const glider =
  (pal: Palette, k: number, feature: "cabin" | "lamp" | "bumper"): Model =>
  (light) => {
    const slim = { width: 8.5, height: 4.6, cabinWidth: 0.74, cabinHeight: 2.8 };
    const stern = { engine: 0.22, engineWidth: 1.3 };
    if (feature === "bumper") {
      const m = yard(light, pal, {
        ...slim,
        ...stern,
        length: 30,
        cabin: [-0.26, 0.2],
        taper: 0.12,
        nose: 0.9,
      });
      m.hull(
        [
          [14, 5.6, 0.4, 6.4, 2],
          [17.5, 5.6, 0.4, 6.4, 2],
        ],
        pal.trim,
      );
      return m.built(k);
    }
    const long = feature === "cabin";
    const m = yard(light, pal, {
      ...slim,
      ...stern,
      length: 33,
      cabin: long ? [-0.34, 0.2] : [-0.26, 0.2],
      glass: long ? 0.3 : 0.5,
      taper: 0.46,
      nose: 0.42,
    });
    const [c0, glassStart, half] = m.cabin;
    if (long) {
      m.box(c0 + 1.5, glassStart - 0.5, -half - 0.35, half + 0.35, m.deck + 0.8, m.deck + 2, GLASS);
    } else {
      const l = (c0 + glassStart) / 2;
      m.drum(l, 0, m.roof - 0.5, m.roof + 2.6, 2.4, pal.trim);
      m.lamp(l, 0, m.roof + 2.6, 1.7, pal.lamp);
    }
    return m.built(k);
  };

// Current skimmer: a flat rounded hull, a canopy and one stern drum, with buoys on deck for the
// tender.
const skimmer =
  (k: number, cargo = 0): Model =>
  (light) => {
    const pal = WH;
    const m = new Yard(light);
    m.body(
      [
        [-13, 4.5, 2.2, 4],
        [-7, 7.5, 3.2, 4],
        [3, 7.5, 3.2, 4],
        [11, 4.5, 2.4, 4],
        [14.5, 2.2, 1.4, 4],
      ],
      pal.body,
    );
    m.canopy(0, 10, 3.6, 6.2, 8.6);
    m.pod(-16, -9, 0, 4.4, 3.6, pal.trim, { aft: JET });
    m.mouths.push({ at: [-16, 0, 4.4], radius: 3.6 });
    for (const w of [-3.6, 3.6].slice(0, cargo)) {
      m.drum(-6.5, w, 6.4, 9.4, 2.6, pal.trim);
      m.lamp(-6.5, w, 9.4, 1.7, pal.lamp);
    }
    return m.built(k);
  };

type PodFeature = "petals" | "wheel" | "drum" | "needle" | "y" | "dome";

// Lifeboat: one rounded capsule, one window band, a stern port, a distress lamp and one feature
// of its galaxy. The Grower's carries a garden dome in place of the lamp.
const pod =
  (pal: Palette, feature: PodFeature): Model =>
  (light, lit) => {
    const m = new Yard(light);
    m.body(
      [
        [-8.5, 3.6, 3.4, 5],
        [-5.5, 5.6, 5, 5],
        [3, 5.6, 5, 5],
        [7.5, 4, 3.6, 5],
        [9, 2.2, 2, 5],
      ],
      pal.body,
    );
    m.body(
      [
        [0.6, 5.95, 5.3, 5],
        [3.4, 5.8, 5.2, 5],
      ],
      GLASS,
    );
    m.pod(-10.2, -8, 0, 5, 2.8, pal.trim, { sides: 10, aft: JET });
    let mouth: CraftMouth = { at: [-10.2, 0, 5], radius: 2.8 };
    let lamp = -2.4;
    if (feature === "petals") {
      // Sunflower: a six-sided gold petal cup round the stern.
      m.pod(-9.2, -5.2, 0, 5, 7.6, pal.acc, { r1: 5.2, sides: 6 });
    } else if (feature === "wheel") {
      // Cartwheel: one white wheel rim round the waist.
      meshHoop(m.mesh, [-3.6, 0, 5], [1, 0, 0], 7.6, 5, 2.4, pal.body, 20);
      lamp = 5.2;
    } else if (feature === "drum") {
      // Whirlpool: the family drum on the back, carrying the lamp.
      m.drum(-3.4, 0, 8.4, 12.4, 3.6, pal.trim, 14);
    } else if (feature === "needle") {
      // Needle: a blunt needle cone at each end.
      m.pod(7.6, 12.6, 0, 5, 3.4, pal.trim, { r1: 1.5, sides: 10 });
      m.pod(-13.2, -9.6, 0, 5, 1.5, pal.trim, { r1: 2.8, sides: 10, aft: JET });
      mouth = { at: [-13.2, 0, 5], radius: 1.5 };
    } else if (feature === "y") {
      // Phantom: three thick arms in a Y round the stern.
      for (const degrees of [90, 210, 330]) {
        const [c, s] = [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];
        meshBlock(
          m.mesh,
          [-6.6, c * 6.2, 5 + s * 6.2],
          [
            [1, 0, 0],
            [0, c, s],
            [0, -s, c],
          ],
          [2.2, 2.6, 1.7],
          pal.trim,
        );
      }
      lamp = 5;
    }
    m.mouths.push(mouth);
    if (feature === "dome") {
      m.ball([-2.4, 0, 9.2], [3.8, 3.8, 3.4], GLASS, 20, 10);
    } else if (feature === "drum") {
      m.lamp(-3.4, 0, 12.9, 1.8, lit ? pal.lamp : pal.trim);
    } else {
      m.lamp(lamp, 0, lamp > 0 ? 8.6 : 9.8, 1.8, lit ? pal.lamp : pal.trim, pal.trim);
    }
    return m.built(1.15);
  };

// Crane: the yard hull with one thick jib tier along the roof, ending in a hook block above the
// bow deck.
const crane: Model = (light) => {
  const pal = SUN;
  const m = yard(light, pal, { length: 30, cabin: [-0.36, -0.04], taper: 0.22, nose: 0.7 });
  m.box(-9, 9.5, -2.2, 2.2, m.roof - 0.6, m.roof + 2.6, pal.acc);
  m.box(6.5, 10.5, -2.8, 2.8, m.deck - 0.5, m.roof + 0.4, pal.trim);
  return m.built(1.15);
};

// Salvager: the yard hull with a blunt bow carrying one magnet drum flush on its face.
const salvager: Model = (light) => {
  const pal = SUN;
  const m = yard(light, pal, { cabin: [-0.28, 0.16], taper: 0.1, nose: 0.9 });
  m.pod(13, 16.5, 0, 4.2, 5.4, pal.acc, { sides: 14 });
  return m.built(1.15);
};

// Beacon tender: the yard hull stretched, its cabin forward, one upright guide beacon on the
// aft deck.
const tender: Model = (light) => {
  const pal = AN;
  const m = yard(light, pal, { length: 33, width: 14, cabin: [0, 0.3], glass: 0.6 });
  meshTube(m.mesh, [-7.5, 0, m.deck - 1], [-7.5, 0, m.deck + 8], 3.6, 2.6, pal.body, 12);
  m.drum(-7.5, 0, m.deck + 8, m.deck + 11, 3, pal.lamp);
  m.drum(-7.5, 0, m.deck + 11, m.deck + 12.2, 3.6, pal.trim);
  return m.built(1.1);
};

// Driller: the yard hull with a square bow behind one large blunt drill cone on a collar.
const driller: Model = (light) => {
  const pal = CART;
  const m = yard(light, pal, {
    length: 24,
    width: 14,
    height: 8,
    cabin: [-0.3, 0.2],
    cabinHeight: 3,
    taper: 0.02,
    nose: 1,
  });
  m.pod(11.5, 14, 0, 5, 6.6, pal.lamp);
  m.pod(14, 22, 0, 5, 5.8, pal.trim, { r1: 2.2 });
  return m.built(1.1);
};

// Tug: the yard hull cut short and wide, with a full-height push block across the bow.
const tug: Model = (light) => {
  const pal = CART;
  const m = yard(light, pal, {
    length: 22,
    width: 15,
    height: 7.5,
    cabin: [-0.3, 0.22],
    cabinHeight: 3.2,
    taper: 0.02,
    nose: 1,
    engine: 0.3,
  });
  m.hull(
    [
      [10.5, 9.5, 0, 10, 2.6],
      [13.5, 9.5, 0, 10, 2.6],
    ],
    pal.trim,
  );
  return m.built(1.1);
};

// Loom ship: a wide low yard hull, its cabin forward, a cloth bed and one beam drum across the
// stern deck.
const loomship: Model = (light) => {
  const pal = ND;
  const m = yard(light, pal, {
    length: 29,
    width: 14,
    height: 4.8,
    cabin: [0.04, 0.3],
    glass: 0.62,
    taper: 0.3,
    nose: 0.6,
  });
  m.box(-9.5, 0.5, -5, 5, m.deck - 0.5, m.deck + 1.2, pal.lamp);
  meshTube(m.mesh, [-10.5, -7.6, m.deck + 1.6], [-10.5, 7.6, m.deck + 1.6], 2.5, 2.5, pal.trim, 12);
  return m.built(1.1);
};

// Reed's ring ship: a stout spindle hull through a thick eye ring on two broad pylons.
const reed: Model = (light) => {
  const pal = ND;
  const m = new Yard(light);
  m.pod(-5, 5, 0, 5.5, 3.8, pal.body);
  m.pod(5, 15, 0, 5.5, 3.8, pal.body, { r1: 1.6 });
  m.pod(-13, -5, 0, 5.5, 2.6, pal.trim, { r1: 3.8, aft: JET });
  m.mouths.push({ at: [-13, 0, 5.5], radius: 2.6 });
  meshRing(m.mesh, [-2, 0], 4.4, 6.8, 12, 8.8, pal.trim, 32);
  m.box(-4.6, 0.6, -9.6, 9.6, 4.6, 6.6, pal.trim);
  m.ball([4.5, 0, 7.6], [4, 2.8, 2.6], GLASS, 16, 10);
  return m.built(1.05);
};

// Elder Loom's saucer: a disc in three tiers, a centred glass dome and one stern engine block.
const saucer: Model = (light) => {
  const pal = ND;
  const m = new Yard(light);
  m.drum(0, 0, 2.5, 6.5, 14, pal.body, 32);
  m.drum(0, 0, 6.5, 9.2, 9.5, pal.body, 28);
  m.drum(0, 0, 3.8, 5.2, 14.5, pal.trim, 32);
  m.ball([0, 0, 9.2], [5.4, 5.4, 4], GLASS);
  m.hull(
    [
      [-17, 6, 2.2, 7.2, 1.8],
      [-10, 6, 2.2, 7.2, 1.8],
    ],
    pal.trim,
  );
  for (const side of [1, -1]) m.port(-18.2, -15, side * 3, 4.7, 1.8, pal.trim);
  m.lamp(11, 0, 6.3, 1.6, pal.lamp);
  return m.built(1.1);
};

// The stranded lamp buoy: a small guide beacon, drawn the same at every heading. Its model is
// in view space, in the guide beacon's units; the producer fits it to `LAMP_BUOY_FIT`.
export const LAMP_BUOY_FIT = [28, 28] as const;
// The float's rim, where the tow line makes fast: its radius and height in the beacon's units.
export const LAMP_BUOY_RIM = { radius: 20, height: 2.5 } as const;
const lampBuoy: Model = (_light, lit) => ({ mesh: guideBeacon(lit ? "lit" : "dim"), mouths: [] });

export type CraftGalaxy = FriendlyManifest | "phantom";
export type FriendlyCraft = {
  // The craft's name in its ids, `craft-{name}-{k}`.
  name: string;
  title: string;
  // The manifest that holds its rows, the public folder its files sit in, and its home galaxy.
  manifest: CraftGalaxy;
  folder: Exclude<CraftGalaxy, "core">;
  galaxy: Exclude<CraftGalaxy, "core">;
  model: Model;
  // A stranded craft ships a tow point per heading in place of jets and a nose.
  stranded?: true;
  // Blink frames A (lamp lit) and B (lamp dark) at every heading.
  blink?: true;
  // Drawn the same at every heading, from a model in view space.
  fixed?: true;
};

type Home = Exclude<CraftGalaxy, "core">;
const stranded = (name: string, title: string, galaxy: Home, model: Model): FriendlyCraft => ({
  name: `stranded-${name}`,
  title: `Stranded ${title}`,
  manifest: galaxy,
  folder: galaxy,
  galaxy,
  model,
  stranded: true,
});
const lifeboat = (name: string, title: string, galaxy: Home, model: Model): FriendlyCraft => ({
  ...stranded(name, title, galaxy, model),
  blink: true,
});
// A finale ally: its rows sit in Phantom's manifest.
const ally = (name: string, title: string, galaxy: Home, model: Model): FriendlyCraft => ({
  name,
  title,
  manifest: "phantom",
  folder: "phantom",
  galaxy,
  model,
});

export const friendlyCrafts = (): FriendlyCraft[] => [
  {
    name: "miner",
    title: "Mica's mining ship",
    manifest: "core",
    folder: "cartwheel",
    galaxy: "cartwheel",
    model: hauler(true),
  },
  {
    name: "pip",
    title: "Pip's courier",
    manifest: "core",
    folder: "andromeda",
    galaxy: "andromeda",
    model: courier(AN, 1.1),
  },
  stranded("scrap-barge", "scrap barge", "sunflower", barge(SCRAP, 1, true)),
  lifeboat("seed-pod", "seed pod", "sunflower", pod(SUN, "petals")),
  {
    name: "visitor1",
    title: "Visitor 1",
    manifest: "cartwheel",
    folder: "cartwheel",
    galaxy: "cartwheel",
    model: visitor(SAGE),
  },
  {
    name: "visitor2",
    title: "Visitor 2",
    manifest: "cartwheel",
    folder: "cartwheel",
    galaxy: "cartwheel",
    model: visitor(PERIWINKLE),
  },
  {
    name: "blocker",
    title: "Blocker",
    manifest: "cartwheel",
    folder: "cartwheel",
    galaxy: "cartwheel",
    model: blocker,
  },
  stranded("hauler", "hauler", "cartwheel", hauler(false)),
  lifeboat("ore-pod", "ore pod", "cartwheel", pod(CART, "wheel")),
  stranded("current-skimmer", "current skimmer", "whirlpool", skimmer(1.05)),
  lifeboat("whirlpool-pod", "whirlpool pod", "whirlpool", pod(WH, "drum")),
  {
    name: "glider",
    title: "Elder Loom's saucer",
    manifest: "needle",
    folder: "needle",
    galaxy: "needle",
    model: saucer,
  },
  stranded("glider", "glider", "needle", glider(ND, 1.3, "cabin")),
  lifeboat("needle-pod", "needle pod", "needle", pod(ND, "needle")),
  stranded("courier", "courier", "andromeda", courier(SLATE_BLUE, 1.1, "none")),
  { ...lifeboat("lamp-buoy", "lamp buoy", "andromeda", lampBuoy), fixed: true },
  lifeboat("traveler-pod", "traveler pod", "phantom", pod(PH, "y")),
  ally("barge", "Clover's barge", "sunflower", barge(SUN, 0.95)),
  ally("grower", "Grower", "sunflower", pod(SUN, "dome")),
  ally("crane", "Crane", "sunflower", crane),
  ally("salvager", "Salvager", "sunflower", salvager),
  ally("driller", "Driller", "cartwheel", driller),
  ally("tug", "Tug", "cartwheel", tug),
  ally("buoytender", "Buoy tender", "whirlpool", skimmer(1.25, 2)),
  ally("voronguide", "Voron guide", "whirlpool", skimmer(0.85)),
  ally("reed", "Reed's ring ship", "needle", reed),
  ally("student", "Student", "needle", glider(LAVENDER, 0.95, "lamp")),
  ally("loomship", "Loom ship", "needle", loomship),
  ally("avipracticeglider", "Avi practice glider", "needle", glider(ND, 0.8, "bumper")),
  ally("trainee", "Trainee", "andromeda", courier(SLATE_BLUE, 1.1, "tandem")),
  ally("beacontender", "Beacon tender", "andromeda", tender),
  ally("courierrunner", "Courier runner", "andromeda", courier(AN, 0.85)),
];
