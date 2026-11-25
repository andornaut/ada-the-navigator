// The enemy fleet producer (art/enemy-redesign.md). `node art/tools/fleet.ts` writes each small
// craft's hull sheet per family, its jets and its destruction shards beside the shipped enemy
// art, and the manifest rows and sidecars that switch to them in art/fleet-rows.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import { DISPLAY_SCALE, jetsFile } from "./crafts.ts";
import { packHullRoots } from "./enemies.ts";
import { traceEnemyFills } from "./enemy-outline.ts";
import { ADA_MODEL_SPAN, enemySizeRatio } from "./enemy-size.ts";
import {
  FLEET_FAMILIES,
  FLEET_JETS,
  FLEET_PAINT,
  type FleetCraft,
  type FleetFamily,
  smallCraft,
} from "./fleet-models.ts";
import { type ManifestFile, type Sidecars, writeOnce } from "./manifest.ts";
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
import { FLECK_DISTANCE, FLECKS, SEEDS } from "./shard-geometry.ts";
import { shardPalettePack } from "./shard-palette-pack.ts";
import type { Fill } from "./silhouette.ts";
import { type Mesh, meshClip, meshExtrude, meshScale } from "./solid.ts";
import { svgText } from "./svg-text.ts";
import { type Fragment, loopArea, outlines, tidy, type V2, visibleFragments } from "./visible.ts";

// Douglas-Peucker tolerance for the hull silhouettes, in frame px, as for the shipped craft.
const SILHOUETTE_TOLERANCE = 0.4;
// The jet triangle's base as a share of the drive mouth's diameter.
const MOUTH_SHARE = 0.75;

// Mesh space (forward +x, port +y) to the projection's local space (forward -y), then to the
// view at heading `yaw`.
const local = ([l, w, z]: Point): Point => [w, -l, z];
const view = (yaw: number) => (point: Point) => rotate(ENEMY_HEADINGS, yaw, local(point));

// A craft scaled to its contract span, in frame units, with its frame size.
export type Scaled = FleetCraft & { frame: number; halfSpan: number };

function scaled(craft: FleetCraft): Scaled {
  const points = craft.parts.flatMap(({ mesh }) => mesh.flatMap((face) => face.points));
  const span = Math.max(...points.map(([, w]) => w)) - Math.min(...points.map(([, w]) => w));
  const target = enemySizeRatio(craft.archetype) * ADA_MODEL_SPAN;
  const k = target / span;
  const parts = craft.parts.map((part) => ({ ...part, mesh: meshScale(part.mesh, [k, k, k]) }));
  const extent = Math.max(
    ...Array.from({ length: ENEMY_HEADINGS }, (_, yaw) =>
      parts.flatMap(({ mesh }) =>
        mesh.flatMap((face) =>
          face.points.flatMap((p) => projectAt(0, 0, view(yaw)(p)).map(Math.abs)),
        ),
      ),
    ).flat(),
  );
  return {
    ...craft,
    parts,
    mouths: craft.mouths.map(({ at, radius }) => ({
      at: [at[0] * k, at[1] * k, at[2] * k],
      radius: radius * k,
    })),
    frame: Math.ceil((2 * extent + 2) / 8) * 8,
    halfSpan: target / 2,
  };
}

export const fleetCrafts = (family: FleetFamily = "coral"): Scaled[] =>
  smallCraft(FLEET_PAINT[family]).map(scaled);

const colour = ({ slot, tones }: Fragment) => tones[slot];
const d = (loops: readonly V2[][]) =>
  loops.map((loop) => `M${loop.map(([x, y]) => `${x},${y}`).join("L")}Z`).join("");

// The visible fragments of one heading, in frame px.
function fragments(craft: Scaled, yaw: number, mesh: Mesh): Fragment[] {
  const centre = craft.frame / 2;
  return visibleFragments(mesh, view(yaw)).map((fragment) => ({
    ...fragment,
    points: fragment.points.map(([x, y]): V2 => [x + centre, y + centre]),
  }));
}

