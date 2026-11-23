// The Phantom finale allies: twelve new non-hostile craft at 16 headings with speed jets and nose
// data in the Cartwheel story-craft schema, and allies.json (the roster, Marlo's song and the
// ally jump).
// Contract: art/allies.md.
// Usage: node art/tools/allies.ts
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/build/colour";

import { andromeda } from "./andromeda-models.ts";
import { jetsFile, type JetColors } from "./crafts.ts";
import { ball, hcyl, part, pill, ring } from "./hull-shapes.ts";
import { craftIds, linkData, mergeSidecars, replaceEntries } from "./manifest.ts";
import {
  glass,
  glassSide,
  lav,
  lavSide,
  pearl,
  pearlRear,
  pearlSide,
  rose,
  roseSide,
  sage,
  sageSide,
  silver,
  silverSide,
} from "./needle-common.ts";
import { noses } from "./nose.ts";
import {
  anchor,
  ENEMY_HEADINGS,
  json,
  type Point,
  projectAt,
  rotate,
  round,
  vector,
} from "./projection.ts";
import {
  along,
  blue,
  box,
  cream,
  creamSide,
  DISPLAY_SCALE,
  type Face,
  facing,
  ngon,
  orientedBox,
  orientedPlan,
  type Part,
  type Plan,
  polygons,
  wallWindows,
  warm,
} from "./solid.ts";
import { svgText } from "./svg-text.ts";

const OUT = fileURLToPath(new URL("../../public/art/phantom/", import.meta.url));
const PUBLIC = "/art/phantom/";
const JETS_FILE = "story-craft-jets.json";
// Phantom's field (public/art/galaxies.json `phantom`), for the contrast checks.
const FIELD = (
  JSON.parse(readFileSync(new URL("../../public/art/galaxies.json", import.meta.url), "utf8")) as {
    galaxies: Record<string, { colors: { background: string } }>;
  }
).galaxies.phantom!.colors.background;
// New craft are built 1.2 times their mock-up size so they read beside Ada's 42 px ship.
const SCALE = 1.2;
const PAD = 4;
const STEP = 16;

// Plans in (u forward, v across); local forward is -y, as for every craft.
const FWD = -Math.PI / 2;
const uv = (u: number, v: number) => along(FWD, u, v);
const craftPlan = (local: Plan) => orientedPlan(0, 0, FWD, local);
const craftBox = (u: number, v: number, length: number, width: number) =>
  orientedBox(...uv(u, v), FWD, length, width);
const cube = (u: number, v: number, z0: number, size: number, color: string): Part => {
  const [x, y] = uv(u, v);
  const h = size / 2;
  return { plan: box(x - h, y - h, x + h, y + h), z0, z1: z0 + size, top: color, side: color };
};
const disc = (
  u: number,
  v: number,
  r: number,
  z0: number,
  z1: number,
  top: string,
  side: string,
  n = 12,
): Part => {
  const [x, y] = uv(u, v);
  return { plan: ngon(n, r, x, y, Math.PI / n), z0, z1, top, side };
};
// Stacked n-gon tiers for domes, floats and towers: [radius factor, z0, z1] above `base`.
const tiers = (
  u: number,
  v: number,
  r: number,
  base: number,
  steps: readonly (readonly [number, number, number])[],
  top: string,
  side: string,
  cap = top,
  n = 12,
): Part[] =>
  steps.map(([k, z0, z1], i) =>
    disc(u, v, r * k, base + z0, base + z1, i === steps.length - 1 ? cap : top, side, n),
  );

// ---------------------------------------------------------------- palette

const steelDark = "#6e7482";
const steelDarkSide = "#4f5462";
const rubber = "#3a3e4a";
const creamRear = "#a08f78";
// Sunflower outposts (art/outposts.md).
const leaf = "#9ccc5a";
const leafSide = "#6c9a3a";
const tuft = "#4f7a2c";
const greenGlass = "#c9ecb4";
const greenGlassSide = "#8fbf78";
const greenGlassCap = "#eefbe2";
const bloom = "#f6d76b";
const bloomSide = "#b89a3e";
const yellow = "#f2d15a";
const yellowSide = "#b99a36";
const yellowDark = "#8c7428";
const steel = "#b8bfc9";
const steelSide = "#8a919c";
const olive = "#aaa883";
const oliveSide = "#7f7d5f";
const rust = "#b49a7c";
const rustSide = "#857057";
const magnet = "#8f9cf0";
const magnetSide = "#5f6cc0";
// Whirlpool whale glow and hull tone (art/whales.md).
const glow = "#cbb8ee";
const lilac = "#aaa5e6";
const lilacSide = "#7c76bd";
const lilacRear = "#5f5a9c";
// Needle: the student ring ship's lavender rear.
const lavRear = "#6c5d78";
// Cartwheel hub slate, ore and Cobble stone (art/cartwheel.md).
const slate = "#9aaccb";
const slateSide = "#6a7c9e";
const slateDark = "#4e5d7a";
const ore = "#65c9bf";
const oreSide = "#3f9890";
const stone = "#b3a68a";
const stoneSide = "#857a62";
const stoneRear = "#6b6250";
const graphite = "#7d7a92";
const graphiteSide = "#5e5b72";
const a = andromeda;

// The story craft's civil jet palette (art/cartwheel.md), shared by every ally.
const JETS: JetColors = { outer: ["#c9a978", "#ffe9b8"], core: ["#efe4cf", "#ffffff"] };
// Lighter tops for round caps, the drill's flutes and the tug's engine bell mouths.
const sageCap = "#cfe0c6";
const roofCap = "#a3a9d2";
const creamCap = "#f7f0e2";
const stoneCap = "#c4b89e";
const steelFlute = "#9aa1ad";
const bellMouth = "#2c2a38";

