// Stranded craft for every galaxy's rescue tows but Cartwheel's (cartwheel-props.ts draws those):
// Sunflower's seed pod and scrap barge, Whirlpool's current skimmer and shell pod, Needle's stuck
// glider and spool pod, Andromeda's lost courier and drifting lamp buoy and Phantom's
// traveler's pod, at sixteen headings in the stranded-craft schema (stranded.ts). Writes each
// galaxy's frames and tow.json to public/art/<galaxy>/, replaces its craft-stranded- entries in
// that galaxy's manifest and links tow.json from it as `tow`. Contract: art/cartwheel-props.md
// "Stranded craft" and each galaxy's doc.
// Usage: node art/tools/stranded-craft.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Facing, Part } from "./cartwheel-craft.ts";
import { DISPLAY_SCALE } from "./crafts.ts";
import { ball, craftBox, craftPlan, cube, disc, FWD, hcyl, part, pill, uv } from "./hull-shapes.ts";
import { type GALAXIES, linkData, replaceEntries } from "./manifest.ts";
import { json } from "./projection.ts";
import { orientedBox, wallWindows } from "./solid.ts";
import { prettify } from "./sprite-sheet.ts";
import { type CraftSpec, exportStranded } from "./stranded.ts";

const DEG = Math.PI / 180;
// `tow` is craft-local (x, y, z) with forward -y, as POD_TOW and HAULER_TOW: the bow lug's face.

type Stranded = CraftSpec & {
  galaxy: (typeof GALAXIES)[number];
  // Gameplay's job pool subject (gameplay/quests.md "Job pool").
  subject: string;
  // The disabled look, for the docs.
  note: string;
};

// ---------------------------------------------------------------- palette
const cream = "#efe4cf";
const creamSide = "#bfae94";
const creamRear = "#a08f78";
const steelDark = "#6e7482";
const steelDarkSide = "#4f5462";
const rubber = "#3a3e4a";
const glassOff = "#2a2433";
const glassOffSide = "#1e1a26";
const blueDim = "#3f5878";
const steel = "#b8bfc9";
const steelSide = "#8a919c";
// Sunflower
const leaf = "#9ccc5a";
const leafSide = "#6c9a3a";
const bloom = "#f6d76b";
const bloomDim = "#8a7a3e";
const seedDark = "#5c5446";
const seedDarkSide = "#433d33";
const yellow = "#f2d15a";
const yellowSide = "#b99a36";
const yellowDark = "#8c7428";
const olive = "#aaa883";
const oliveSide = "#7f7d5f";
const oliveRear = "#646249";
const rust = "#b49a7c";
const rustSide = "#857057";
// Whirlpool
const lilac = "#aaa5e6";
const lilacSide = "#7c76bd";
const lilacRear = "#5f5a9c";
const lilacCap = "#c3bff0";
const glow = "#cbb8ee";
const glowDim = "#5f5a9c";
// Needle
const pearl = "#e9e3da";
const pearlSide = "#b3aba1";
const silver = "#cfc5bd";
const silverSide = "#9d948b";
const silverRear = "#7d756d";
const lav = "#c4afcc";
const lavSide = "#8f7c9c";
const rose = "#e3b7c0";
const roseSide = "#a9808a";
const needleBlue = "#70ace8";
// Andromeda
const aPearl = "#e4e2ef";
const aPearlSide = "#a9a6c2";
const aPearlDark = "#7d7a9c";
const roof = "#8d94c4";
const roofSide = "#5f6594";
const marker = "#b8c1ff";
const markerDim = "#8f9cf0";
const markerDark = "#6f78b8";
const markerDeep = "#4a5080";
// Phantom travelers
const mauve = "#ddd0e2";
const mauveSide = "#a596ad";
const mauveRear = "#7d6f86";
const band = "#a77fb2";
const bandSide = "#7a5a85";
const pack = "#b49a7c";
const packSide = "#857057";
const lampLit = "#dcbae3";
const lampDim = "#6c5d78";
const warmDim = "#c9a978";

const lug = (u: number, z: number, len = 1.6) =>
  part(craftBox(u + len / 2, 0, len, 2.4), z - 0.9, z + 0.9, steelDark, steelDarkSide);

