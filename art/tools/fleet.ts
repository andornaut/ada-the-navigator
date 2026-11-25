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
  fleet,
  type FleetTop,
  collar,
  mountPivot,
  podTop,
  type Paint,
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
// The small collar and top sprites take the first tolerance that passes the shared checker.
const PART_TOLERANCES = [0.4, 0.3, 0.2, 0.1];
// The jet triangle's base as a share of the drive mouth's diameter.
const MOUTH_SHARE = 0.75;

// Mesh space (forward +x, port +y) to the projection's local space (forward -y), then to the
// view at heading `yaw`.
const local = ([l, w, z]: Point): Point => [w, -l, z];
const view = (yaw: number) => (point: Point) => rotate(ENEMY_HEADINGS, yaw, local(point));

// A craft scaled to its contract span, in frame units, with its frame size.
// `length` and `width` are the drawn hull's extents fore and aft and across, in frame units.
// A craft with a mount has its collar (`base`) and aimed `top`, each with its own frame size.
export type Scaled = FleetCraft & {
  frame: number;
  halfSpan: number;
  length: number;
  width: number;
  base?: { mesh: Mesh; frame: number; anchor: Point; pivot: Point };
  top?: FleetTop & { frame: number };
};

const at = (k: number, [x, y, z]: Point): Point => [x * k, y * k, z * k];
// The smallest multiple of 8 frame px that holds `points` about the pivot `origin` at every
// heading, with a 1 px margin.
function fit(points: readonly Point[], origin: Point = [0, 0, 0]): number {
  const extent = Math.max(
    ...Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => {
      const [ox, oy] = projectAt(0, 0, view(yaw)(origin));
      return points.flatMap((p) => {
        const [x, y] = projectAt(0, 0, view(yaw)(p));
        return [Math.abs(x - ox), Math.abs(y - oy)];
      });
    }).flat(),
  );
  return Math.ceil((2 * extent + 2) / 8) * 8;
}
const vertices = (mesh: Mesh) => mesh.flatMap((face) => face.points);

function scaled(paint: Paint, craft: FleetCraft): Scaled {
  const points = craft.parts.flatMap(({ mesh }) => vertices(mesh));
  const span = Math.max(...points.map(([, w]) => w)) - Math.min(...points.map(([, w]) => w));
  const target = enemySizeRatio(craft.archetype) * ADA_MODEL_SPAN;
  const k = target / span;
  const parts = craft.parts.map((part) => ({ ...part, mesh: meshScale(part.mesh, [k, k, k]) }));
  const { mount, muzzle, ...rest } = craft;
  const result: Scaled = {
    ...rest,
    parts,
    mouths: craft.mouths.map((mouth) => ({ at: at(k, mouth.at), radius: mouth.radius * k })),
    ...(muzzle ? { muzzle: at(k, muzzle) } : {}),
    frame: fit(parts.flatMap(({ mesh }) => vertices(mesh))),
    halfSpan: target / 2,
    length: (Math.max(...points.map(([l]) => l)) - Math.min(...points.map(([l]) => l))) * k,
    width: target,
  };
  if (mount) {
    const mesh = meshScale(collar(paint, mount), [k, k, k]);
    const pivot = at(k, mountPivot(mount));
    const anchor: Point = [pivot[0], pivot[1], (at(k, mount.at)[2] + pivot[2]) / 2];
    const top = podTop(paint, mount.radius);
    const topMesh = meshScale(top.mesh, [k, k, k]);
    result.mount = { at: at(k, mount.at), radius: mount.radius * k };
    result.base = { mesh, frame: fit(vertices(mesh), anchor), anchor, pivot };
    result.top = {
      mesh: topMesh,
      muzzles: top.muzzles.map((point) => at(k, point)),
      frame: fit(vertices(topMesh)),
    };
  }
  return result;
}

export const fleetCrafts = (family: FleetFamily = "coral"): Scaled[] =>
  fleet(FLEET_PAINT[family]).map((craft) => scaled(FLEET_PAINT[family], craft));

const colour = ({ slot, tones }: Fragment) => tones[slot];
const d = (loops: readonly V2[][]) =>
  loops.map((loop) => `M${loop.map(([x, y]) => `${x},${y}`).join("L")}Z`).join("");