// A ball with a raised thread band round its equator: the middle tier splits round the band.
function bandedBall(
  u: number,
  v: number,
  zc: number,
  r: number,
  top: string,
  side: string,
  cap: string,
  band: string,
  bandSide: string,
  n = 12,
): Part[] {
  const [lo, hi] = [zc - 0.07 * r, zc + 0.07 * r];
  return [
    disc(u, v, r, zc - 0.72 * r, lo, top, side, n),
    disc(u, v, r * 1.04, lo, hi, band, bandSide, n),
    disc(u, v, r * 0.76, hi, zc + r, cap, side, n),
  ];
}

type Visible = (nx: number, ny: number) => boolean;
type Craft = {
  name: string;
  title: string;
  // Heights parts rest on (hull top, then cab top): groups based there draw after those below.
  levels: readonly number[];
  build: (visible: Visible) => Part[][];
  // Jet mouths as (u, v, z) at the engine faces, all `mouthWidth` wide.
  mouths: readonly (readonly [number, number, number])[];
  mouthWidth: number;
  // The model's size factor: SCALE for the new craft, 1 for the glider variant.
  scale: number;
};

// ---------------------------------------------------------------- Sunflower

// Grower ship (Greenhouse ring): a glass greenhouse between two leaf-green planter pods.
const grower: Craft = {
  name: "grower",
  title: "Grower ship",
  scale: SCALE,
  levels: [8],
  mouthWidth: 4,
  mouths: [
    [-17, -3, 4.75],
    [-17, 3, 4.75],
  ],
  build: () => [
    [{ plan: craftBox(-14, 0, 6, 12), z0: 2.5, z1: 7, top: steelDark, side: steelDarkSide }],
    ...[-1, 1].map((s): Part[] => [
      disc(-2, s * 14, 4.6, 3, 7.5, leaf, leafSide, 8),
      part(craftBox(-2, s * 14, 4.8, 4.8), 7.5, 7.8, tuft, leafSide),
    ]),
    [disc(0, 0, 13, 2, 8, leaf, leafSide, 14), disc(0, 0, 13.6, 4.4, 5.6, cream, creamSide, 14)],
    tiers(
      0,
      0,
      10,
      8,
      [
        [1, 0, 5],
        [0.64, 5, 9.5],
      ],
      greenGlass,
      greenGlassSide,
      greenGlassCap,
    ),
    [part(craftBox(0, 0, 3, 6), 17.5, 17.9, bloom, bloomSide)],
    [cube(12.2, 0, 4.5, 2.4, warm)],
  ],
};

// Gantry crane (Workshop crane): an open square yellow frame under a tall portal bridge with a
// steel trolley, a cable and hook holding a cream crate below the opening, hazard blocks, a cream
// cab on the rear starboard corner and two engine cans astern.
const crane: Craft = {
  name: "crane",
  title: "Gantry crane",
  scale: SCALE * 1.25,
  levels: [8, 15, 17.4],
  mouthWidth: 3.6,
  mouths: [
    [-18.6, -7, 5],
    [-18.6, 7, 5],
  ],
  build: (visible) => {
    const cab = craftBox(-9.5, 8.5, 6.5, 6.5);
    const engine = { top: steelDark, side: steelDarkSide, front: "flat", back: "flat" } as const;
    return [
      ...[-1, 1].map((s) => hcyl(-18, -13, s * 7, 5, 2.4, engine)),
      [part(craftBox(-11.25, 0, 3.5, 17), 2, 8, yellow, yellowSide, yellowDark)],
      [
        part(craftBox(11.25, 0, 3.5, 17), 2, 8, yellow, yellowSide, yellowDark),
        part(craftBox(11.25, 0, 2.4, 6), 8, 8.4, rubber, rubber),
      ],
      ...[-1, 1].map((s) => [
        part(craftBox(0, s * 10.25, 26, 3.5), 2, 8, yellow, yellowSide, yellowDark),
      ]),
      [
        part(craftBox(1, 0, 6.4, 6.4), -12.4, -7.6, cream, creamSide, creamRear),
        part(craftBox(1, 0, 6.6, 6.6), -10.4, -9.4, yellowDark, yellowDark),
        part(craftBox(1, 0, 2.2, 2.2), -7.6, -6.4, steelDarkSide, rubber),
        part(craftBox(1, 0, 0.8, 0.8), -6.4, 15, steelDark, steelDark),
      ],
      ...[-1, 1].map((s) => [
        part(craftBox(1, s * 10.25, 3, 3), 8, 15, yellow, yellowSide, yellowDark),
      ]),
      [
        part(craftBox(1, 0, 3.4, 23.5), 15, 17.4, yellow, yellowSide, yellowDark),
        part(craftBox(1, 0, 2, 14), 17.4, 17.6, yellowDark, yellowDark),
      ],
      [part(craftBox(1, -3, 4, 4.6), 17.6, 19.6, steel, steelSide)],
      ...[-1, 1].map((s) => [cube(12, s * 10.6, 8, 1.6, blue)]),
      [
        part(cab, 8, 13, cream, creamSide, creamRear),
        ...wallWindows(visible, 9.6, 11.8, 2, 2, cab, warm),
      ],
      [
        part(craftBox(-9.5, 8.5, 7.4, 7.4), 13, 13.8, yellow, yellowSide),
        part(craftBox(-10.5, 8.5, 0.8, 0.8), 13.8, 16.5, steelDark, steelDark),
        cube(-10.5, 8.5, 16.5, 1.8, blue),
      ],
    ];
  },
};