// ---------------------------------------------------------------- Sunflower

// Seed pod: a striped sunflower-seed capsule, rounded bow and pointed tail, with a leaf collar
// and sprout at the tail, a bloom lamp that blinks while it waits and a tow lug forward.
const seedPod =
  (lit: boolean) =>
  (visible: Facing): Part[][] => [
    [
      ...hcyl(-9, 9, 0, 5.4, 5, { top: cream, side: creamSide, rear: creamRear, back: "point" }),
      ...[-1.5, 1.5].map((v) => part(craftBox(0.5, v, 13, 0.9), 10.4, 10.45, seedDark, seedDark)),
      ...(visible(1, 0)
        ? [part(craftBox(0, 5.05, 12, 0.3), 3.6, 7.2, seedDark, seedDarkSide)]
        : []),
      ...(visible(-1, 0)
        ? [part(craftBox(0, -5.05, 12, 0.3), 3.6, 7.2, seedDark, seedDarkSide)]
        : []),
    ],
    [disc(-6.5, 0, 3.6, 5.2, 8.6, leaf, leafSide, 8)],
    [cube(-8.6, -0.8, 8.4, 1.4, leaf), cube(-9.4, 0.8, 8.8, 1.2, leafSide)],
    [lug(9, 5.4)],
    [
      part(craftBox(1, 0, 0.8, 0.8), 10.4, 12.6, steelDark, steelDark),
      disc(1, 0, 1.2, 12.6, 14.4, lit ? bloom : bloomDim, lit ? "#b89a3e" : "#5e5329", 8),
    ],
  ];

// Scrap barge: an olive steel tray with a raised yellow hazard rim, heaped with scrap (plates,
// a tank, a wheel, a bent pipe), a dead cream cab on the stern quarter and a dark engine block.
const scrapBarge =
  () =>
  (visible: Facing): Part[][] => {
    const hull = craftPlan([
      [-16, -9],
      [12, -9],
      [15.5, -5],
      [15.5, 5],
      [12, 9],
      [-16, 9],
    ]);
    const cab = craftBox(-12.5, 5, 5.5, 6);
    return [
      [part(craftBox(-17.5, 0, 3, 10), 2, 6, steelDark, steelDarkSide)],
      [part(hull, 1.5, 5.5, olive, oliveSide, oliveRear)],
      ...[-1, 1].map((s) => [
        part(craftBox(-0.5, s * 8.4, 31, 1.2), 5.5, 8, yellow, yellowSide, yellowDark),
        ...[-10, -2, 6].map((u) => part(craftBox(u, s * 8.4, 2.4, 1.3), 8, 8.2, rubber, rubber)),
      ]),
      [part(craftBox(14.9, 0, 1.2, 9), 5.5, 8, yellow, yellowSide, yellowDark)],
      [part(craftBox(-15.4, 0, 1.2, 16), 5.5, 8, yellow, yellowSide, yellowDark)],
      [part(orientedBox(...uv(6, -2), FWD + 0.4, 8, 6), 5.5, 8.2, rust, rustSide)],
      [part(orientedBox(...uv(-1, 2.5), FWD - 0.3, 7, 5), 5.5, 9.4, steelDark, steelDarkSide)],
      ball(-6, -3, 9, 3.2, steel, steelSide),
      [
        disc(8, 3.5, 2.6, 5.5, 10, rubber, rubber, 10),
        disc(8, 3.5, 1, 10, 10.3, steelDark, steelDark, 6),
      ],
      [part(orientedBox(...uv(1, -4), FWD + 1.1, 11, 1.2), 9.4, 10.6, rust, rustSide)],
      [part(orientedBox(...uv(-5, 4), FWD - 0.6, 5, 4), 9.4, 11, olive, oliveSide)],
      [
        part(cab, 8, 12.5, cream, creamSide, creamRear),
        ...wallWindows(visible, 9.4, 11.4, 1, 3, cab, glassOff),
      ],
      [
        part(craftBox(-12.5, 5, 6.5, 7), 12.5, 13.3, yellow, yellowSide),
        cube(-13.5, 5, 13.3, 1.6, blueDim),
      ],
      [lug(15.5, 3.5)],
    ];
  };