// One path per tone, largest first. Each path also covers every later tone, so no seam between
// two tones shows what lies under the craft; the first path is the silhouette.
function tonePaths(visible: readonly Fragment[]): { fill: string; loops: V2[][] }[] {
  const areas = new Map<string, number>();
  for (const fragment of visible) {
    areas.set(colour(fragment), (areas.get(colour(fragment)) ?? 0) + loopArea(fragment.points));
  }
  const order = [...areas].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([c]) => c);
  return order.map((fill, index) => {
    const under = new Set(order.slice(index));
    const covered = visible.filter((fragment) => under.has(colour(fragment)));
    return {
      fill,
      loops: outlines(covered.map(({ points }) => points))
        .map((loop) => tidy(loop, 1))
        .filter((loop) => loop.length > 0),
    };
  });
}

const fills = (visible: readonly Fragment[]): Fill[] =>
  visible.map((fragment) => ({
    color: colour(fragment),
    points: fragment.points.map(([x, y]): V2 => [Number(x.toFixed(2)), Number(y.toFixed(2))]),
  }));

export type Frame = { svg: string; silhouette: string; collision: V2[][] };

// One idle frame: notch tips first, then the tone paths, with the heading's collision parts.
export function frame(craft: Scaled, yaw: number): Frame {
  const visible = fragments(
    craft,
    yaw,
    craft.parts.flatMap(({ mesh }) => mesh),
  );
  const traced = traceEnemyFills(
    `${craft.key} ${yaw}`,
    fills(visible),
    [craft.frame, craft.frame],
    [SILHOUETTE_TOLERANCE],
  );
  const paths = tonePaths(visible);
  const size = craft.frame;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<title>${craft.design} ${yaw} idle</title>`,
    ...traced.tips.map(
      ({ color, points }) =>
        `<polygon fill="${color}" points="${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}"/>`,
    ),
    ...paths.map(({ fill, loops }) => `<path fill="${fill}" d="${d(loops)}"/>`),
    "</svg>",
  ].join("");
  return { svg: svgText(svg), silhouette: d(paths[0]!.loops), collision: traced.collision };
}

// The 16 headings as one sheet of nested roots, four to a row, with its manifest ids.
function sheet(craft: Scaled, frames: readonly Frame[], prefix: string): string {
  return packHullRoots(
    craft.frame,
    frames.map(({ svg }, yaw) => ({ id: `${prefix}${craft.archetype}-${yaw}`, svg })),
  );
}

function jets(craft: Scaled, frames: readonly Frame[]): string {
  const centre = craft.frame / 2;
  const { coral, ...families } = FLEET_JETS;
  return jetsFile(
    craft.frame,
    (yaw) =>
      craft.mouths.map(({ at, radius }) => ({
        anchor: anchor(ENEMY_HEADINGS, centre, yaw, local(at)),
        axis: vector(ENEMY_HEADINGS, yaw, [0, 1, 0]),
        half: vector(ENEMY_HEADINGS, yaw, [-radius * MOUTH_SHARE, 0, 0]),
      })),
    coral,
    {
      familyColors: Object.fromEntries(
        Object.entries(families).map(([family, { core, outer }]) => [family, [outer, core]]),
      ),
    },
    (yaw) => ({ collision: frames[yaw]!.collision }),
  );
}

// ------------------------------------------------------------------ shards

type Group = { kind: "hull" | "part" | "fleck"; mesh: Mesh };

// Hull wedges in cut order, then loose parts in model order, then the four flecks.
function groups(craft: Scaled): Group[] {
  const body = craft.parts.filter(({ loose }) => !loose).flatMap(({ mesh }) => mesh);
  const ray = (degrees: number) =>
    [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)] as const;
  const wedges = craft.cuts.map((from, i): Group => {
    const to = craft.cuts[(i + 1) % craft.cuts.length]! + (i === craft.cuts.length - 1 ? 360 : 0);
    const [f, t] = [ray(from), ray(to)];
    return {
      kind: "hull",
      mesh: meshClip(meshClip(body, [-f[0], -f[1], 0]), [t[0], t[1], 0]),
    };
  });
  const { hull } = FLEET_PAINT.coral;
  const flecks = FLECKS.map((angle): Group => {
    const [cx, cy] = [
      craft.halfSpan * 0.3 * Math.cos(angle),
      craft.halfSpan * 0.3 * Math.sin(angle),
    ];
    const s = craft.halfSpan * 0.09;
    const plan = [
      [cx, cy - s],
      [cx + s, cy + s * 0.8],
      [cx - s, cy + s * 0.6],
    ] as const;
    const mesh: Mesh = [];
    // Local plan (x across, y aft) to mesh space.
    meshExtrude(
      mesh,
      plan.map(([x, y]): Point => [-y, x, 1]),
      [0, 0, 1.5],
      [hull[1], hull[2], hull[2]],
    );
    return { kind: "fleck", mesh };
  });
  return [
    ...wedges.filter(({ mesh }) => mesh.length > 0),
    ...craft.parts.filter(({ loose }) => loose).map(({ mesh }): Group => ({ kind: "part", mesh })),
    ...flecks,
  ];
}

const px = (value: number) => Math.round(value * 100) / 100 + 0;

// A shard's faces as it draws alone: one polygon per tone outline, or its convex fragments when
// a tone's outline has a hole.
function shardPolygons(visible: readonly Fragment[]) {
  const tones = [...new Set(visible.map(colour))];
  return tones.flatMap((color) => {
    const convex = visible
      .filter((fragment) => colour(fragment) === color)
      .map(({ points }) => points);
    const loops = outlines(convex);
    const whole = loops.every((loop) => loopArea(loop) > 0);
    return (whole ? loops.map((loop) => tidy(loop, 2)) : convex.map((loop) => tidy(loop, 2)))
      .filter((loop) => loop.length > 0)
      .map((loop) => ({ color, points: loop.flat() }));
  });
}

// The version 1 shards file (art/destruction.md) for a craft.
export function shards(craft: Scaled): string {
  const centre = craft.frame / 2;
  const all = groups(craft);
  if (all.length > SEEDS.length) throw new Error(`${craft.key} needs ${all.length} seed rows`);
  const motion = all.map(({ kind, mesh }, i) => {
    const [jitter, distance, , lift] = SEEDS[i]!;
    const points = mesh.flatMap((face) => face.points.map(local));
    const mean = (axis: 0 | 1 | 2) => points.reduce((sum, p) => sum + p[axis], 0) / points.length;
    const c: Point = [mean(0), mean(1), mean(2)];
    const angle = Math.atan2(c[1], c[0]) + jitter;
    const length = craft.halfSpan * distance * (kind === "fleck" ? FLECK_DISTANCE : 1);
    return { c, drift: [Math.cos(angle) * length, Math.sin(angle) * length] as const, lift };
  });
  const headings = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => ({
    index: yaw,
    shards: all
      .map(({ mesh }, shard) => {
        const { c, drift, lift } = motion[shard]!;
        const [x, y] = projectAt(centre, centre, rotate(ENEMY_HEADINGS, yaw, c));
        const [dx, dy] = vector(ENEMY_HEADINGS, yaw, [drift[0], drift[1], 0]);
        const rest = rotate(ENEMY_HEADINGS, yaw, [c[0], c[1], 0]);
        const moved = rotate(ENEMY_HEADINGS, yaw, [drift[0], drift[1], 0]);
        return {
          shard,
          centroid: [px(x), px(y)],
          drift: [dx, round(dy - lift)],
          nearness: round(rest[0] + rest[1]),
          nearnessDrift: round(moved[0] + moved[1]),
          polygons: shardPolygons(fragments(craft, yaw, mesh)),
        };
      })
      .sort((a, b) => a.nearness - b.nearness),
  }));
  return json({
    version: 1,
    archetype: craft.key,
    frame: craft.frame,
    halfSpan: round(craft.halfSpan),
    shards: all.map(({ kind }, i) => {
      const [jitter, distance, spin, lift] = SEEDS[i]!;
      return { kind, jitter, distance, spin, lift };
    }),
    headings,
  });
}

// ------------------------------------------------------------------ families

// Coral tone to the family's tone. Every material slot must agree on it.
export function swap(family: FleetFamily): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const [material, tones] of Object.entries(FLEET_PAINT.coral)) {
    for (const [slot, from] of tones.entries()) {
      const to = FLEET_PAINT[family][material as keyof typeof FLEET_PAINT.coral][slot]!;
      if (map.has(from) && map.get(from) !== to) {
        throw new Error(`${family} paints ${from} as both ${map.get(from)} and ${to}`);
      }
      map.set(from, to);
    }
  }
  return map;
}

export const recolour = (family: FleetFamily, text: string): string => {
  const map = swap(family);
  return text.replace(/#[0-9a-f]{6}/gu, (c) => map.get(c) ?? c);
};

// The switch rows, by manifest: the producer leaves the manifests to the switch.
const ROWS = fileURLToPath(new URL("../fleet-rows.json", import.meta.url));
const MANIFESTS: Readonly<Record<FleetFamily, ManifestFile>> = {
  coral: "core",
  claim: "cartwheel",
  garnet: "andromeda",
  needle: "needle",
};
const directory = (family: FleetFamily) =>
  family === "coral" ? "/art/enemies/" : `/art/${MANIFESTS[family]}/enemies/`;
const prefix = (family: FleetFamily) => (family === "coral" ? "enemy-" : `enemy-${family}-`);

// The manifest row that replaces `enemy-{archetype}-{yaw}` (or the family's) at the switch.
function entries(craft: Scaled, family: FleetFamily, path: string) {
  const display = craft.frame * DISPLAY_SCALE;
  return Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => {
    const id = `${prefix(family)}${craft.archetype}-${yaw}`;
    const row = {
      width: craft.frame,
      height: craft.frame,
      displayWidth: display,
      displayHeight: display,
      facing: `world-${yaw}`,
      directionIndex: yaw,
      pivot: { x: 0.5, y: 0.5 },
      archetype: craft.archetype,
    };
    return family === "coral"
      ? { id, path, svgSheet: true, ...row }
      : { id, path, ...row, family, svgSheet: true };
  });
}

async function pretty(path: string, text: string): Promise<string> {
  return format(text, { ...(await resolveConfig(path)), filepath: path });
}

async function main() {
  const crafts = fleetCrafts();
  const frames = new Map(
    crafts.map((craft) => [
      craft.key,
      Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => frame(craft, yaw)),
    ]),
  );
  const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
  const shared = new Map<string, string>();
  const rows: Record<string, { assets: unknown[]; sidecars: Sidecars }> = {};
  for (const family of FLEET_FAMILIES) {
    const files = new Map<string, string>();
    for (const craft of crafts) {
      const tinted = frames.get(craft.key)!.map((f) => ({ ...f, svg: recolour(family, f.svg) }));
      files.set(`${craft.key}-sheet.svg`, sheet(craft, tinted, prefix(family)));
      if (family !== "coral") continue;
      files.set(`${craft.key}-jets.json`, jets(craft, tinted));
      const core = shards(craft);
      const file = `${craft.key}-shards-packed.json`;
      const pack = shardPalettePack(core, {
        garnet: recolour("garnet", core),
        claim: recolour("claim", core),
        needle: recolour("needle", core),
      });
      files.set(file, await pretty(`${art}enemies/${file}`, pack));
    }
    const paths = writeOnce(directory(family), new Map(), files);
    for (const [file, path] of paths) {
      if (family === "coral" && !file.endsWith("-sheet.svg")) shared.set(file, path);
    }
    // Every family reads the coral folder's jets and shard pack, which carry its colours.
    rows[MANIFESTS[family]] = {
      assets: crafts.flatMap((craft) =>
        entries(craft, family, paths.get(`${craft.key}-sheet.svg`)!),
      ),
      sidecars: Object.fromEntries(
        crafts.map(({ archetype, key }) => [
          archetype,
          {
            jets: shared.get(`${key}-jets.json`)!,
            shards: shared.get(`${key}-shards-packed.json`)!,
          },
        ]),
      ),
    };
  }
  const staged = json(rows);
  if (!existsSync(ROWS) || readFileSync(ROWS, "utf8") !== staged) writeFileSync(ROWS, staged);
  for (const craft of crafts) {
    console.log(
      `${craft.key}: ${craft.design}, frame ${craft.frame}, display ${craft.frame * DISPLAY_SCALE}`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