// Salvage pods (Salvage beacons): a pod cluster. Three round tanks in a triangle round a hex core
// (olive, steel and rust patchwork), dark linking struts, a smoked core dome with a warm pane, a
// blue mast lamp, a magnet arm off the starboard bow ending in a periwinkle electromagnet, and
// engine cans behind the two rear tanks.
const salvager: Craft = {
  name: "salvager",
  title: "Salvage pods",
  scale: SCALE * 1.2,
  levels: [9.5],
  mouthWidth: 3.6,
  mouths: [
    [-15.5, -7.5, 5.5],
    [-15.5, 7.5, 5.5],
  ],
  build: () => [
    ...[-1, 1].map((s) => [
      part(craftBox(-12.5, s * 7.5, 5, 5), 3.5, 7.5, steelDark, steelDarkSide),
    ]),
    [disc(0, 0, 5.5, 2.5, 9.5, steel, steelSide, 6)],
    [part(craftBox(3, 0, 10, 2.4), 4.5, 6.5, steelDark, steelDarkSide)],
    ...[-1, 1].map((s) => [
      part(
        orientedBox(...uv(-3, s * 4), FWD + s * 0.6, 8, 2.4),
        4.5,
        6.5,
        steelDark,
        steelDarkSide,
      ),
    ]),
    ball(8, 0, 6, 6.2, olive, oliveSide),
    ball(-6, -7.5, 6, 6.2, steel, steelSide),
    ball(-6, 7.5, 6, 6.2, rust, rustSide),
    [
      disc(0, 0, 3.4, 9.5, 11.5, glass, glassSide, 8),
      part(craftBox(2.2, 0, 1, 3), 9.8, 11, warm, warm),
    ],
    [part(craftBox(0, 0, 0.9, 0.9), 11.5, 15, steelDark, steelDark), cube(0, 0, 15, 2.2, blue)],
    [part(orientedBox(...uv(10, 10), FWD + 0.9, 12, 1.8), 6.5, 8, steelDark, steelDarkSide)],
    [disc(13.5, 15, 3.4, 5, 8.5, magnet, magnetSide, 10)],
  ],
};

// Clover's seed hauler: a modular hauler. A dark truss spine carrying three separate cream planter
// modules with leaf beds and tufts, a cream cab module forward under a bloom roof with warm
// windows and headlights, and an engine module aft.
const barge: Craft = {
  name: "barge",
  title: "Clover's seed hauler",
  scale: SCALE,
  levels: [7, 9.5],
  mouthWidth: 4,
  mouths: [
    [-30.5, -4, 4.5],
    [-30.5, 4, 4.5],
  ],
  build: (visible) => {
    const cab = craftPlan([
      [16, -7],
      [23, -7],
      [26.5, -4],
      [26.5, 4],
      [23, 7],
      [16, 7],
    ]);
    return [
      [part(craftBox(-27, 0, 7, 13), 1.5, 7.5, steelDark, steelDarkSide)],
      [part(craftBox(-3, 0, 42, 3.4), 3, 5, steelDarkSide, rubber)],
      ...[-15.5, -3, 9.5].map((u) => [
        part(craftBox(u, 0, 10.5, 16), 1.5, 7, cream, creamSide, creamRear),
        part(craftBox(u, 0, 9, 14.4), 7, 8.7, leaf, leafSide),
      ]),
      [
        part(cab, 1.5, 9.5, cream, creamSide, creamRear),
        ...wallWindows(visible, 4.5, 7.5, 2, 2.2, cab, warm),
      ],
      [
        part(craftBox(20, 0, 9.5, 15), 9.5, 10.5, bloom, bloomSide),
        part(craftBox(20, 0, 5.5, 9), 10.5, 11.6, bloom, bloomSide),
      ],
      [cube(26, -4, 3, 1.4, warm)],
      [cube(26, 4, 3, 1.4, warm)],
    ];
  },
};

// ---------------------------------------------------------------- Whirlpool

// Buoy tender (Current-map buoys): a submarine hull. A lilac cigar with a cream sail amidships
// carrying warm windows and a blue mast lamp, two cream spindle buoys with whale-glow song bands
// in deck cradles aft, a davit, bow lamps and a dark stern drive.
const buoyTender: Craft = {
  name: "buoytender",
  title: "Buoy tender",
  scale: SCALE,
  levels: [12.6],
  mouthWidth: 3.6,
  mouths: [
    [-23.2, -2.2, 6.6],
    [-23.2, 2.2, 6.6],
  ],
  build: (visible) => {
    const sail = pill(-1, 10, 0, 3.2);
    return [
      [disc(-21.5, 0, 4, 2.6, 10.6, steelDark, steelDarkSide, 10)],
      hcyl(-21, 21, 0, 6.6, 6.6, { top: lilac, side: lilacSide, rear: lilacRear, back: "point" }),
      [
        part(sail, 12.6, 19.5, cream, creamSide, creamRear),
        ...wallWindows(visible, 15.4, 17.8, 1, 3, sail, warm),
      ],
      [part(pill(0, 9, 0, 2.4), 19.5, 20.4, cream, creamSide)],
      [
        part(craftBox(4, 0, 0.8, 0.8), 20.4, 23.5, steelDark, steelDark),
        cube(4, 0, 23.5, 2.2, blue),
      ],
      ...[-8, -15].map((u) => [
        part(craftBox(u, 0, 5, 7), 12.6, 13.6, steelDark, steelDarkSide),
        disc(u, 0, 2.7, 13.6, 17.2, glow, lilacSide, 8),
        disc(u, 0, 1.8, 17.2, 20.6, cream, creamSide, 8),
      ]),
      [cube(19.6, -3.6, 6, 1.5, warm)],
      [cube(19.6, 3.6, 6, 1.5, warm)],
    ];
  },
};

