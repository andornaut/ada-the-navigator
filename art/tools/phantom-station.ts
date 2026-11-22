// Phantom's undocked station. Build with node art/tools/phantom-station.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { unit } from "./debris.ts";
import { replaceEntries } from "./manifest.ts";
import { depth, facesViewer, type Point, projectAt, round } from "./projection.ts";
import { DESTINATION_SCALE, DISPLAY_SCALE, type Face } from "./solid.ts";
import { svgText } from "./svg-text.ts";

const output = fileURLToPath(new URL("../../public/art/phantom/", import.meta.url));
const PATH = "/art/phantom/";
const ROTATION_FRAMES = 8;
const FRAME_MS = 150;
// The world plane under the mantle stays at the original frame pivot.
const frame = { halfWidth: 176, above: 117, width: 352, height: 144 };
const MODEL_SCALE = 1.25;

type Ramp = readonly [string, string, string, string, string];

const MANTLE: Ramp = ["#a8f6dc", "#6ed5c5", "#389d9e", "#246d80", "#203e60"];
const PLATE: Ramp = ["#76d8ca", "#50b3b0", "#367b8e", "#315772", "#272f50"];
const FIN: Ramp = ["#6cddca", "#449fa4", "#356d88", "#3b466c", "#2b2d4d"];
const ARM: Ramp = ["#f091cf", "#c560ae", "#96468f", "#6e366c", "#4b2b57"];
const JOINT: Ramp = ["#87d9d1", "#569da9", "#496e91", "#454b76", "#352f56"];
const LIGHT = unit([-0.25, 0.45, 1]);
const STEPS = [0.9, 0.7, 0.45, 0.15];

function tone(ramp: Ramp, points: readonly Point[]): string {
  let [nx, ny, nz] = [0, 0, 0];
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const normal = unit([nx, ny, nz]);
  const light = normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2];
  const index = STEPS.findIndex((step) => light >= step);
  return ramp[index < 0 ? 4 : index]!;
}

// The mantle points up and right. Sections give the centre along, across and above
// its world-plane axis, then half-width and half-height. Arm sections follow the sweep.
const AXIS = -Math.PI / 4 - 0.12;
type Section = readonly [along: number, across: number, z: number, width: number, height: number];
type Quad = readonly [Point, Point, Point, Point];

function world(along: number, across: number, z: number): Point {
  return [
    along * Math.cos(AXIS) - across * Math.sin(AXIS),
    along * Math.sin(AXIS) + across * Math.cos(AXIS),
    z,
  ];
}

function loft(
  sections: readonly Section[],
  sides: number,
  shade: (band: number, facet: number, points: Quad) => Face[],
): Face[] {
  const rings = sections.map(([along, across, z, width, height], i) => {
    const previous = sections[Math.max(i - 1, 0)]!;
    const next = sections[Math.min(i + 1, sections.length - 1)]!;
    const tangent = Math.atan2(next[1] - previous[1], next[0] - previous[0]);
    return Array.from({ length: sides }, (_, k) => {
      const angle = (k * 2 * Math.PI) / sides;
      const span = width * Math.cos(angle);
      return world(
        along - span * Math.sin(tangent),
        across + span * Math.cos(tangent),
        z + height * Math.sin(angle),
      );
    });
  });

  const visible: { band: number; facet: number; points: Quad }[] = [];
  for (const [band, ring] of rings.slice(0, -1).entries()) {
    for (let facet = 0; facet < sides; facet++) {
      const next = (facet + 1) % sides;
      const forward = rings[band + 1]!;
      const points: Quad = [ring[facet]!, ring[next]!, forward[next]!, forward[facet]!];
      if (facesViewer(points)) visible.push({ band, facet, points });
    }
  }
  return visible
    .sort((a, b) => depth(b.points) - depth(a.points))
    .flatMap(({ band, facet, points }) => shade(band, facet, points));
}

const profile: readonly Section[] = [
  [-47, 0, 29, 4, 4],
  [-32, 1, 31, 23, 18],
  [-8, 1, 32, 33, 23],
  [10, 0, 32, 39, 24],
  [28, -2, 34, 36, 23],
  [46, -4, 36, 27, 18],
  [62, -5, 39, 13, 11],
  [74, -7, 40, 0, 0],
];

const arms: readonly (readonly Section[])[] = [
  [
    [-17, -16, 32, 14, 11],
    [-39, -28, 38, 13, 9],
    [-54, -43, 44, 9, 7],
    [-69, -50, 43, 7, 5],
    [-87, -50, 45, 5, 4],
    [-104, -42, 43, 3, 3],
    [-108, -32, 39, 0, 0],
  ],
  [
    [-25, 0, 24, 13, 10],
    [-51, -4, 24, 12, 8],
    [-68, -5, 22, 9, 6],
    [-88, 1, 22, 7, 5],
    [-105, 9, 28, 4, 3],
    [-112, 25, 40, 0, 0],
  ],
  [
    [-12, 18, 28, 16, 11],
    [-34, 35, 32, 14, 9],
    [-51, 49, 34, 10, 7],
    [-68, 59, 40, 8, 5],
    [-86, 60, 41, 6, 4],
    [-98, 50, 41, 4, 3],
    [-93, 46, 43, 0, 0],
  ],
];