// ---------------------------------------------------------------- Whirlpool

const ellipse = (u: number, v: number, ru: number, rv: number, n = 18) =>
  craftPlan(
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * 2 * Math.PI;
      return [u + ru * Math.cos(t), v + rv * Math.sin(t)] as const;
    }),
  );

// Current skimmer: a low lilac lens hull with a whale-glow band, a dark bubble canopy, two cream
// spindle floats on struts and dead twin nozzles astern.
const skimmer = () => (): Part[][] => [
  ...[-1, 1].map((s) => [part(craftBox(-17, s * 2.6, 3, 2.6), 2.4, 5, steelDark, steelDarkSide)]),
  ...[-1, 1].map((s) => [part(craftBox(-2, s * 9, 2, 5), 3, 4.4, lilacSide, lilacRear)]),
  ...[-1, 1].map((s) => [
    ...hcyl(-8, 6, s * 11.5, 3.6, 2.2, {
      top: cream,
      side: creamSide,
      rear: creamRear,
      front: "point",
      back: "point",
    }),
    part(craftBox(-1, s * 11.5, 2.4, 4.6), 1.4, 5.8, glow, lilacSide),
  ]),
  [
    part(ellipse(0, 0, 16, 7.5), 1.5, 3.2, lilac, lilacSide, lilacRear),
    part(ellipse(0, 0, 16.4, 7.9), 3.2, 4.2, glow, lilacSide),
    part(ellipse(0, 0, 15, 7), 4.2, 5.6, lilac, lilacSide, lilacRear),
    part(ellipse(-1, 0, 11.5, 5), 5.6, 6.4, lilacCap, lilacSide),
  ],
  [
    disc(4, 0, 3.4, 6.4, 7.6, glassOff, glassOffSide, 10),
    disc(4, 0, 2.4, 7.6, 8.6, glassOff, glassOffSide, 10),
  ],
  [lug(16.2, 3.6)],
];

// Shell pod (Whirlpool's pod): a round lilac shell pod with a whale-glow band, three cream shell ridges over
// its crown, a glow lamp that blinks while it waits and a tow lug forward.
const whirlPod = (lit: boolean) => (): Part[][] => [
  [
    disc(0, 0, 4, 0.5, 2.3, lilac, lilacSide, 12),
    disc(0, 0, 6, 2.3, 5.2, lilac, lilacSide, 12),
    disc(0, 0, 6.5, 5.2, 6.4, lilac, lilacSide, 12),
    disc(0, 0, 6.8, 6.4, 7.6, glow, lilacSide, 12),
    disc(0, 0, 6.5, 7.6, 8.8, lilac, lilacSide, 12),
    disc(0, 0, 6, 8.8, 11.7, lilac, lilacSide, 12),
    disc(0, 0, 4, 11.7, 13.5, lilacCap, lilacSide, 12),
  ],
  ...[-0.9, 0, 0.9].map((a) => [
    part(orientedBox(...uv(0, 0), FWD + Math.PI / 2 + a, 11, 1.1), 13.5, 14.1, cream, creamSide),
  ]),
  [lug(6.4, 7)],
  [
    part(craftBox(-2, 0, 0.8, 0.8), 13.5, 15.6, steelDark, steelDark),
    disc(-2, 0, 1.2, 15.6, 17.4, lit ? glow : glowDim, lit ? lilacSide : "#46427a", 8),
  ],
];

// ---------------------------------------------------------------- Needle