// ---------------------------------------------------------------- Needle

// Student ring ship (Channel lights): a lavender needle hull threaded through a ring held on four
// spokes, the ring banded in rose thread, a smoked canopy with a warm pane, blue lamps at the
// ring's beam and a rose bow tip.
const student: Craft = {
  name: "student",
  title: "Student ring ship",
  scale: SCALE * 1.25,
  levels: [8.4],
  mouthWidth: 2.6,
  mouths: [
    [-11.42, -2, 5],
    [-11.42, 2, 5],
  ],
  build: () => {
    const [r, h] = [12.5, 16];
    return [
      ...ring(0, 0, r, r - 3.2, 3.6, 7.4, 16, () => [rose, roseSide]),
      ...[0, 1, 2, 3].map((i) => {
        const angle = Math.PI / 4 + (i * Math.PI) / 2;
        const mid = (r + 1) / 2;
        const [x, y] = uv(Math.cos(angle) * mid, Math.sin(angle) * mid);
        return [part(orientedBox(x, y, FWD + angle, r - 4.6, 1.3), 4.6, 6.2, lavSide, lavRear)];
      }),
      [part(craftBox(-h * 0.62, 0, 3, 6), 2.6, 7.6, steelDark, steelDarkSide)],
      hcyl(-h * 0.6, h, 0, 5.2, 3.2, {
        top: lav,
        side: lavSide,
        rear: lavRear,
        front: "point",
        back: "flat",
      }),
      [
        part(pill(h * 0.15, h * 0.55, 0, 1.6), 8.4, 9.6, glass, glassSide),
        part(craftBox(h * 0.5, 0, 0.6, 1.8), 8.6, 9.4, warm, warm),
      ],
      [cube(0, -r + 1.6, 7.4, 1.4, blue)],
      [cube(0, r - 1.6, 7.4, 1.4, blue)],
      [cube(h - 0.8, 0, 6.6, 1.1, rose)],
    ];
  },
};

// Reed's dumbbell courier: a sage command ball with a rose thread band and warm bow panes, a thin
// dark spine with a rose collar, and a smaller sage engine ball astern with twin nozzles; blue
// lamps at the command ball's beam.
const reed: Craft = {
  name: "reed",
  title: "Reed's dumbbell courier",
  scale: SCALE * 1.15,
  levels: [],
  mouthWidth: 2.4,
  mouths: [
    [-17.6, -2.4, 6.2],
    [-17.6, 2.4, 6.2],
  ],
  build: () => {
    const engine = { top: steelDark, side: steelDarkSide, front: "flat", back: "flat" } as const;
    return [
      ...[-1, 1].map((s) => hcyl(-17, -12, s * 2.4, 6.2, 1.8, engine)),
      bandedBall(-9.5, 0, 6.2, 5, sage, sageSide, sageCap, rose, roseSide, 12),
      [
        part(craftBox(-1.5, 0, 9, 2.2), 5.2, 7.2, steelDark, steelDarkSide),
        part(craftBox(-1.5, 0, 1.2, 3.6), 4.8, 7.6, rose, roseSide),
      ],
      [
        ...bandedBall(8, 0, 6.6, 7, sage, sageSide, sageCap, rose, roseSide, 14),
        ...[-1, 1].map((s) => part(craftBox(14.4, s * 1.8, 0.8, 2.2), 8, 10, warm, warm)),
      ],
    ];
  },
};

// Loom ship (Loom hall): twin pearl pontoons joined by a silver sill, carrying a low, deep loom
// frame (two long silver side rails and front and rear lintels) strung with warp threads behind a
// lavender cloth band with rose and sage weft stripes. The frame is longer than it is tall, so
// the side view reads as a block, not a mast.
const loomShip: Craft = {
  name: "loomship",
  title: "Loom ship",
  scale: SCALE,
  levels: [7],
  mouthWidth: 3,
  mouths: [
    [-20.5, -11.5, 4.25],
    [-20.5, 11.5, 4.25],
  ],
  build: () => {
    const pontoon = (s: number): Plan =>
      craftPlan([
        [-16, s * 9],
        [10, s * 9],
        [17, s * 11.5],
        [10, s * 14],
        [-16, s * 14],
      ]);
    return [
      ...[-1, 1].map((s): Part[] => [
        {
          plan: craftBox(-18.5, s * 11.5, 4, 4),
          z0: 2.5,
          z1: 6,
          top: steelDark,
          side: steelDarkSide,
        },
      ]),
      ...[-1, 1].map((s): Part[] => [
        { plan: pontoon(s), z0: 2, z1: 7, top: pearl, side: pearlSide, rear: pearlRear },
        cube(15, s * 11.5, 7, 2, blue),
      ]),
      [{ plan: craftBox(0, 0, 10, 20), z0: 3.5, z1: 6.5, top: silver, side: silverSide }],
      [
        { plan: craftBox(4, 0, 6, 7), z0: 6.5, z1: 10, top: glass, side: glassSide },
        cube(7.4, 0, 7.2, 1.8, warm),
      ],
      ...[-1, 1].map((s): Part[] => [
        { plan: craftBox(-4, s * 11.5, 12, 2.2), z0: 7, z1: 14.5, top: silver, side: silverSide },
      ]),
      ...[-9, 1].map((u): Part[] => [
        { plan: craftBox(u, 0, 2, 25.2), z0: 14.5, z1: 16.3, top: silver, side: silverSide },
      ]),
      [{ plan: craftBox(-4, 0, 9, 19), z0: 10.7, z1: 11.4, top: lav, side: lavSide }],
      [{ plan: craftBox(-1, 0, 2, 19), z0: 11.4, z1: 11.6, top: rose, side: rose }],
    ];
  },
};

