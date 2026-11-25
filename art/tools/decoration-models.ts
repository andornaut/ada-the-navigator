// The rare giant backdrop decorations as solids: three formations per galaxy on its own theme,
// each one connected solid or a small group of them, built in world units (x and y on the plan,
// z up) and drawn as built. A formation uses three materials by tone index into the galaxy's
// three decoration tones, light to dark: the main solid, a quieter second solid and the ring
// tone.
import type { ManifestFile } from "./manifest.ts";
import type { Point } from "./projection.ts";
import {
  type Mesh,
  meshBar,
  meshBlock,
  meshDome,
  meshExtrude,
  meshFace,
  meshHoop,
  meshPlace,
  meshRing,
  meshSpiral,
  meshTube,
  type Tones,
} from "./solid.ts";

type GalaxyId = Exclude<ManifestFile, "core">;

// Tone indices as the mesh layer's colours; the drawing maps them to the galaxy's tones.
const MAIN: Tones = ["0", "1", "2"];
const SECOND: Tones = ["1", "2", "2"];
const RING: Tones = ["2", "2", "2"];

const DEGREES = Math.PI / 180;
const polar = (radius: number, degrees: number): [number, number] => [
  radius * Math.cos(degrees * DEGREES),
  radius * Math.sin(degrees * DEGREES),
];
const unit = ([x, y, z]: Point): Point => {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
};
const scaled = ([x, y, z]: Point, k: number): Point => [x * k, y * k, z * k];
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const UP: Point = [0, 0, 1];

const ball = (mesh: Mesh, centre: Point, radius: number) =>
  meshDome(mesh, centre, radius, MAIN, { full: true, sides: 56, bands: 14 });

// A level ring about `centre` from z0 to z1.
const ring = (
  mesh: Mesh,
  centre: readonly [number, number],
  [z0, z1]: readonly [number, number],
  [outer, inner]: readonly [number, number],
  tones: Tones,
) => meshRing(mesh, centre, z0, z1, outer, inner, tones, 96);

// A drum or frustum about (x, y) from z0 to z1, `base` wide below and `top` wide above.
const drum = (
  mesh: Mesh,
  [x, y]: readonly [number, number],
  [z0, z1]: readonly [number, number],
  [base, top]: readonly [number, number],
  tones: Tones,
  sides = 48,
) => meshTube(mesh, [x, y, z0], [x, y, z1], base, top, tones, sides);

// A thick leaf-shaped slab pointing outward at `degrees`, from radius r0 to r1.
function petal(
  mesh: Mesh,
  degrees: number,
  [r0, r1]: readonly [number, number],
  width: number,
  [z0, z1]: readonly [number, number],
): void {
  const [ex, ey] = polar(1, degrees);
  const length = r1 - r0;
  const steps = 28;
  const half = Array.from({ length: steps + 1 }, (_, i): [number, number] => [
    (length * (1 - Math.cos((Math.PI * i) / steps))) / 2,
    (width / 2) * Math.sin((Math.PI * i) / steps) ** 0.8,
  ]);
  const outline = [
    ...half,
    ...half
      .slice(1, -1)
      .toReversed()
      .map(([u, v]): [number, number] => [u, -v]),
  ];
  meshExtrude(
    mesh,
    outline.map(([u, v]): Point => [ex * (r0 + u) - ey * v, ey * (r0 + u) + ex * v, z0]),
    [0, 0, z1 - z0],
    MAIN,
  );
}

// A slab of `arms` bars meeting at a round hub.
function armSlab(
  mesh: Mesh,
  reach: number,
  width: number,
  levels: readonly [number, number],
  turn = 90,
  arms = 3,
): void {
  for (let i = 0; i < arms; i++) {
    meshBar(mesh, turn + (360 / arms) * i, 0, reach, width, levels[0], levels[1], MAIN);
  }
  drum(mesh, [0, 0], levels, [width * 0.62, width * 0.62], MAIN, 24);
}

// A needle of two cones, tip to tip `2 * reach` long, along `axis`.
function needle(mesh: Mesh, axis: Point, reach: number, radius: number): void {
  meshTube(mesh, [0, 0, 0], scaled(axis, reach), radius, 0.1, SECOND, 32);
  meshTube(mesh, [0, 0, 0], scaled(axis, -reach), radius, 0.1, SECOND, 32);
}

// A saucer about (x, y) with its rim's underside at height z: a keel, a rim, a cabin and a lamp.
function saucer(
  mesh: Mesh,
  centre: readonly [number, number],
  radius: number,
  z = 0,
  lamp = true,
): void {
  drum(mesh, centre, [z - radius * 0.16, z], [radius * 0.62, radius], MAIN, 64);
  drum(mesh, centre, [z, z + radius * 0.07], [radius, radius], MAIN, 64);
  drum(
    mesh,
    centre,
    [z + radius * 0.07, z + radius * 0.22],
    [radius * 0.52, radius * 0.34],
    SECOND,
  );
  if (lamp) {
    meshDome(mesh, [centre[0], centre[1], z + radius * 0.22], radius * 0.22, MAIN, {
      sides: 36,
      bands: 9,
    });
  }
}

const SPOKES = [45, 135, 225, 315];