// Stuck glider: a silver Weaver shuttle hull, pointed at both ends like a loom shuttle, carrying
// an upright rose thread bobbin, snagged in loose lavender thread that trails astern; dark canopy.
const stuckGlider = () => (): Part[][] => {
  const hull = (k: number) =>
    craftPlan([
      [-16, 0],
      [-8, -4.6 * k],
      [8, -4.6 * k],
      [16, 0],
      [8, 4.6 * k],
      [-8, 4.6 * k],
    ]);
  return [
    [part(orientedBox(...uv(-21, 3), FWD + 0.35, 12, 0.9), 4.2, 5.2, lav, lavSide)],
    [
      part(hull(0.72), 1.6, 2.8, silver, silverSide, silverRear),
      part(hull(1), 2.8, 6, silver, silverSide, silverRear),
      part(hull(0.72), 6, 7.2, silver, silverSide, silverRear),
    ],
    [part(pill(7, 13, 0, 1.8, "point", "round"), 7.2, 8.8, glassOff, glassOffSide)],
    [
      disc(-2, 0, 3.6, 7.2, 8, pearl, pearlSide, 12),
      disc(-2, 0, 2.7, 8, 11, rose, roseSide, 12),
      disc(-2, 0, 2.8, 9.2, 9.8, lav, lavSide, 12),
      disc(-2, 0, 3.6, 11, 11.8, pearl, pearlSide, 12),
    ],
    ...[0.5, -0.7, 1.3].map((a, i) => [
      part(
        orientedBox(...uv(-2 + i * 2, 0), FWD + a, 15 - i * 2, 0.8),
        7.3 + i * 0.6,
        7.9 + i * 0.6,
        lav,
        lavSide,
      ),
    ]),
    [cube(-9, -4.2, 5, 1, blueDim)],
    [cube(-9, 4.2, 5, 1, blueDim)],
    [lug(16, 4.4)],
  ];
};

// Spool pod (Needle's pod): an upright thread spool, pearl flanges round a lavender core wound with silver
// bands, a blue lamp that blinks on the top flange and a tow lug on the core.
const spoolPod = (lit: boolean) => (): Part[][] => [
  [
    disc(0, 0, 6.2, 0, 1.6, pearl, pearlSide, 14),
    disc(0, 0, 4.3, 1.6, 9.4, lav, lavSide, 14),
    disc(0, 0, 4.45, 3.6, 4.3, silver, silverSide, 14),
    disc(0, 0, 4.45, 6.4, 7.1, silver, silverSide, 14),
    disc(0, 0, 6.2, 9.4, 11, pearl, pearlSide, 14),
    disc(0, 0, 3.4, 11, 11.4, silver, silverSide, 14),
  ],
  [part(craftBox(5.4, 0, 2.6, 2.4), 4.6, 6.2, steelDark, steelDarkSide)],
  [disc(0, 0, 1.1, 11.4, 13.2, lit ? needleBlue : blueDim, lit ? "#5687ba" : "#33475f", 8)],
];

// ---------------------------------------------------------------- Andromeda

// Lost courier: a pearl settlers' mail capsule with a slate-blue roof stripe, a rack of cream and
// periwinkle mail crates on its back (one crate drifted loose), dark bow panes, a dead courier
// lamp on a mast and two dark engine bells.
const lostCourier =
  () =>
  (visible: Facing): Part[][] => [
    ...[-1, 1].map((s) =>
      hcyl(-17, -13, s * 2.8, 5.4, 2.1, {
        top: steelDark,
        side: steelDarkSide,
        front: "flat",
        back: "flat",
      }),
    ),
    [
      ...hcyl(-14, 12, 0, 6, 5, { top: aPearl, side: aPearlSide, rear: aPearlDark, back: "flat" }),
      part(craftBox(-1, 0, 22, 2.2), 11, 11.2, roof, roofSide),
      ...(visible(0, -1)
        ? [
            part(craftBox(10.4, -1.8, 0.6, 2), 7.6, 9.4, glassOff, glassOff),
            part(craftBox(10.4, 1.8, 0.6, 2), 7.6, 9.4, glassOff, glassOff),
          ]
        : []),
    ],
    [part(craftBox(-3, 0, 14, 8), 11, 11.6, steelDark, steelDarkSide)],
    ...[-8, -3, 2].flatMap((u, i) =>
      [-1, 1].map((s) => [
        part(
          craftBox(u, s * 2, 4, 3.4),
          11.6,
          14,
          (i + s) % 2 ? cream : markerDim,
          (i + s) % 2 ? creamSide : markerDark,
        ),
      ]),
    ),
    [part(orientedBox(...uv(4, 9), FWD + 0.7, 3.6, 3), 9, 11.6, cream, creamSide)],
    [
      part(craftBox(6, 0, 0.8, 0.8), 11.2, 16, steelDark, steelDark),
      disc(6, 0, 1.3, 16, 17.8, markerDeep, "#383d62", 8),
    ],
    [lug(12, 6)],
  ];

