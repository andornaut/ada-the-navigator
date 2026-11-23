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

type Ramp = readonly [string, string, string];

const MANTLE: Ramp = ["#86ded1", "#419e9e", "#28536c"];
const FIN: Ramp = ["#60b7b6", "#3c7d90", "#344868"];
const ARM: Ramp = ["#e78cc5", "#b35ba2", "#693d72"];
const ARM_CUFF: Ramp = ["#81c7bd", "#4b8d9c", "#385775"];
const LIGHT = unit([-0.25, 0.45, 1]);

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
  return ramp[light >= 0.72 ? 0 : light >= 0.22 ? 1 : 2];
}

// The mantle points up and right. Sections give the centre along, across and above
// its world-plane axis, then half-width and half-height. Arm sections follow the sweep.
const ARM_AXIS = -Math.PI / 4;
const AXIS = ARM_AXIS - 0.12;
type Section = readonly [along: number, across: number, z: number, width: number, height: number];
type Quad = readonly [Point, Point, Point, Point];

function world(along: number, across: number, z: number, axis: number): Point {
  return [
    along * Math.cos(axis) - across * Math.sin(axis),
    along * Math.sin(axis) + across * Math.cos(axis),
    z,
  ];
}

function loft(
  sections: readonly Section[],
  sides: number,
  shade: (band: number, facet: number, points: Quad) => Face[],
  axis = AXIS,
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
        axis,
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

// Matching outer appendages share section stations, radii and elevations. The third is axial.
function reflect(sections: readonly Section[]): Section[] {
  return sections.map(([u, v, z, width, height]) => [u, -v, z, width, height]);
}

const outerArm: readonly Section[] = [
  [-15, -18, 32, 15, 11],
  [-37, -31, 34, 13, 9],
  [-54, -46, 38, 10, 7],
  [-70, -53, 41, 8, 5],
  [-87, -53, 43, 6, 4],
  [-101, -46, 42, 4, 3],
  [-106, -39, 41, 0, 0],
];
const centreArm: readonly Section[] = [
  [-25, 0, 25, 12, 9],
  [-47, 0, 28, 10, 8],
  [-69, 0, 32, 8, 6],
  [-89, 0, 36, 6, 4],
  [-104, 0, 39, 3, 2],
  [-111, 0, 40, 0, 0],
];
const arms = [outerArm, centreArm, reflect(outerArm)];

const outerFin: readonly Section[] = [
  [39, -13, 33, 12, 8],
  [32, -28, 35, 16, 7],
  [14, -43, 37, 14, 5],
  [-10, -49, 38, 7, 3],
  [-30, -46, 36, 0, 0],
];
const fins = [outerFin, reflect(outerFin)];

function tinted(ramp: Ramp, points: Quad): Face {
  return { color: tone(ramp, points), points };
}

function mix(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function facePanel(
  [a, b, c, d]: Quad,
  length: number,
  width: number,
  offset: number,
  color: string,
): Face {
  const distance = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const axis = distance(mix(a, b, 0.5), mix(d, c, 0.5));
  const span = distance(mix(a, d, 0.5), mix(b, c, 0.5));
  const along = (n: number) => 0.5 + n / axis;
  const across = (n: number) => 0.5 + n / span;
  const at = (u: number, v: number) => mix(mix(a, d, along(u)), mix(b, c, along(u)), across(v));
  const lo = offset - length / 2;
  const hi = offset + length / 2;
  return {
    color,
    points: [at(lo, -width / 2), at(lo, width / 2), at(hi, width / 2), at(hi, -width / 2)],
  };
}

function habitationLights(points: Quad): Face[] {
  return [-3.8, 0, 3.8].map((offset) => facePanel(points, 2.3, 2.4, offset, "#ffe5b9"));
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
  const limbs = arms.map((arm) =>
    loft(
      arm,
      8,
      (band, facet, points) => {
        const shell = tinted(band === 1 ? ARM_CUFF : ARM, points);
        return band === 1 && facet === 2 ? [shell, ...habitationLights(points)] : [shell];
      },
      ARM_AXIS,
    ),
  );
  const flanks = fins.map((fin) =>
    loft(fin, 8, (_band, _facet, points) => [tinted(FIN, points)], ARM_AXIS),
  );
  const mantle = loft(profile, 12, (band, facet, points) => {
    const shell = tinted(MANTLE, points);
    if ((band === 2 || band === 4) && facet === 3) return [shell, ...habitationLights(points)];
    if (band < 1 || band > 5 || facet !== 1) return [shell];
    const color = WAVE[(rotation + band) % ROTATION_FRAMES]!;
    return [shell, facePanel(points, 12, 3.5, 0, color)];
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
