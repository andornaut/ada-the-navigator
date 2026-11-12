import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  type Craft,
  crafts,
  drawOrder,
  faces,
  gadgetJets,
  hullEntries,
  jetsFile,
} from "./crafts.ts";
import { replaceEntries } from "./manifest.ts";
import { anchor, ENEMY_HEADINGS, project, vector } from "./projection.ts";
import {
  area,
  check,
  cross,
  NOTCH_WIDTH,
  rasterize,
  segDist,
  trace,
  union,
  type V2,
} from "./silhouette.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const output = `${art}enemies/`;
const MOUTH_Z = 2;
// Douglas-Peucker tolerance for the hull silhouettes, in frame px. At 0.5 the small swarm and
// interceptor frames fall below the intersection-over-union floor.
const SILHOUETTE_TOLERANCE = 0.4;

type Polygon = { color: string; points: V2[] };

const point = (text: string) => text.split(",").map(Number) as V2;
const text = (points: readonly V2[]) => points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`);

// The frame's polygons in draw order, in frame px rounded as the SVG writes them.
function drawn(craft: Craft, yaw: number): Polygon[] {
  const centre = craft.frame / 2;
  return drawOrder(yaw, craft.parts[0]!.z1, craft.parts)
    .flatMap((part) => faces(yaw, part))
    .map(({ color, points }) => ({
      color,
      points: points.map((p) => point(project(centre, p))),
    }));
}

// `tips` fill notch tips under the facets, as the drawn silhouette cuts them.
export function svg(craft: Craft, yaw: number, tips: readonly Polygon[] = []): string {
  const polygons = [...tips, ...drawn(craft, yaw)].map(
    ({ color, points }) => `  <polygon fill="${color}" points="${text(points).join(" ")}"/>`,
  );
  const size = craft.frame;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `  <title>${craft.title} ${yaw} idle</title>`,
    ...polygons,
    "</svg>",
    "",
  ].join("\n");
}

// Whether a polygon covers a point, within NOTCH_WIDTH of its edges.
function near(poly: readonly V2[], p: V2): boolean {
  const sign = Math.sign(area(poly));
  return (
    poly.every((a, i) => cross(a, poly[(i + 1) % poly.length]!, p) * sign >= 0) ||
    poly.some((a, i) => segDist(p, a, poly[(i + 1) % poly.length]!) <= NOTCH_WIDTH)
  );
}

// The drawn silhouette of heading `yaw` as convex parts in frame px, traced from the frame's
// fills (no strokes, so no growth), and its notch tips, each in the colour of the topmost
// polygon at its apex. Checked against the fills plus the tips.
function silhouette(craft: Craft, yaw: number): { collision: V2[][]; tips: Polygon[] } {
  const polygons = drawn(craft, yaw);
  const mask = rasterize(
    polygons.map(({ points }) => points),
    craft.frame,
    craft.frame,
  );
  const { collision, tips } = trace(mask, SILHOUETTE_TOLERANCE);
  const filled = tips.map((tip) => ({
    color: polygons.findLast(({ points }) => near(points, tip[1]!))?.color ?? polygons[0]!.color,
    points: tip.map((p) => point(text([p])[0]!)),
  }));
  const tipMask = rasterize(
    filled.map(({ points }) => points),
    craft.frame,
    craft.frame,
  );
  check(`${craft.name} ${yaw}`, collision, union(mask, tipMask));
  return { collision, tips: filled };
}

// `collision` adds each heading's drawn silhouette after its mouths.
export function jets(craft: Craft, collision?: (yaw: number) => V2[][]): string {
  const centre = craft.frame / 2;
  const half = craft.mouthWidth / 2;
  return jetsFile(
    craft.frame,
    (yaw) =>
      craft.mouths.map(([x, y]) => ({
        anchor: anchor(ENEMY_HEADINGS, centre, yaw, [x, y, MOUTH_Z]),
        axis: vector(ENEMY_HEADINGS, yaw, [0, 1, 0]),
        half: vector(ENEMY_HEADINGS, yaw, [-half, 0, 0]),
      })),
    gadgetJets,
    {},
    (yaw) => (collision ? { collision: collision(yaw) } : {}),
  );
}

function main() {
  mkdirSync(output, { recursive: true });
  for (const craft of crafts) {
    const traced = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => silhouette(craft, yaw));
    writeFileSync(
      `${output}${craft.name}-jets.json`,
      jets(craft, (yaw) => traced[yaw]!.collision),
    );
    for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
      writeFileSync(`${output}${craft.name}-${yaw}.svg`, svg(craft, yaw, traced[yaw]!.tips));
    }
  }

  // Only this tool's hull frames, in place; heavies.ts owns the other `enemy-` entries.
  const names = crafts.map(({ name }) => name).join("|");
  const hull = new RegExp(`^enemy-(${names})-\\d+$`);
  replaceEntries(
    "core",
    (id) => hull.test(id),
    crafts.flatMap(({ frame, name }) => hullEntries(name, frame)),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