export function decorationMesh(galaxy: GalaxyId, variant: number): Mesh {
  const mesh: Mesh = [];
  if (galaxy === "sunflower") {
    if (variant === 0) {
      ball(mesh, [0, 0, 0], 100);
      ring(mesh, [0, 0], [-5, 5], [190, 140], RING);
    } else if (variant === 1) {
      for (let i = 0; i < 8; i++) petal(mesh, 22.5 + 45 * i, [70, 200], 95, [-14, 14]);
      drum(mesh, [0, 0], [-22, 22], [80, 80], SECOND);
      meshDome(mesh, [0, 0, 22], 58, MAIN, { sides: 48, bands: 12 });
    } else {
      ball(mesh, [-60, 60, 0], 70);
      ring(mesh, [-60, 60], [-4, 4], [130, 96], RING);
      for (const [i, [reach, size]] of [
        [230, 26],
        [250, 34],
        [230, 22],
      ].entries()) {
        const [x, y] = polar(reach!, -62 + 28 * i);
        ball(mesh, [x - 60, y + 60, 0], size!);
      }
    }
  } else if (galaxy === "cartwheel") {
    if (variant === 0) {
      ring(mesh, [0, 0], [-14, 14], [200, 158], MAIN);
      for (const spoke of SPOKES) meshBar(mesh, spoke, 30, 160, 34, -9, 9, SECOND);
      drum(mesh, [0, 0], [-45, 45], [40, 40], SECOND);
    } else if (variant === 1) {
      for (const [z, outer] of [
        [70, 150],
        [-70, 190],
      ] as const) {
        ring(mesh, [0, 0], [z - 13, z + 13], [outer, outer - 40], MAIN);
        for (const spoke of SPOKES) {
          meshBar(mesh, spoke, 26, outer - 38, 30, z - 8, z + 8, SECOND);
        }
      }
      drum(mesh, [0, 0], [-150, 150], [34, 34], SECOND);
    } else {
      const axle = unit([1, 0.15, 0]);
      meshHoop(mesh, [0, 0, 0], axle, 200, 160, 30, MAIN, 72);
      for (const spoke of [cross(axle, UP), UP]) {
        meshBlock(mesh, [0, 0, 0], [spoke, cross(axle, spoke), axle], [162, 16, 9], SECOND);
      }
      meshTube(mesh, scaled(axle, -120), scaled(axle, 120), 36, 36, SECOND);
    }
  } else if (galaxy === "whirlpool") {
    const [arms, sweep, inner] = (
      [
        [2, 250, 70],
        [3, 170, 70],
        [1, 470, 60],
      ] as const
    )[variant]!;
    const shape = {
      radius: (travelled: number) => inner + (150 * travelled) / sweep + 22,
      width: (travelled: number) => 52 - (14 * travelled) / sweep,
      top: (travelled: number) => 14 - (10 * travelled) / sweep,
      bottom: (travelled: number) => -14 + (4 * travelled) / sweep,
    };
    for (let i = 0; i < arms; i++) {
      const turn = (360 / arms) * i + 40;
      meshSpiral(mesh, turn, 0, sweep, shape, MAIN, 4);
      // The arm's starting end, which the spiral leaves open.
      const [x, y] = polar(1, turn);
      const [near, far] = [
        shape.radius(0) - shape.width(0) / 2,
        shape.radius(0) + shape.width(0) / 2,
      ];
      meshFace(
        mesh,
        [
          [x * near, y * near, shape.bottom(0)],
          [x * far, y * far, shape.bottom(0)],
          [x * far, y * far, shape.top(0)],
          [x * near, y * near, shape.top(0)],
        ],
        [y, -x, 0],
        MAIN,
      );
    }
    drum(mesh, [0, 0], [-44, 44], [78, 78], SECOND);
    meshDome(mesh, [0, 0, 44], 46, MAIN, { sides: 48, bands: 12 });
  } else if (galaxy === "needle") {
    const level = unit([1, -1, 0]);
    if (variant === 0) {
      ring(mesh, [0, 0], [-13, 13], [120, 78], MAIN);
      needle(mesh, level, 215, 36);
    } else if (variant === 1) {
      for (const side of [-1, 1]) {
        ring(mesh, [level[0] * 105 * side, level[1] * 105 * side], [-11, 11], [92, 58], MAIN);
      }
      needle(mesh, level, 270, 32);
    } else {
      const through = unit([1, 0.15, 0]);
      meshHoop(mesh, [0, 0, 0], through, 150, 104, 34, MAIN, 72);
      needle(mesh, through, 260, 34);
    }
  } else if (galaxy === "andromeda") {
    if (variant === 0) {
      saucer(mesh, [0, 0], 200);
    } else if (variant === 1) {
      saucer(mesh, [0, 0], 190, -70, false);
      saucer(mesh, [0, 0], 130, 60);
      drum(mesh, [0, 0], [-40, 60], [30, 30], SECOND);
    } else {
      saucer(mesh, [-150, 150], 130, 40);
      saucer(mesh, [40, -40], 95, 0);
      saucer(mesh, [170, -170], 62, -30);
    }
  } else if (variant === 0) {
    armSlab(mesh, 210, 62, [30, 56]);
    drum(mesh, [0, 0], [-150, 30], [8, 30], SECOND);
  } else if (variant === 1) {
    armSlab(mesh, 125, 50, [80, 104]);
    armSlab(mesh, 215, 60, [-70, -44], 150);
    drum(mesh, [0, 0], [-170, 70], [8, 28], SECOND);
  } else {
    for (const [x, y, reach, width, turn] of [
      [-120, 120, 150, 50, 90],
      [150, -150, 95, 38, 150],
    ] as const) {
      const part: Mesh = [];
      armSlab(part, reach, width, [20, 20 + width * 0.42], turn);
      drum(part, [0, 0], [-reach * 0.8, 20], [6, width * 0.45], SECOND);
      mesh.push(...meshPlace(part, 0, 1, [x, y, 0]));
    }
  }
  return mesh;
}