// Drifting lamp buoy: a pearl float with a marker-dark band, a short pearl post, and a lantern
// under a slate-blue cap that blinks while it waits; a mooring eye forward.
const lampBuoy = (lit: boolean) => (): Part[][] => [
  [
    disc(0, 0, 4.6, 0, 1.2, aPearl, aPearlSide, 10),
    disc(0, 0, 6, 1.2, 3.4, aPearl, aPearlSide, 10),
    disc(0, 0, 6.2, 2, 2.8, markerDark, markerDeep, 10),
    disc(0, 0, 4.6, 3.4, 4.2, aPearl, aPearlSide, 10),
  ],
  [
    disc(0, 0, 1.6, 4.2, 10.4, aPearl, aPearlSide, 8),
    disc(0, 0, 1.75, 6.6, 7.8, markerDark, markerDeep, 8),
  ],
  [
    disc(0, 0, 2.6, 10.4, 11, cream, creamSide, 8),
    disc(0, 0, 2.1, 11, 14, lit ? marker : markerDeep, lit ? markerDark : "#383d62", 8),
    ...(lit ? [disc(0, 0, 0.9, 14, 14.2, "#ffffff", "#ffffff", 6)] : []),
    disc(0, 0, 2.8, 14.2, 15.2, roof, roofSide, 8),
  ],
  [part(craftBox(6.6, 0, 1.8, 1.6), 1.4, 3, steelDark, steelDarkSide)],
];

// ---------------------------------------------------------------- Phantom

// Traveler's pod: a pale mauve capsule with a mauve band, dim warm portholes, two tan luggage
// bundles strapped on its back and a pale lilac distress lamp that blinks; a tow lug forward.
const travelerPod =
  (lit: boolean) =>
  (visible: Facing): Part[][] => [
    [
      ...hcyl(-8, 8, 0, 6, 5.4, { top: mauve, side: mauveSide, rear: mauveRear }),
      ...hcyl(-1.2, 1.2, 0, 6, 5.7, { top: band, side: bandSide, front: "flat", back: "flat" }),
      ...[-4.5, 4.5].flatMap((u) =>
        [-1, 1]
          .filter((s) => visible(s, 0))
          .map((s) => part(craftBox(u, s * 5.5, 1.8, 0.4), 5.2, 7, warmDim, warmDim)),
      ),
    ],
    ...[-4.2, 3.6].map((u, i) => [
      part(craftBox(u, 0, 4.4, 5.6 - i), 11.4, 14 - i * 0.6, pack, packSide),
      part(craftBox(u, 0, 0.7, 6 - i), 11.4, 14.2 - i * 0.6, steelDarkSide, rubber),
    ]),
    [lug(8, 6)],
    [
      part(craftBox(0.2, 0, 0.8, 0.8), 11.4, 15.8, steelDark, steelDark),
      disc(0.2, 0, 1.2, 15.8, 17.6, lit ? lampLit : lampDim, lit ? band : "#4a3f53", 8),
    ],
  ];

const blink = (build: (lit: boolean) => (visible: Facing) => Part[][]) => [
  { name: "a", build: build(true) },
  { name: "b", build: build(false) },
];

