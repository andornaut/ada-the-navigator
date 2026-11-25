import file from "../../public/art/enemy-weapons.json" with { type: "json" };

// CLEANUP (added 2026-11-25): the flat-look keys the enemy weapon readers take, laid over the
// shipped public/art/enemy-weapons.json (art/weapons.md "Flat look"). Remove this fixture and
// read the file directly once Art regenerates it with these keys.
const beam = (
  widths: readonly (readonly [number, number])[],
  radii: readonly number[],
): {
  bloom: { colour: string; radius: number }[];
  layers: { colour: string; width: readonly [number, number] }[];
} => {
  const colours = ["obstacle", "plate", "white"];
  return {
    bloom: radii.map((radius, index) => ({ colour: colours[index]!, radius })),
    layers: widths.map((width, index) => ({ colour: colours[index]!, width })),
  };
};

export const ENEMY_WEAPONS_FLAT = {
  ...file,
  lance: {
    ...file.lance,
    ...beam(
      [
        [9, 6.8],
        [5.4, 4],
        [2.4, 1.6],
      ],
      [6.5, 4.2, 2.3],
    ),
  },
  mine: { ...file.mine, spin: { degPerSecond: 60, stepDeg: 11.25 } },
  phaser: {
    ...file.phaser,
    ...beam(
      [
        [8, 5],
        [4.6, 2.8],
        [2.2, 1.3],
      ],
      [5, 3.1, 1.6],
    ),
    aiming: { ...file.phaser.aiming, width: 1.5 },
    chevron: [
      [3, 0],
      [-1, -3],
      [-1, 3],
    ],
    solid: { ...file.phaser.solid, width: 1.5 },
  },
  ringBurst: {
    ...file.ringBurst,
    dart: {
      inner: [
        [1, 0],
        [-0.6, -1],
        [-2.2, 0],
        [-0.6, 1],
      ],
      innerColour: "white",
      outer: [
        [2.6, 0],
        [-0.6, -2.3],
        [-3.8, 0],
        [-0.6, 2.3],
      ],
      outerColour: "obstacle",
      tail: {
        colour: "coralSide",
        points: [
          [-3.2, -1],
          [-10, 0],
          [-3.2, 1],
        ],
      },
    },
    emission: {
      ...file.ringBurst.emission,
      alpha: [
        [90, 1],
        [180, 0.5],
      ],
      stroke: 2,
    },
  },
};