// Fragments moved by (dx, dy).
const shift = (visible: readonly Fragment[], dx: number, dy: number): Fragment[] =>
  visible.map((fragment) => ({
    ...fragment,
    points: fragment.points.map(([x, y]): V2 => [x + dx, y + dy]),
  }));

// The visible fragments of one heading, in frame px.
function fragments(craft: Scaled, yaw: number, mesh: Mesh): Fragment[] {
  const centre = craft.frame / 2;
  return shift(visibleFragments(mesh, view(yaw)), centre, centre);
}

// One path per tone, largest first. Each path also covers every later tone, so no seam between
// two tones shows what lies under the craft; the first path is the silhouette.
export function tonePaths(visible: readonly Fragment[]): { fill: string; loops: V2[][] }[] {
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

// One frame of `size`: notch tips first, then the tone paths, with its collision parts.
function draw(
  id: string,
  title: string,
  size: number,
  visible: readonly Fragment[],
  tolerances: readonly number[] = [SILHOUETTE_TOLERANCE],
): Frame {
  const traced = traceEnemyFills(id, fills(visible), [size, size], tolerances);
  const paths = tonePaths(visible);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<title>${title}</title>`,
    ...traced.tips.map(
      ({ color, points }) =>
        `<polygon fill="${color}" points="${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}"/>`,
    ),
    ...paths.map(({ fill, loops }) => `<path fill="${fill}" d="${d(loops)}"/>`),
    "</svg>",
  ].join("");
  return { svg: svgText(svg), silhouette: d(paths[0]!.loops), collision: traced.collision };
}

const hullMesh = (craft: Scaled) => craft.parts.flatMap(({ mesh }) => mesh);

// One idle hull frame, without the mount's collar and top.
export function frame(craft: Scaled, yaw: number): Frame {
  return draw(
    `${craft.key} ${yaw}`,
    `${craft.design} ${yaw} idle`,
    craft.frame,
    fragments(craft, yaw, hullMesh(craft)),
  );
}

// The mount's collar at one hull heading, centred on its anchor: the part of it the hull leaves
// visible.
export function baseFrame(craft: Scaled, yaw: number): Frame {
  const { anchor, frame: size, mesh } = craft.base!;
  const [ax, ay] = projectAt(0, 0, view(yaw)(anchor));
  const visible = visibleFragments(
    [...hullMesh(craft), ...mesh.map((face) => ({ ...face, group: 1 }))],
    view(yaw),
  ).filter(({ group }) => group === 1);
  return draw(
    `${craft.key} turret ${yaw}`,
    `${craft.design} turret intact ${yaw}`,
    size,
    shift(visible, size / 2 - ax, size / 2 - ay),
    PART_TOLERANCES,
  );
}

// Where a hull heading places the collar sprite's centre and the top's pivot, in frame px.
export function placement(craft: Scaled, yaw: number): { anchor: V2; pivot: V2 } {
  const centre = craft.frame / 2;
  return {
    anchor: anchor(ENEMY_HEADINGS, centre, yaw, local(craft.base!.anchor)),
    pivot: anchor(ENEMY_HEADINGS, centre, yaw, local(craft.base!.pivot)),
  };
}

// The launcher top at one aim, centred on its pivot.
export function topFrame(craft: Scaled, aim: number): Frame {
  const { frame: size, mesh } = craft.top!;
  return draw(
    `${craft.key} top ${aim}`,
    `${craft.design} turret top ${aim}`,
    size,
    shift(visibleFragments(mesh, view(aim)), size / 2, size / 2),
    PART_TOLERANCES,
  );
}

// Sixteen frames as one sheet of nested roots, four to a row, with their manifest ids.
const sheet = (size: number, frames: readonly Frame[], ids: readonly string[]): string =>
  packHullRoots(
    size,
    frames.map(({ svg }, index) => ({ id: ids[index]!, svg })),
  );

// The drawn hull in frame px; `radius` is the spacing and footprint radius.
const hullSize = (craft: Scaled) => ({
  length: round(craft.length),
  width: round(craft.width),
  radius: round(Math.max(craft.length, craft.width) / 2),
});

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
      hull: hullSize(craft),
    },
    (yaw) => ({
      collision: frames[yaw]!.collision,
      ...(craft.muzzle
        ? { muzzles: [anchor(ENEMY_HEADINGS, centre, yaw, local(craft.muzzle))] }
        : {}),
    }),
  );
}

// Staged as `{key}-turret.json`: src/model/muzzles.test.ts reads every `-hardpoints.json` in the
// enemy folders into the game's muzzle table, so the file takes that name at the switch.
// The version 1 hardpoints file of a craft with one aimed, indestructible launcher: the collar's
// anchor and the top's pivot per hull heading, and the top's shot origins and collision per aim,
// relative to the pivot. `offset` is the mount from the hull pivot in frame px, x to port and y
// aft.
function hardpoints(craft: Scaled, bases: readonly Frame[], tops: readonly Frame[]): string {
  const { frame: size, pivot } = craft.base!;
  const top = craft.top!;
  const [x, y] = local(pivot);
  return json({
    version: 1,
    archetype: craft.archetype,
    frame: craft.frame,
    hull: hullSize(craft),
    hardpoints: [
      {
        id: "turret",
        role: "turret",
        states: ["intact"],
        top: "turret",
        offset: [round(x), round(y)],
      },
    ],
    headings: Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => {
      const placed = placement(craft, yaw);
      return {
        index: yaw,
        order: ["hull", "turret"],
        hardpoints: [
          {
            id: "turret",
            anchor: placed.anchor,
            pivot: placed.pivot,
            collision: {
              intact: bases[yaw]!.collision.map((part) =>
                part.map(([px, py]) => [
                  px2(px + placed.anchor[0] - size / 2),
                  px2(py + placed.anchor[1] - size / 2),
                ]),
              ),
            },
          },
        ],
      };
    }),
    tops: {
      turret: Array.from({ length: ENEMY_HEADINGS }, (_, aim) => ({
        index: aim,
        muzzles: top.muzzles.map((point) => anchor(ENEMY_HEADINGS, 0, aim, local(point))),
        collision: tops[aim]!.collision.map((part) =>
          part.map(([px, py]) => [px2(px - top.frame / 2), px2(py - top.frame / 2)]),
        ),
      })),
    },
  });
}
const px2 = (value: number) => Math.round(value * 100) / 100 + 0;

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
  const [, side, rear] = craft.fleck;
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
      [side, rear, rear],
    );
    return { kind: "fleck", mesh };
  });
  return [
    ...wedges.filter(({ mesh }) => mesh.length > 0),
    ...craft.parts.filter(({ loose }) => loose).map(({ mesh }): Group => ({ kind: "part", mesh })),
    ...(craft.base && craft.top
      ? [
          {
            kind: "part" as const,
            mesh: [
              ...craft.base.mesh,
              ...craft.top.mesh.map((face) => ({
                ...face,
                points: face.points.map(([x, y, z]): Point => [
                  x + craft.base!.pivot[0],
                  y + craft.base!.pivot[1],
                  z + craft.base!.pivot[2],
                ]),
              })),
            ],
          },
        ]
      : []),
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
    archetype: craft.stem,
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

// One sheet of sixteen frames as the producer stages it: its file, frame size, row ids and the
// fields its rows add to the common ones.
type Sheet = {
  file: string;
  size: number;
  ids: string[];
  frames: Frame[];
  fields: (index: number) => Record<string, unknown>;
};

// The manifest rows that replace the shipped rows of the same ids at the switch. `member` names
// the nested root of an identical sheet another row set already ships.
function entries(
  craft: Scaled,
  family: FleetFamily,
  { fields, ids, size }: Sheet,
  path: string,
  member?: readonly string[],
) {
  const display = size * DISPLAY_SCALE;
  return ids.map((id, index) => {
    const row = {
      width: size,
      height: size,
      displayWidth: display,
      displayHeight: display,
      facing: `world-${index}`,
      ...fields(index),
      pivot: { x: 0.5, y: 0.5 },
      archetype: craft.archetype,
    };
    const alias = member ? { svgSheetMember: member[index]! } : {};
    return family === "coral"
      ? { id, path, svgSheet: true, ...row, ...alias }
      : { id, path, ...row, family, svgSheet: true, ...alias };
  });
}

// A craft's sheets in one family: the hull, and for a craft with a mount its collar per hull
// heading and its top per aim.
function sheets(
  craft: Scaled,
  family: FleetFamily,
  drawn: { hull: Frame[]; bases?: Frame[]; tops?: Frame[] },
): Sheet[] {
  const tint = (frames: Frame[]) => frames.map((f) => ({ ...f, svg: recolour(family, f.svg) }));
  const stem = `${prefix(family)}${craft.stem}`;
  const ids = (part: string) =>
    Array.from({ length: ENEMY_HEADINGS }, (_, index) => `${stem}${part}-${index}`);
  return [
    {
      file: `${craft.key}-sheet.svg`,
      size: craft.frame,
      ids: ids(""),
      frames: tint(drawn.hull),
      fields: (directionIndex) => ({ directionIndex }),
    },
    ...(drawn.bases && drawn.tops
      ? [
          {
            file: `${craft.key}-turret-intact-sheet.svg`,
            size: craft.base!.frame,
            ids: ids("-turret-intact"),
            frames: tint(drawn.bases),
            fields: (directionIndex: number) => ({
              directionIndex,
              hardpoint: "turret",
              state: "intact",
            }),
          },
          {
            file: `${craft.key}-turret-top-sheet.svg`,
            size: craft.top!.frame,
            ids: ids("-turret-top"),
            frames: tint(drawn.tops),
            fields: (aimIndex: number) => ({ aimIndex, top: "turret" }),
          },
        ]
      : []),
  ];
}

async function pretty(path: string, text: string): Promise<string> {
  return format(text, { ...(await resolveConfig(path)), filepath: path });
}

async function main() {
  const crafts = fleetCrafts();
  const headings = Array.from({ length: ENEMY_HEADINGS }, (_, index) => index);
  const drawn = new Map(
    crafts.map((craft) => [
      craft.key,
      {
        hull: headings.map((yaw) => frame(craft, yaw)),
        ...(craft.base
          ? {
              bases: headings.map((yaw) => baseFrame(craft, yaw)),
              tops: headings.map((aim) => topFrame(craft, aim)),
            }
          : {}),
      },
    ]),
  );
  const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
  const shared = new Map<string, string>();
  // Each distinct sheet ships once: a later sheet with the same frames names the first one's
  // file and nested roots.
  const shipped = new Map<string, { path: string; ids: string[] }>();
  const rows: Record<string, { assets: unknown[]; sidecars: Sidecars }> = {};
  for (const family of FLEET_FAMILIES) {
    const files = new Map<string, string>();
    const staged: { craft: Scaled; sheet: Sheet; first?: { path: string; ids: string[] } }[] = [];
    for (const craft of crafts) {
      const frames = drawn.get(craft.key)!;
      for (const item of sheets(craft, family, frames)) {
        const content = `${item.size}\n${item.frames.map(({ svg }) => svg.replace(/<title>.*?<\/title>/u, "")).join("\n")}`;
        const first = shipped.get(content);
        if (first) {
          staged.push({ craft, sheet: item, first });
        } else {
          shipped.set(content, { path: `${directory(family)}${item.file}`, ids: item.ids });
          files.set(item.file, sheet(item.size, item.frames, item.ids));
          staged.push({ craft, sheet: item });
        }
      }
      if (family !== "coral") continue;
      files.set(`${craft.key}-jets.json`, jets(craft, frames.hull));
      if (frames.bases && frames.tops) {
        files.set(`${craft.key}-turret.json`, hardpoints(craft, frames.bases, frames.tops));
      }
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
    // Every family reads the coral folder's jets, hardpoints and shard pack: the jets and shards
    // carry its colours and the hardpoints have none.
    rows[MANIFESTS[family]] = {
      assets: staged.flatMap(({ craft, first, sheet: item }) =>
        entries(craft, family, item, first?.path ?? paths.get(item.file)!, first?.ids),
      ),
      sidecars: Object.fromEntries(
        crafts.map(({ base, key, stem }) => [
          stem,
          {
            jets: shared.get(`${key}-jets.json`)!,
            ...(base ? { hardpoints: shared.get(`${key}-turret.json`)! } : {}),
            shards: shared.get(`${key}-shards-packed.json`)!,
          },
        ]),
      ),
    };
  }
  const text = json(rows);
  if (!existsSync(ROWS) || readFileSync(ROWS, "utf8") !== text) writeFileSync(ROWS, text);
  for (const craft of crafts) {
    console.log(
      `${craft.key}: ${craft.design}, frame ${craft.frame}, display ${craft.frame * DISPLAY_SCALE}` +
        (craft.base ? `, base ${craft.base.frame}, top ${craft.top!.frame}` : ""),
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