// ---------------------------------------------------------------- Andromeda

// Courier trainee (Courier school): Pip's pod scooter with its colours reversed, a slate-blue cab
// pod between cream pannier pods, plus a tandem instructor pod astern, twin engines, warm bow panes
// and headlights, and the marker courier lamp on a mast.
const trainee: Craft = {
  name: "trainee",
  title: "Courier trainee",
  scale: SCALE * 1.2,
  levels: [13],
  mouthWidth: 2.6,
  mouths: [
    [-17.6, -2.6, 5.4],
    [-17.6, 2.6, 5.4],
  ],
  build: () => {
    const engine = { top: steelDark, side: steelDarkSide, front: "flat", back: "flat" } as const;
    return [
      ...[-1, 1].map((s) => hcyl(-17, -11, s * 2.6, 5.4, 1.9, engine)),
      ...[-1, 1].map((s) => [part(craftBox(-1, s * 6.5, 2, 4), 4.6, 6.4, a.roofSide, a.roofSide)]),
      [part(craftBox(-5, 0, 6, 4), 3.8, 7.4, a.roofSide, a.roofSide)],
      [
        ...ball(-9, 0, 6.6, 5.2, a.roof, a.roofSide, roofCap),
        part(craftBox(-6.2, 0, 0.6, 2.6), 8.6, 10, warm, warm),
      ],
      [
        ...ball(2.5, 0, 6.6, 6.6, a.roof, a.roofSide, roofCap),
        ...[-1, 1].map((s) => part(craftBox(7.2, s * 1.8, 0.7, 2.2), 8.4, 10.2, warm, warm)),
      ],
      ...[-1, 1].map((s) => [...ball(-1.5, s * 10, 6, 4, cream, creamSide, creamCap, 10)]),
      [cube(8, -3.4, 4.6, 1.2, warm)],
      [cube(8, 3.4, 4.6, 1.2, warm)],
      [
        part(craftBox(1, 0, 0.8, 0.8), 13, 16.4, steelDark, steelDark),
        disc(1, 0, 1.4, 16.4, 18.4, a.marker, a.markerDark, 8),
      ],
    ];
  },
};

// Beacon lander (Spare beacon): an octagonal cream descent stage on four splayed legs with
// footpads, warm windows and headlights, carrying the upright spare guide beacon (slate-blue
// tower, marker-dark band, cream gallery, marker lantern with a white core, slate-blue cap);
// engine cans under the stern.
const beaconTender: Craft = {
  name: "beacontender",
  title: "Beacon lander",
  scale: SCALE * 1.35,
  levels: [9],
  mouthWidth: 3.2,
  mouths: [
    [-11.4, -3.4, 5],
    [-11.4, 3.4, 5],
  ],
  build: (visible) => {
    const stage = craftPlan(ngon(8, 9.5, 0, 0, Math.PI / 8));
    const engine = { top: steelDark, side: steelDarkSide, front: "flat", back: "flat" } as const;
    return [
      ...[0, 1, 2, 3].map((i) => {
        const angle = Math.PI / 4 + (i * Math.PI) / 2;
        const [x, y] = uv(Math.cos(angle) * 11.5, Math.sin(angle) * 11.5);
        return [
          part(orientedBox(x, y, FWD + angle, 7.5, 1.4), 1.6, 3.6, steelDark, steelDarkSide),
          disc(
            Math.cos(angle) * 15,
            Math.sin(angle) * 15,
            2.2,
            0,
            1.6,
            steelDark,
            steelDarkSide,
            8,
          ),
        ];
      }),
      ...[-1, 1].map((s) => hcyl(-11, -6, s * 3.4, 5, 2.1, engine)),
      [
        part(stage, 2.5, 9, cream, creamSide, creamRear),
        ...wallWindows(visible, 4.6, 7, 1, 2.4, stage, warm),
      ],
      [part(craftPlan(ngon(8, 7.4, 0, 0, Math.PI / 8)), 9, 9.8, creamCap, creamSide)],
      [
        disc(0, 0, 4, 9.8, 11.4, a.roof, a.roofSide, 8),
        disc(0, 0, 2.6, 11.4, 17.5, a.roof, a.roofSide, 8),
        disc(0, 0, 2.2, 17.5, 21.8, a.marker, a.markerDark, 8),
        disc(0, 0, 2.2, 21.8, 23, a.roof, a.roofSide, 8),
      ],
      [cube(9.2, -2.6, 4, 1.3, warm)],
      [cube(9.2, 2.6, 4, 1.3, warm)],
    ];
  },
};

// ---------------------------------------------------------------- Cartwheel