const fins: readonly (readonly Section[])[] = [
  [
    [39, -13, 35, 12, 8],
    [31, -30, 35, 16, 7],
    [13, -44, 38, 13, 5],
    [-11, -49, 39, 7, 3],
    [-30, -45, 37, 0, 0],
  ],
  [
    [39, 13, 31, 12, 8],
    [32, 26, 34, 17, 7],
    [14, 42, 35, 15, 5],
    [-9, 50, 35, 8, 3],
    [-30, 47, 35, 0, 0],
  ],
];

function tinted(ramp: Ramp, points: Quad): Face {
  return { color: tone(ramp, points), points };
}

function mix(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function inlay(points: Quad, color: string): Face {
  const [a, b, c, d] = points;
  return {
    color,
    points: [mix(a, b, 0.24), mix(a, b, 0.48), mix(d, c, 0.68), mix(d, c, 0.38)].map(
      (point, i, corners) => mix(point, corners[3 - i]!, 0.17),
    ),
  };
}

function habitationLights([a, b, c, d]: Quad): Face[] {
  const onFacet = (along: number, across: number) =>
    mix(mix(a, d, along), mix(b, c, along), across);
  return [0.13, 0.42, 0.71].map((start) => ({
    color: "#ffe5b9",
    points: [
      onFacet(start, 0.27),
      onFacet(start, 0.73),
      onFacet(start + 0.15, 0.73),
      onFacet(start + 0.15, 0.27),
    ],
  }));
}

const WAVE = [
  "#ffd1f1",
  "#f69fd3",
  "#d875b7",
  "#995891",
  "#7e497a",
  "#995891",
  "#d875b7",
  "#f69fd3",
];

function drawStation(rotation: number): Face[] {
  const limbs = arms.map((arm, index) =>
    loft(arm, 8, (band, facet, points) => {
      const shell = tinted(band % 2 && facet < 5 ? JOINT : ARM, points);
      // The inner face of the far arm carries three fixed habitation lights.
      return index === 0 && band === 3 && facet === 3
        ? [shell, ...habitationLights(points)]
        : [shell];
    }),
  );
  const flanks = fins.map((fin) =>
    loft(fin, 8, (band, facet, points) => {
      const shell = tinted(band === 2 && facet < 5 ? ARM : FIN, points);
      return facet === 2 && (band === 1 || band === 3)
        ? [shell, inlay(points, "#9ddbcc")]
        : [shell];
    }),
  );
  const mantle = loft(profile, 12, (band, facet, points) => {
    const shell = tinted(facet === 1 || facet === 5 || band === 0 ? PLATE : MANTLE, points);
    // Fixed warm windows sit between the moving mantle inlays.
    if ((band === 2 || band === 4) && facet === 3) return [shell, ...habitationLights(points)];
    if (band < 1 || band > 5 || (facet !== 1 && facet !== 4 && facet !== 5)) return [shell];
    const color = WAVE[(rotation + band + 2 * facet) % ROTATION_FRAMES]!;
    return [shell, inlay(points, color)];
  });

  // Far limbs and fin root behind the mantle. The near fin overlaps the arm root.
  return [...limbs[0]!, ...limbs[1]!, ...flanks[0]!, ...limbs[2]!, ...mantle, ...flanks[1]!];
}

const frames = Array.from({ length: ROTATION_FRAMES }, (_, k) =>
  drawStation(k).map(({ color, points }) => ({
    color,
    points: points.map(([x, y, z]): Point => [x * MODEL_SCALE, y * MODEL_SCALE, z * MODEL_SCALE]),
  })),
);
for (const { points } of frames.flat()) {
  for (const point of points) {
    const [x, y] = projectAt(frame.halfWidth, frame.above, point);
    if (x < 4 || y < 4 || x > frame.width - 4 || y > frame.height - 4) {
      throw new Error(`Station mesh exceeds the frame margin at ${x}, ${y}`);
    }
  }
}

const scale = DISPLAY_SCALE * DESTINATION_SCALE;
mkdirSync(output, { recursive: true });
const entries = frames.map((faces, k) => {
  const shapes = faces.map(({ color, points }) => {
    const pts = points
      .map((p) => projectAt(frame.halfWidth, frame.above, p))
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");
    return `  <polygon fill="${color}" points="${pts}"/>`;
  });
  writeFileSync(
    `${output}station-${k}.svg`,
    svgText(
      [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${round(frame.width * scale)}" height="${round(frame.height * scale)}" viewBox="0 0 ${frame.width} ${frame.height}">`,
        `  <title>Phantom station ${k}</title>`,
        ...shapes,
        "</svg>",
        "",
      ].join("\n"),
    ),
  );
  return {
    id: `phantom-station-${k}`,
    path: `${PATH}station-${k}.svg`,
    width: frame.width,
    height: frame.height,
    displayWidth: round(frame.width * scale),
    displayHeight: round(frame.height * scale),
    facing: "fixed",
    pivot: { x: 0.5, y: frame.above / frame.height },
    frameMs: FRAME_MS,
    destination: "station",
    frameIndex: k,
  };
});

// The station opens Phantom's manifest, before the settlements.
replaceEntries(
  "phantom",
  (id) => id.startsWith("phantom-station-"),
  entries,
  () => true,
);
console.log(
  `station frame ${frame.width} by ${frame.height}, pivot (${frame.halfWidth}, ${frame.above})`,
);
