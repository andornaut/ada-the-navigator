import type { Craft, Part, Plan } from "./crafts.ts";

type Materials = {
  box: (x0: number, y0: number, x1: number, y1: number) => Plan;
  insignia: (x: number, y: number, radius: number, z: number) => Part[];
  plate: string;
  side: string;
  rear: string;
  dark: string;
};

const cargoPaint = {
  hull: "#687c97",
  armor: "#8a9db2",
  shoulder: "#516681",
  side: "#3b4c64",
  rear: "#273243",
  saddle: "#6c6383",
  recess: "#45435a",
  glass: "#24263b",
};

const miningPaint = {
  hull: "#55928a",
  armor: "#65a097",
  bevel: "#467971",
  side: "#355d58",
  rear: "#294946",
  scoop: "#3a6864",
  metal: "#a1aaa0",
  recess: "#324b4c",
};

const industrialColors = new Set([...Object.values(cargoPaint), ...Object.values(miningPaint)]);

// Industrial paint belongs to the hull across all salvage fleets.
export function isIndustrialHullColor(file: string, color: string): boolean {
  return (
    /^retaliator(?:CargoHauler|MiningFreighter)?-(?:\d+\.svg|shards\.json)$/u.test(file) &&
    industrialColors.has(color)
  );
}

function solid(
  paint: { side: string; rear: string },
  plan: Plan,
  z0: number,
  z1: number,
  top: string,
): Part {
  return { plan, z0, z1, top, side: paint.side, rear: paint.rear };
}

function surface(plan: Plan, z: number, top: string): Part {
  return { plan, z0: z, z1: z, top, side: top, decal: true };
}

const signed = (sign: number, plan: Plan): Plan => plan.map(([x, y]) => [sign * x, y]);
const bilateral = (half: Plan): Plan => [...half, ...signed(-1, half).toReversed()];

/** Industrial bodies retain the source turret, barrels and flight attachments. */
export function industrialRetaliators({ insignia }: Materials, source: Craft) {
  const turret = source.parts.filter((part) => part.turret);
  const deck = source.parts[0]!.z1;

  const cargo: Craft = {
    ...source,
    title: "Cargo hauler",
    variant: "cargo",
    parts: [
      // The armor runs from the tapered bow to the common stern drive housing.
      solid(
        cargoPaint,
        bilateral([
          [7, -50],
          [16, -42],
          [21, -26],
          [27, -10],
          [35, 0],
          [43, 12],
          [36, 20],
          [23, 29],
          [15, 41],
          [12, 50],
        ]),
        0,
        deck,
        cargoPaint.hull,
      ),
      ...[-1, 1].map((sign) =>
        surface(
          signed(sign, [
            [17, -8],
            [28, 0],
            [38, 12],
            [27, 22],
            [20, 26],
            [22, 13],
            [16, 3],
          ]),
          deck,
          cargoPaint.shoulder,
        ),
      ),
      solid(
        cargoPaint,
        bilateral([
          [6, -38],
          [11, -33],
          [13, -22],
          [16, -9],
          [11, 9],
        ]),
        deck,
        10,
        cargoPaint.armor,
      ),
      solid(
        cargoPaint,
        bilateral([
          [4, -35],
          [8, -30],
          [8, -24],
          [5, -21],
        ]),
        10,
        10.7,
        cargoPaint.glass,
      ),
      // The sloped-looking rim and darker floor keep the storage saddle visually inboard.
      surface(
        bilateral([
          [13, 8],
          [20, 16],
          [16, 26],
          [9, 37],
        ]),
        deck,
        cargoPaint.recess,
      ),
      solid(
        cargoPaint,
        bilateral([
          [11, 11],
          [16, 17],
          [12, 25],
          [7, 35],
        ]),
        deck,
        deck + 0.2,
        cargoPaint.saddle,
      ),
      // This coplanar seam shares the saddle's plan centre so it draws over the floor.
      solid(
        cargoPaint,
        bilateral([
          [8, 20.8],
          [10, 22],
          [8, 23.2],
        ]),
        deck + 0.2,
        deck + 0.2,
        cargoPaint.recess,
      ),
      solid(
        cargoPaint,
        bilateral([
          [9, 35],
          [14, 42],
          [11, 49],
        ]),
        deck,
        10,
        cargoPaint.armor,
      ),
      solid(
        cargoPaint,
        bilateral([
          [6, 45],
          [7, 49],
        ]),
        10,
        10.2,
        cargoPaint.rear,
      ),
      ...[-1, 1].map((sign) =>
        solid(
          cargoPaint,
          signed(sign, [
            [8, 39],
            [12.5, 43],
            [11, 48],
            [8, 45],
          ]),
          10,
          10.2,
          cargoPaint.shoulder,
        ),
      ),
      ...insignia(0, -44, 3.2, deck),
      ...turret,
    ],
    mouths: [
      [-7, 50],
      [0, 50],
      [7, 50],
    ],
    mouthWidth: 5,
    mouthZ: 6,
  };

  const mining: Craft = {
    ...source,
    title: "Mining freighter",
    variant: "mining",
    parts: [
      // Tapered cheeks enclose the extraction bay and join at the stern.
      solid(
        miningPaint,
        [
          [-12, -10],
          [-17, -23],
          [-24, -35],
          [-30, -39],
          [-38, -35],
          [-47, -10],
          [-47, 14],
          [-40, 19],
          [-27, 23],
          [-24, 25],
          [24, 25],
          [27, 23],
          [40, 19],
          [47, 14],
          [47, -10],
          [38, -35],
          [30, -39],
          [24, -35],
          [17, -23],
          [12, -10],
        ],
        0,
        deck,
        miningPaint.hull,
      ),
      ...[-1, 1].flatMap((sign) => [
        surface(
          signed(sign, [
            [29, -34],
            [36, -31],
            [44, -9],
            [44, 11],
            [36, 16],
            [22, 18],
            [26, 4],
            [24, -17],
          ]),
          deck,
          miningPaint.bevel,
        ),
        solid(
          miningPaint,
          signed(sign, [
            [29, -32],
            [34, -30],
            [40, -10],
            [39, 8],
            [31, 13],
            [25, 5],
            [24, -16],
          ]),
          deck,
          10,
          miningPaint.armor,
        ),
        solid(
          miningPaint,
          signed(sign, [
            [29, -30],
            [32, -28],
            [34, -22],
            [31, -17],
            [26, -23],
          ]),
          10,
          10.25,
          miningPaint.scoop,
        ),
        solid(
          miningPaint,
          signed(sign, [
            [3, -7],
            [3, -15],
            [6, -18],
            [9, -15],
            [10, -7],
          ]),
          5,
          8,
          miningPaint.metal,
        ),
      ]),
      solid(
        miningPaint,
        [
          [-12, -11],
          [-9, -6],
          [9, -6],
          [12, -11],
        ],
        deck,
        8.5,
        cargoPaint.glass,
      ),
      solid(
        miningPaint,
        [
          [-9, 8],
          [9, 8],
          [17, 17],
          [19, 24],
          [-19, 24],
          [-17, 17],
        ],
        deck,
        10,
        miningPaint.armor,
      ),
      solid(
        miningPaint,
        [
          [-13, 18],
          [13, 18],
          [16, 22],
          [-16, 22],
        ],
        10,
        10.6,
        miningPaint.recess,
      ),
      ...insignia(-15, 3, 4.5, deck),
      ...turret,
    ],
    mouths: [
      [-19, 25],
      [0, 25],
      [19, 25],
    ],
    mouthZ: 6,
  };
  return { cargo, mining };
}