// Drill mole (Second docking bay): a round slate body behind a dark cutter collar and a fluted,
// stepped steel drill cone, a slate cab with warm windows and an ore teal bin on the back, blue
// beam lamps and twin engine cans astern.
const driller: Craft = {
  name: "driller",
  title: "Drill mole",
  scale: SCALE,
  levels: [12],
  mouthWidth: 3.6,
  mouths: [
    [-18.6, -3.6, 6.6],
    [-18.6, 3.6, 6.6],
  ],
  build: (visible) => {
    const cab = craftBox(-1, 0, 7, 6);
    const flat = { front: "flat", back: "flat" } as const;
    return [
      ...[-1, 1].map((s) =>
        hcyl(-18, -12, s * 3.6, 6.6, 2.4, { top: steelDark, side: steelDarkSide, ...flat }),
      ),
      hcyl(-15, 9, 0, 6.6, 6.4, { top: slate, side: slateSide, rear: slateDark, back: "flat" }),
      hcyl(8, 10, 0, 6.6, 7.4, { top: steelDark, side: steelDarkSide, ...flat }),
      hcyl(10, 17, 0, 6.6, 7, { top: steel, side: steelSide, ...flat }),
      hcyl(17, 24.5, 0, 6.6, 4.2, { top: steelFlute, side: steelSide, ...flat }),
      hcyl(24.5, 27, 0, 6.6, 1, { top: steel, side: steelSide, ...flat, front: "point" }),
      [
        part(cab, 12, 16, slate, slateSide, slateDark),
        ...wallWindows(visible, 13, 15, 2, 1.8, cab, warm),
      ],
      [
        part(craftBox(-9, 0, 7, 7), 12, 14.6, steelDark, steelDarkSide),
        part(craftBox(-9, 0, 5.6, 5.6), 14.6, 15.2, ore, oreSide),
      ],
      [cube(4.5, -5.6, 9.4, 1.3, blue)],
      [cube(4.5, 5.6, 9.4, 1.3, blue)],
    ];
  },
};

// Drum tug (Hub repairs): a squat octagonal Cobble-stone drum with a curved dark push ring across
// the bow, a bank of four big graphite engine bells astern, a slate wheelhouse with warm windows
// and a blue mast lamp.
const tug: Craft = {
  name: "tug",
  title: "Drum tug",
  scale: SCALE * 1.1,
  levels: [9],
  mouthWidth: 3.4,
  mouths: [
    [-15.4, -9, 5.4],
    [-15.4, -3, 5.4],
    [-15.4, 3, 5.4],
    [-15.4, 9, 5.4],
  ],
  build: (visible) => {
    const wheel = craftPlan([
      [-3, -4.5],
      [2, -4.5],
      [4, -2.5],
      [4, 2.5],
      [2, 4.5],
      [-3, 4.5],
    ]);
    const arc = (r: number, from: number, to: number) =>
      Array.from({ length: 9 }, (_, i) => {
        const t = from + ((to - from) * i) / 8;
        return [Math.cos(t) * r, Math.sin(t) * r] as const;
      });
    const sweep = (Math.PI / 2) * 0.9;
    const bell = { top: graphite, side: graphiteSide, front: "flat", back: "flat" } as const;
    return [
      [part(craftBox(-11, 0, 4, 20), 3, 8, steelDark, steelDarkSide)],
      ...[-9, -3, 3, 9].map((v) => [
        ...hcyl(-15, -11, v, 5.4, 2.6, bell),
        part(craftBox(-14.8, v, 0.6, 4), 3.4, 7.4, bellMouth, bellMouth),
      ]),
      [
        part(
          craftPlan([...arc(13.6, -sweep, sweep), ...arc(10.5, sweep, -sweep)]),
          2,
          8,
          steelDarkSide,
          rubber,
        ),
      ],
      [part(craftPlan(ngon(8, 11.5, 0, 0, Math.PI / 8)), 1.5, 9, stone, stoneSide, stoneRear)],
      [part(craftPlan(ngon(8, 9, 0, 0, Math.PI / 8)), 9, 9.6, stoneCap, stoneSide)],
      [
        part(wheel, 9.6, 14.6, slate, slateSide, slateDark),
        ...wallWindows(visible, 11, 13.4, 1, 3, wheel, warm),
      ],
      [part(craftBox(-2, 0, 0.9, 0.9), 14.6, 19, steelDark, steelDark), cube(-2, 0, 19, 2.4, blue)],
    ];
  },
};

// Voron's quiet-crossing guide has swept lilac flanks and a raised cream bridge.
const voronGuide: Craft = {
  name: "voronguide",
  title: "Voron guide craft",
  scale: SCALE,
  levels: [7, 11],
  mouthWidth: 3,
  mouths: [[-16, 0, 4]],
  build: () => [
    [
      part(
        craftPlan([
          [17, 0],
          [2, 7],
          [-10, 12],
          [-15, 9],
          [-12, 4],
          [-16, 3],
          [-16, -3],
          [-12, -4],
          [-15, -9],
          [-10, -12],
          [2, -7],
        ]),
        1,
        7,
        lilac,
        lilacSide,
        lilacRear,
      ),
    ],
    [part(pill(-7, 10, 0, 4, "blunt", "flat"), 7, 11, cream, creamSide)],
    [part(pill(1, 8, 0, 2.9, "blunt", "flat"), 11, 13, glass, glassSide)],
  ],
};

// Avi's practice glider has a narrow cockpit between two swept pearl wings.
const aviPracticeGlider: Craft = {
  name: "avipracticeglider",
  title: "Avi practice glider",
  scale: SCALE,
  levels: [5.5, 8],
  mouthWidth: 2.8,
  mouths: [[-14, 0, 4.6]],
  build: () => [
    [
      part(
        craftPlan([
          [12, 0],
          [2, 3],
          [-7, 15],
          [-13, 13],
          [-11, 4],
          [-14, 2],
          [-14, -2],
          [-11, -4],
          [-13, -13],
          [-7, -15],
          [2, -3],
        ]),
        2.5,
        5.5,
        pearl,
        pearlSide,
        pearlRear,
      ),
    ],
    [part(pill(-10, 15, 0, 2.9, "point", "flat"), 5.5, 8, lav, lavSide, lavRear)],
    [part(pill(1, 8, 0, 1.8, "blunt", "flat"), 8, 10, glass, glassSide)],
  ],
};