const CRAFT: readonly Stranded[] = [
  {
    id: "stranded-seed-pod",
    galaxy: "sunflower",
    subject: "a seed pod",
    title: "Seed pod",
    scale: 1.6,
    roll: 0,
    pitch: 0,
    levels: [10.4],
    tow: [0, -10.6, 5.4],
    frames: blink(seedPod),
    note: "Blinking bloom lamp (a lit, b dim)",
  },
  {
    id: "stranded-scrap-barge",
    galaxy: "sunflower",
    subject: "a scrap barge",
    title: "Scrap barge",
    scale: 1.7,
    roll: 10 * DEG,
    pitch: -4 * DEG,
    levels: [5.5, 8, 12.5],
    tow: [0, -17.1, 3.5],
    frames: [{ name: "", build: scrapBarge() }],
    note: "Dark cab glass, dim lamp, listing 10 to starboard, 4 nose down",
  },
  {
    id: "stranded-current-skimmer",
    galaxy: "whirlpool",
    subject: "a current skimmer",
    title: "Current skimmer",
    scale: 1.5,
    roll: -14 * DEG,
    pitch: 3 * DEG,
    levels: [6.4],
    tow: [0, -17.8, 3.6],
    frames: [{ name: "", build: skimmer() }],
    note: "Dark canopy, listing 14 to port, 3 nose up",
  },
  {
    id: "stranded-whirlpool-pod",
    galaxy: "whirlpool",
    subject: "a pod",
    title: "Shell pod",
    scale: 1.6,
    roll: 0,
    pitch: 0,
    levels: [13.5],
    tow: [0, -8, 7],
    frames: blink(whirlPod),
    note: "Blinking glow lamp (a lit, b dim)",
  },
  {
    id: "stranded-glider",
    galaxy: "needle",
    subject: "a stuck glider",
    title: "Stuck glider",
    scale: 1.5,
    roll: -14 * DEG,
    pitch: -6 * DEG,
    levels: [7.2],
    tow: [0, -17.6, 4.4],
    frames: [{ name: "", build: stuckGlider() }],
    note: "Dark canopy, dim lamps, snagged thread, listing 14 to port, 6 nose down",
  },
  {
    id: "stranded-needle-pod",
    galaxy: "needle",
    subject: "a pod",
    title: "Spool pod",
    scale: 1.6,
    roll: 0,
    pitch: 0,
    levels: [11],
    tow: [0, -6.7, 5.4],
    frames: blink(spoolPod),
    note: "Blinking blue lamp (a lit, b dim)",
  },
  {
    id: "stranded-courier",
    galaxy: "andromeda",
    subject: "a lost courier",
    title: "Lost courier",
    scale: 1.5,
    roll: 12 * DEG,
    pitch: -5 * DEG,
    levels: [11, 11.6],
    tow: [0, -13.6, 6],
    frames: [{ name: "", build: lostCourier() }],
    note: "Dark panes, dead courier lamp, one crate adrift, listing 12 to starboard, 5 nose down",
  },
  {
    id: "stranded-lamp-buoy",
    galaxy: "andromeda",
    subject: "a drifting lamp buoy",
    title: "Drifting lamp buoy",
    scale: 1.6,
    roll: 10 * DEG,
    pitch: 6 * DEG,
    levels: [4.2, 10.4],
    tow: [0, -7.5, 2.2],
    frames: blink(lampBuoy),
    note: "Blinking lantern (a lit, b dim), drifting tilt 10 and 6",
  },
  {
    id: "stranded-traveler-pod",
    galaxy: "phantom",
    subject: "a traveler's pod",
    title: "Traveler's pod",
    scale: 1.6,
    roll: 0,
    pitch: 0,
    levels: [11.4],
    tow: [0, -9.6, 6],
    frames: blink(travelerPod),
    note: "Dim warm portholes, blinking pale lilac lamp (a lit, b dim)",
  },
];

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
for (const galaxy of [...new Set(CRAFT.map((c) => c.galaxy))]) {
  const dir = `${art}${galaxy}/`;
  const path = `/art/${galaxy}/`;
  mkdirSync(dir, { recursive: true });
  const specs = CRAFT.filter((c) => c.galaxy === galaxy);
  const craft = specs.map((spec) => exportStranded(spec, dir, path));
  // The tow line itself is shared: the core manifest's `tow` link (art/cartwheel-props.md).
  const tow = `${dir}tow.json`;
  writeFileSync(
    tow,
    json({ version: 1, displayScale: DISPLAY_SCALE, craft: craft.map(({ data }) => data) }),
  );
  await prettify(tow);
  const owned = new RegExp(`^craft-(${specs.map(({ id }) => id).join("|")})-\\d+(-[ab])?$`);
  replaceEntries(
    galaxy,
    (id) => owned.test(id),
    craft.flatMap(({ entries }) => entries),
  );
  linkData(galaxy, { tow: `${path}tow.json` });
  for (const [i, { data }] of craft.entries()) {
    console.log(`${galaxy} ${data.id} "${specs[i]!.subject}" frame ${data.frame}`);
  }
}
