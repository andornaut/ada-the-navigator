// The missiles and the mine as solid models (art/weapons.md, Missile and mine frames): Ada's and
// the enemies' Rapid and Heavy missiles at 32 headings without their flames, which the game
// draws, and the mine through a quarter turn of its spin, lit and on a blink. `node art/tools/weapon-solids.ts` writes their
// sheets beside the shipped art and stages their manifest rows.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DISPLAY_SCALE } from "./crafts.ts";
import { pathData } from "./debris.ts";
import { tonePaths } from "./fleet.ts";
import { writeOnce } from "./manifest.ts";
import { stageRows } from "./polish-rows.ts";
import { type Point, rotate } from "./projection.ts";
import {
  type Mesh,
  meshBall,
  meshDome,
  meshExtrude,
  meshScale,
  meshTube,
  type Tones,
} from "./solid.ts";
import { svgText } from "./svg-text.ts";
import { type V2, visibleFragments } from "./visible.ts";

const WHITE: Tones = ["#ffffff", "#cfd3e0", "#9da2b8"];
const AMBER: Tones = ["#f0bd68", "#b98a40", "#8a6630"];
const CORAL: Tones = ["#d68b72", "#a8654f", "#7f4b3d"];
const DARK: Tones = ["#2a2433", "#1e1a26", "#16131c"];
const BLINK: Tones = ["#ffffff", "#ffffff", "#e8e8f0"];
// The coral family's salvage plate (art/enemies.md) as a material.
const PLATE: Tones = ["#e6a890", "#b98774", "#8f6859"];

// Missile materials in lit, mid and shade order.
type MissileTones = { body: Tones; fins: Tones; warhead: Tones };
const RAPID_GOLD: Tones = ["#ffda48", "#eab52f", "#ae751c"];
const ADA_RAPID: MissileTones = {
  body: RAPID_GOLD,
  fins: ["#bc831d", "#9e6215", "#744412"],
  warhead: RAPID_GOLD,
};
const ADA_HEAVY: MissileTones = {
  body: ["#4d5d52", "#2e3b33", "#1b2620"],
  fins: ["#3e4c42", "#2d382f", "#222d25"],
  warhead: ["#bfc8c9", "#8a9a9a", "#606e72"],
};
const ENEMY_RAPID: MissileTones = { body: CORAL, fins: WHITE, warhead: CORAL };
const ENEMY_HEAVY: MissileTones = { body: CORAL, fins: PLATE, warhead: WHITE };

const MISSILE_HEADINGS = 32;
const SHEET_COLUMNS = 8;
// The mine's studs repeat every quarter turn: eight frames step it 11.25 degrees.
export const MINE_FRAMES = 8;
const MINE_STUDS = 4;
/** Degrees the studs turn from one mine frame to the next. */
export const MINE_FRAME_DEGREES = 360 / MINE_STUDS / MINE_FRAMES;

// A missile's fins: two level and one upright, `thick` through, from the root chord to the
// swept tip chord at `reach` out (`upright` up for the upright one). Lengths are display px
// with the nose at the origin and +x ahead.
type Fins = {
  root: readonly [number, number];
  tip: readonly [number, number];
  from: number;
  reach: number;
  upright: number;
  thick: number;
  tones: Tones;
};

function fins(mesh: Mesh, { from, reach, root, thick, tip, tones, upright }: Fins): void {
  const half = thick / 2;
  for (const side of [1, -1]) {
    meshExtrude(
      mesh,
      [
        [root[0], side * from, -half],
        [root[1], side * from, -half],
        [tip[1], side * reach, -half],
        [tip[0], side * reach, -half],
      ],
      [0, 0, thick],
      tones,
    );
  }
  meshExtrude(
    mesh,
    [
      [root[0], -half, from],
      [root[1], -half, from],
      [tip[1], -half, upright],
      [tip[0], -half, upright],
    ],
    [0, thick, 0],
    tones,
  );
}