// The courier runner uses the settlement's blue roof and warm note-paper colours.
const courierRunner: Craft = {
  name: "courierrunner",
  title: "Courier runner",
  scale: SCALE,
  levels: [6.5, 10],
  mouthWidth: 2.8,
  mouths: [
    [-15, -4, 4.5],
    [-15, 4, 4.5],
  ],
  build: () => [
    ...[-1, 1].map((side) =>
      hcyl(-15, -5, side * 4, 4.5, 2.1, {
        top: steelDark,
        side: steelDarkSide,
        front: "flat",
        back: "flat",
      }),
    ),
    [part(pill(-11, 15, 0, 4.7, "point", "flat"), 2, 6.5, roofCap, a.roofSide)],
    [part(pill(1, 12, 0, 3.2, "blunt", "flat"), 6.5, 10, a.roof, a.roofSide)],
    [part(pill(4, 9, 0, 2.1, "blunt", "flat"), 10, 11.5, glass, glassSide)],
    ...[-1, 1].map((side) => [part(craftBox(-3, side * 6.9, 10, 4.7), 3, 7.7, cream, creamSide)]),
  ],
};

// Table order: the project allies in Gameplay's project order, then the quest allies.
const CRAFTS: readonly Craft[] = [
  grower,
  crane,
  salvager,
  buoyTender,
  voronGuide,
  student,
  loomShip,
  aviPracticeGlider,
  trainee,
  beaconTender,
  courierRunner,
  driller,
  tug,
  barge,
  reed,
];

// ---------------------------------------------------------------- roster and song

// Which art draws each ally: a story craft name (`craft-{craft}-{k}`, in any manifest) or a whale
// kind (`whale-{kind}-{k}-{f}`, Whirlpool's manifest). Keys are Gameplay's project ids and, for the
// quest allies, galaxy ids.
const ROSTER = {
  projects: {
    greenhouseRing: { craft: "grower" },
    workshopCrane: { craft: "crane" },
    salvageBeacons: { craft: "salvager" },
    nurseryBeacon: { whale: "adult" },
    currentBuoys: { craft: "buoytender" },
    quietCrossing: { craft: "voronguide" },
    channelLights: { craft: "student" },
    loomHall: { craft: "loomship" },
    practiceBerth: { craft: "avipracticeglider" },
    courierSchool: { craft: "trainee" },
    spareBeacon: { craft: "beacontender" },
    routeExchange: { craft: "courierrunner" },
    dockingBay: { craft: "driller" },
    hubRepairs: { craft: "tug" },
  },
  quests: {
    sunflower: { craft: "barge" },
    whirlpool: { whale: "whale" },
    needle: { craft: "reed" },
    andromeda: { craft: "pip" },
    cartwheel: { craft: "miner" },
  },
};

// Marlo's song (gameplay/ships.md "Finale allies"), in the whale glow: only the `quests` ally
// `quest` sings. Reaches are world units: `base`, or `nurseryBeacon` while that project ally
// flies. Widths are logical px, scaled by `s`.
const SONG = {
  quest: "whirlpool",
  reach: { base: 300, nurseryBeacon: 450 },
  color: glow,
  field: { alpha: 0.08 },
  rim: { alpha: 0.78, width: 2 },
  ripples: { alpha: 0.3, width: 2, count: 2, periodMs: 2400 },
  droneRing: { alpha: 1, width: 2, margin: 4 },
};

// The ally jump: the shipped quantum jump's parts (public/art/quantum-jump.json) at ally scale.
// Glow frames display at `glowReference` scale (112 times the ally's display size over Ada's
// 42); iris radii are in ally display sizes; `scale` and `stretch` are about the pivot.
const JUMP = {
  glowReference: 42,
  out: [
    { ms: 50, glow: "full" },
    { ms: 50, glow: "full" },
    { ms: 50, glow: "full" },
    { ms: 80, glow: "full", stretch: 3.2, white: 0.7, star: true },
  ],
  in: [
    { ms: 50, glow: "mid", scale: 1.2, iris: 0.5 },
    { ms: 50, glow: "mid", scale: 1.1, iris: 0.75 },
    { ms: 50, glow: "low", scale: 1.05, iris: 1 },
    { ms: 50, glow: "low", scale: 1, iris: 1.25 },
    { ms: 50, scale: 1, iris: 1.5 },
    { ms: 50, scale: 1, iris: 1.75 },
  ],
  reducedMotion: { fadeMs: 200 },
};

// ---------------------------------------------------------------- export

const scaled = (k: number, groups: Part[][]): Part[][] =>
  groups.map((group) =>
    group.map((part) => ({
      ...part,
      plan: part.plan.map(([x, y]) => [x * k, y * k] as const),
      z0: part.z0 * k,
      z1: part.z1 * k,
    })),
  );
const builder = (craft: Craft) => (visible: Visible) => scaled(craft.scale, craft.build(visible));

const view = (yaw: number) => (point: Point) => rotate(ENEMY_HEADINGS, yaw, point);
const visibleAt = (yaw: number) => (nx: number, ny: number) => {
  const [x, y] = rotate(ENEMY_HEADINGS, yaw, [nx, ny, 0]);
  return facing(x, y);
};

