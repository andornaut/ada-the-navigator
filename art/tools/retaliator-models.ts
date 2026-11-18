import type { Craft, Part, Plan } from "./crafts.ts";

type Materials = {
  box: (x0: number, y0: number, x1: number, y1: number) => Plan;
  insignia: (x: number, y: number, radius: number, z: number) => Part[];
  plate: string;
  side: string;
  rear: string;
  dark: string;
};

/** Industrial bodies retain the source turret and barrels, without adding firing geometry. */
export function industrialRetaliators(materials: Materials, source: Craft) {
  const { box, dark, insignia, plate, rear, side } = materials;
  const body = source.parts.filter((part) => !part.decal);
  const solid = (plan: Plan, z0: number, z1: number, top = plate): Part => ({
    plan,
    z0,
    z1,
    top,
    side,
  });
  const cargo: Craft = {
    ...source,
    title: "Cargo hauler",
    variant: "cargo",
    parts: [
      ...body,
      solid(box(-34, -13, -16, 24), 7, 17),
      solid(box(16, -13, 34, 24), 7, 17),
      solid(box(-12, 14, 12, 27), 7, 20),
      ...[-28, -21, 21, 28].map((x) => solid(box(x, -13, x + 2, 24), 17, 18, rear)),
      ...insignia(-34, -21, 4.5, 7),
    ],
  };
  const mining: Craft = {
    ...source,
    title: "Mining freighter",
    variant: "mining",
    parts: [
      ...body,
      solid(box(-34, -2, -15, 25), 7, 14),
      solid(box(-31, 1, -18, 22), 14, 14.4, dark),
      solid(box(16, -8, 34, 22), 7, 12),
      solid(box(24, -10, 30, -3), 12, 27),
      solid(
        [
          [27, -10],
          [43, -19],
          [47, -13],
          [30, -3],
        ],
        21,
        25,
      ),
      solid(
        [
          [40, -24],
          [45, -29],
          [50, -24],
          [48, -12],
          [43, -10],
        ],
        13,
        19,
        dark,
      ),
      ...[-23, -17, -11].map((y) => solid(box(44, y, 51, y + 2), 19, 20)),
      solid(box(-10, 15, 11, 27), 7, 13),
      ...insignia(-34, -21, 4.5, 7),
    ],
  };
  return { cargo, mining };
}