function rapidMissile({ body, fins: finTones, warhead }: MissileTones): Mesh {
  const mesh: Mesh = [];
  meshTube(mesh, [-7, 0, 0], [-2.2, 0, 0], 1.5, 1.5, body, 12, { kind: "round", cap0: DARK });
  meshTube(mesh, [-2.2, 0, 0], [0.6, 0, 0], 1.5, 0.2, warhead, 12, { kind: "round" });
  fins(mesh, {
    root: [-7.4, -4.4],
    tip: [-7.8, -7],
    from: 1.1,
    reach: 3.2,
    upright: 3,
    thick: 1,
    tones: finTones,
  });
  return mesh;
}

function heavyMissile({ body, fins: finTones, warhead }: MissileTones): Mesh {
  const mesh: Mesh = [];
  meshTube(mesh, [-13.2, 0, 0], [-4.2, 0, 0], 2.9, 2.9, body, 14, { kind: "round", cap0: DARK });
  meshTube(mesh, [-4.2, 0, 0], [1, 0, 0], 2.9, 0.3, warhead, 14, { kind: "round" });
  fins(mesh, {
    root: [-13.2, -8.6],
    tip: [-14.4, -12.6],
    from: 2.2,
    reach: 6,
    upright: 5.4,
    thick: 1.4,
    tones: finTones,
  });
  return mesh;
}

// The mine with its studs turned `degrees` as its convex solids, in logical px: a ball, a belt,
// four studs, a collar and a lamp.
export function mineSolids(degrees: number, lamp: Tones = AMBER): Mesh[] {
  const solid = (build: (mesh: Mesh) => void): Mesh => {
    const mesh: Mesh = [];
    build(mesh);
    return mesh;
  };
  return [
    solid((mesh) => meshBall(mesh, [0, 0, 0], [4.7, 4.7, 4.5], CORAL, { sides: 20, bands: 10 })),
    solid((mesh) => meshTube(mesh, [0, 0, -1.1], [0, 0, 1.1], 5, 5, DARK, 28)),
    ...Array.from({ length: MINE_STUDS }, (_, i) => {
      const a = ((degrees + (360 / MINE_STUDS) * i) * Math.PI) / 180;
      const [x, y] = [Math.cos(a), Math.sin(a)];
      return solid((mesh) =>
        meshTube(mesh, [x * 4.6, y * 4.6, 0], [x * 7.4, y * 7.4, 0], 1.9, 1, CORAL, 10, {
          kind: "round",
        }),
      );
    }),
    solid((mesh) => meshTube(mesh, [0, 0, 4.2], [0, 0, 5], 2.3, 2.3, DARK, 16)),
    solid((mesh) => meshDome(mesh, [0, 0, 5], 1.6, lamp, { sides: 14, bands: 5 })),
  ];
}

// The mine as one mesh.
export const mine = (degrees: number, lamp: Tones): Mesh => mineSolids(degrees, lamp).flat();

// Mesh space (forward +x, port +y) to the projection's local space (forward -y), at heading
// `yaw` of the missile headings.
const heading = (yaw: number) => (point: Point) =>
  rotate(MISSILE_HEADINGS, yaw, [point[1], -point[0], point[2]]);
const still = (point: Point) => point;

// One frame of `size` frame px with the model's origin at its centre.
function frame(title: string, size: number, mesh: Mesh, view: (point: Point) => Point): string {
  const scale = 1 / DISPLAY_SCALE;
  const visible = visibleFragments(meshScale(mesh, [scale, scale, scale]), view).map(
    (fragment) => ({
      ...fragment,
      points: fragment.points.map(([x, y]): V2 => [x + size / 2, y + size / 2]),
    }),
  );
  const drawn = visible.flatMap(({ points }) => points);
  if (drawn.some(([x, y]) => x < 1 || y < 1 || x > size - 1 || y > size - 1)) {
    throw new Error(`${title} leaves its ${size} px frame`);
  }
  return svgText(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
      `<title>${title}</title>`,
      ...tonePaths(visible).map(
        ({ fill, loops }) => `<path fill="${fill}" d="${pathData(loops)}"/>`,
      ),
      "</svg>",
    ].join(""),
  );
}