// Smallest square frame, a multiple of 16 px, holding every heading with padding.
function squareFrame(points: readonly Point[]): number {
  const extent = Math.max(
    ...points.map((point) => {
      const [x, y] = projectAt(0, 0, point);
      return Math.max(Math.abs(x), Math.abs(y));
    }),
  );
  return Math.ceil((2 * (extent + PAD)) / STEP) * STEP;
}

// SVG at display size with the viewBox in frame px.
function svgFile(title: string, frame: number, faces: readonly Face[]) {
  const centre = frame / 2;
  const shapes = faces.map(({ color, points }) => {
    const pts = points.map((p) =>
      projectAt(centre, centre, p)
        .map((n) => n.toFixed(2))
        .join(","),
    );
    return `  <polygon fill="${color}" points="${pts.join(" ")}"/>`;
  });
  const display = round(frame * DISPLAY_SCALE);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${display}" height="${display}" viewBox="0 0 ${frame} ${frame}">`,
    `  <title>${title}</title>`,
    ...shapes,
    "</svg>",
    "",
  ].join("\n");
}

const ratio = (x: string, y: string) => contrast(x.slice(1), y.slice(1));

const jetsByCraft = new Map<string, unknown>();
const entries = CRAFTS.flatMap((craft) => {
  const build = builder(craft);
  const facesAt = (yaw: number) =>
    polygons(
      build(visibleAt(yaw)),
      view(yaw),
      craft.levels.map((z) => z * craft.scale),
    );
  const frame = squareFrame(
    Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => facesAt(yaw))
      .flat()
      .flatMap(({ points }) => points),
  );
  const centre = frame / 2;
  const nose = noses(facesAt, frame, { name: craft.name, build });
  const half = (craft.mouthWidth * craft.scale) / 2;
  const jets = jetsFile(
    frame,
    (yaw) =>
      craft.mouths.map(([u, v, z]) => ({
        anchor: anchor(ENEMY_HEADINGS, centre, yaw, [
          ...uv(u * craft.scale, v * craft.scale),
          z * craft.scale,
        ]),
        axis: vector(ENEMY_HEADINGS, yaw, [0, 1, 0]),
        half: vector(ENEMY_HEADINGS, yaw, [-half, 0, 0]),
      })),
    JETS,
    { nose },
  );
  jetsByCraft.set(craft.name, JSON.parse(jets));
  // The hull is the part with the largest plan area.
  const area = ({ plan }: Part) =>
    Math.abs(
      plan.reduce((sum, [x, y], i) => {
        const [nx, ny] = plan[(i + 1) % plan.length]!;
        return sum + x * ny - nx * y;
      }, 0),
    ) / 2;
  const hull = build(() => false)
    .flat()
    .reduce((big, part) => (area(part) > area(big) ? part : big));
  const display = round(frame * DISPLAY_SCALE);
  console.log(
    `${craft.name} frame ${frame}, display ${display}, hull ${hull.top} ` +
      `${ratio(hull.top, FIELD).toFixed(2)}:1, nose ${nose.map(({ distance }) => distance).join(" ")}`,
  );
  return Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => {
    writeFileSync(
      `${OUT}${craft.name}-${yaw}.svg`,
      svgText(svgFile(`${craft.title} ${yaw}`, frame, facesAt(yaw)), 2),
    );
    return {
      id: `craft-${craft.name}-${yaw}`,
      path: `${PUBLIC}${craft.name}-${yaw}.svg`,
      width: frame,
      height: frame,
      displayWidth: display,
      displayHeight: display,
      facing: `world-${yaw}`,
      directionIndex: yaw,
      pivot: { x: 0.5, y: 0.5 },
      craft: craft.name,
    };
  });
});

writeFileSync(`${OUT}allies.json`, json({ version: 1, roster: ROSTER, song: SONG, jump: JUMP }));

const names = [...jetsByCraft.keys()].sort();
writeFileSync(
  `${OUT}${JETS_FILE}`,
  json(Object.fromEntries(names.map((name) => [name, jetsByCraft.get(name)]))),
);
replaceEntries("phantom", craftIds("craft-", names), entries);
mergeSidecars(
  "phantom",
  (craft, kind) => kind === "jets" && names.includes(craft),
  Object.fromEntries(names.map((name) => [name, { jets: `${PUBLIC}${JETS_FILE}` }])),
);
linkData("phantom", { allies: `${PUBLIC}allies.json`, whales: "/art/whales.json" });
console.log(`song colour ${glow} ${ratio(glow, FIELD).toFixed(2)}:1 on ${FIELD}`);
// Each song layer as drawn: the glow at its alpha over the tinted field, against that tint.
const over = (base: string, alpha: number) => {
  const [f, g] = [base, glow].map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  return `#${f
    .map((v, i) =>
      Math.round(v + (g![i]! - v) * alpha)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};
const tint = over(FIELD, SONG.field.alpha);
console.log(`song field ${tint} ${ratio(tint, FIELD).toFixed(2)}:1 on ${FIELD}`);
// The rim must reach 3:1 and the drone ring 4:1 over the tinted field.
for (const [layer, alpha, floor] of [
  ["rim", SONG.rim.alpha, 3],
  ["ripples", SONG.ripples.alpha, 0],
  ["drone ring", SONG.droneRing.alpha, 4],
] as const) {
  const value = ratio(over(tint, alpha), tint);
  console.log(`song ${layer} ${over(tint, alpha)} ${value.toFixed(2)}:1 over the tint`);
  if (value < floor) {
    throw new Error(`song ${layer} is ${value.toFixed(2)}:1 over the tint, below ${floor}:1`);
  }
}