// The frames as one sheet of nested roots, eight to a row.
function sheet(size: number, frames: readonly { id: string; svg: string }[]): string {
  const root = (width: number, height: number) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  const roots = frames.map(({ id, svg }, index) => {
    const [x, y] = [(index % SHEET_COLUMNS) * size, Math.floor(index / SHEET_COLUMNS) * size];
    return `<svg id="${id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
  });
  return `${root(SHEET_COLUMNS * size, Math.ceil(frames.length / SHEET_COLUMNS) * size)}${roots.join("")}</svg>\n`;
}

// Each missile's tail, logical px behind the nose, and its flame: width at the tail and length
// at heading 14 in flicker frames 0 and 1.
const RAPID_FLAME = { tail: 7, flame: { width: 2.6, length: [12, 15] } };
const HEAVY_FLAME = { tail: 13.2, flame: { width: 5.6, length: [16.8, 11.8] } };

const DIRECTORY = "/art/weapons/";
const row = (id: string, path: string, size: number) => ({
  id,
  path,
  svgSheet: true,
  width: size,
  height: size,
  displayWidth: size * DISPLAY_SCALE,
  displayHeight: size * DISPLAY_SCALE,
  pivot: { x: 0.5, y: 0.5 },
});

function main() {
  const files = new Map<string, string>();
  const assets: unknown[] = [];
  for (const { file, key, mesh, size, title } of [
    {
      key: "rapidMissile",
      file: "rapid-missile-sheet.svg",
      title: "Rapid Missile",
      mesh: rapidMissile(ADA_RAPID),
      size: 56,
    },
    {
      key: "heavyMissile",
      file: "heavy-missile-sheet.svg",
      title: "Heavy Missile",
      mesh: heavyMissile(ADA_HEAVY),
      size: 96,
    },
    {
      key: "enemyRapidMissile",
      file: "enemy-rapid-missile-sheet.svg",
      title: "Enemy Rapid Missile",
      mesh: rapidMissile(ENEMY_RAPID),
      size: 56,
    },
    {
      key: "enemyHeavyMissile",
      file: "enemy-heavy-missile-sheet.svg",
      title: "Enemy Heavy Missile",
      mesh: heavyMissile(ENEMY_HEAVY),
      size: 96,
    },
  ]) {
    const frames = Array.from({ length: MISSILE_HEADINGS }, (_, yaw) => ({
      id: `weapon-${key}-${yaw}`,
      svg: frame(`${title} ${yaw}`, size, mesh, heading(yaw)),
    }));
    files.set(file, sheet(size, frames));
    assets.push(
      ...frames.map(({ id }, yaw) => ({
        ...row(id, DIRECTORY + file, size),
        facing: `world-${yaw}`,
        directionIndex: yaw,
        projectile: key,
      })),
    );
  }
  const MINE = 48;
  const mines = (
    [
      ["weapon-mine", "Mine", AMBER, false],
      ["weapon-mine-blink", "Mine blink", BLINK, true],
    ] as const
  ).flatMap(([prefix, title, lamp, blink]) =>
    Array.from({ length: MINE_FRAMES }, (_, spin) => ({
      id: `${prefix}-${spin}`,
      svg: frame(`${title} ${spin}`, MINE, mine(spin * MINE_FRAME_DEGREES, lamp), still),
      spin,
      blink,
    })),
  );
  files.set("mine-sheet.svg", sheet(MINE, mines));
  assets.push(
    ...mines.map(({ blink, id, spin }) => ({
      ...row(id, `${DIRECTORY}mine-sheet.svg`, MINE),
      facing: "fixed",
      spinIndex: spin,
      blink,
      projectile: "mine",
    })),
  );
  mkdirSync(fileURLToPath(new URL(`../../public${DIRECTORY}`, import.meta.url)), {
    recursive: true,
  });
  writeOnce(DIRECTORY, new Map(), files);
  stageRows("weapon-solids", {
    manifest: "core",
    assets,
    // What the renderer needs beside the frames, in logical px along the heading from the nose.
    // The enemy missiles are the same models, so they keep the same flame geometry.
    missiles: {
      headings: MISSILE_HEADINGS,
      rapidMissile: RAPID_FLAME,
      heavyMissile: HEAVY_FLAME,
      enemyRapidMissile: RAPID_FLAME,
      enemyHeavyMissile: HEAVY_FLAME,
    },
    mine: { frames: MINE_FRAMES, degreesPerFrame: MINE_FRAME_DEGREES },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) main();
