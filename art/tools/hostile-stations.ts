// The hostile station producer (art/station-redesign.md). `node art/tools/hostile-stations.ts`
// writes each family's hostile station and the Claim platform at 16 headings beside the shipped
// enemy art: the hull sheet, the sheet of weapon bases in their intact, destroyed and capped
// states, and the hardpoints file, with the manifest rows and sidecars that switch to them in
// art/hostile-station-rows.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DISPLAY_SCALE } from "./crafts.ts";
import { packHullRoots } from "./enemies.ts";
import { traceEnemyFills } from "./enemy-outline.ts";
import { ADA_MODEL_SPAN, enemySizeRatio } from "./enemy-size.ts";
import { tonePaths } from "./fleet.ts";
import { shade } from "./fleet-models.ts";
import { type ManifestFile, readManifest, type Sidecars } from "./manifest.ts";
import { depth, ENEMY_HEADINGS, json, type Point, projectAt, rotate, round } from "./projection.ts";
import type { Fill } from "./silhouette.ts";
import { LIGHT, type Mesh, meshScale, meshTube, type Tones } from "./solid.ts";
import {
  type Hostile,
  hostileClaim,
  hostileCoral,
  hostileGarnet,
  hostilePlatform,
} from "./station-models.ts";
import { svgText } from "./svg-text.ts";
import { type Fragment, loopArea, type V2, visibleFragments } from "./visible.ts";

// Douglas-Peucker tolerances for the hull and base silhouettes, in frame px.
const HULL_TOLERANCES = [0.4];
const BASE_TOLERANCES = [0.4, 0.3, 0.2, 0.1];
// A weapon mount as the enemy fleet's tops fit it (art/enemy-redesign.md), in frame px: the
// collar's radius and height, and the square frame of a base.
const MOUNT_RADIUS = 4.6 / DISPLAY_SCALE;
const COLLAR_HEIGHT = 1.2 / DISPLAY_SCALE;
const BASE_FRAME = 32;
// A mount whose intact collar shows less than this share is hidden: its top is not drawn.
const HIDDEN_SHARE = 0.5;
const STATES = ["intact", "destroyed", "capped"] as const;
type State = (typeof STATES)[number];
// The face group of a weapon base, resolved against the hull.
const BASE = 1;

const mat = (top: string): Tones => [top, shade(top, 0.76), shade(top, 0.56)];
const VISOR: Tones = ["#2a2433", "#1e1a26", "#16131c"];
// The collar, cap plate and breach tones of each family's mounts: the enemy fleet's, so a base
// matches the top it carries.
type MountPaint = { collar: Tones; plate: Tones; dark: Tones };
const mounts = (turret: string, plate: string, dark: Tones): MountPaint => ({
  collar: mat(shade(turret, 0.78)),
  plate: mat(plate),
  dark,
});
const MOUNT_PAINT = {
  coral: mounts("#c27a62", "#e6a890", VISOR),
  claim: mounts("#a95e30", "#b5a998", ["#2b1d1c", "#1f1514", "#17100f"]),
  garnet: mounts("#c65c6d", "#deb7b6", VISOR),
} as const;

export type Design = {
  key: string;
  title: string;
  archetype: "hostileStation" | "platform";
  family: keyof typeof MOUNT_PAINT;
  manifest: ManifestFile;
  // The id prefix of its rows: `{prefix}-{k}` hulls and `{prefix}-{mount}-{state}-{k}` bases.
  prefix: string;
  // The tops of art/fleet-tops.json that each of its top names draws.
  tops: Readonly<Record<string, string>>;
  // The model, with the light in mesh space at the heading it is drawn at.
  build: (light: Point) => Hostile;
};

export const DESIGNS: readonly Design[] = [
  {
    key: "hostileStationCoral",
    title: "Coral hostile station",
    archetype: "hostileStation",
    family: "coral",
    manifest: "core",
    prefix: "enemy-hostileStation",
    tops: { pod: "pod", dome: "dome" },
    build: hostileCoral,
  },
  {
    key: "hostileStationClaim",
    title: "Claim hostile station",
    archetype: "hostileStation",
    family: "claim",
    manifest: "cartwheel",
    prefix: "enemy-claim-hostileStation",
    tops: { pod: "pod", dome: "dome" },
    build: hostileClaim,
  },
  {
    key: "hostileStationGarnet",
    title: "Garnet hostile station",
    archetype: "hostileStation",
    family: "garnet",
    manifest: "andromeda",
    prefix: "enemy-garnet-hostileStation",
    tops: { pod: "pod", dome: "dome" },
    build: hostileGarnet,
  },
  {
    key: "platformWheel",
    title: "Claim turret platform",
    archetype: "platform",
    family: "claim",
    manifest: "cartwheel",
    prefix: "enemy-claim-platform",
    tops: { turret: "gun" },
    build: hostilePlatform,
  },
];

// Mesh space (forward +x, port +y) to the projection's local space (forward -y), then to the
// view at heading `yaw`.
const local = ([l, w, z]: Point): Point => [w, -l, z];
const view = (yaw: number) => (point: Point) => rotate(ENEMY_HEADINGS, yaw, local(point));
// The one light in mesh space at heading `yaw`: the view's rotation undone.
function lightAt(yaw: number): Point {
  const angle = -((yaw * Math.PI) / (ENEMY_HEADINGS / 2) + Math.PI / 2);
  const [x, y] = [
    LIGHT[0] * Math.cos(angle) - LIGHT[1] * Math.sin(angle),
    LIGHT[0] * Math.sin(angle) + LIGHT[1] * Math.cos(angle),
  ];
  const light: Point = [-y, x, LIGHT[2]];
  const back = view(yaw)(light);
  if (back.some((v, i) => Math.abs(v - LIGHT[i]!) > 1e-9)) throw new Error("The light is off");
  return light;
}

// A mount's base in one state, standing on the deck at `at`: the collar, the collar closed by a
// low plate, or a scorched stump with a breach.
function base(paint: MountPaint, at: Point, state: State): Mesh {
  const mesh: Mesh = [];
  const up = (z: number): Point => [at[0], at[1], at[2] + z];
  if (state === "destroyed") {
    const breach: Tones = [paint.dark[2], paint.dark[2], paint.dark[2]];
    meshTube(mesh, at, up(COLLAR_HEIGHT * 0.6), MOUNT_RADIUS, MOUNT_RADIUS, paint.dark, 16);
    meshTube(
      mesh,
      up(COLLAR_HEIGHT * 0.6),
      up(COLLAR_HEIGHT * 0.6 + 0.1 / DISPLAY_SCALE),
      0.6 * MOUNT_RADIUS,
      0.6 * MOUNT_RADIUS,
      breach,
      12,
    );
    return mesh;
  }
  meshTube(mesh, at, up(COLLAR_HEIGHT), MOUNT_RADIUS, MOUNT_RADIUS, paint.collar, 16);
  if (state === "capped") {
    meshTube(
      mesh,
      up(COLLAR_HEIGHT),
      up(COLLAR_HEIGHT + 0.5 / DISPLAY_SCALE),
      0.7 * MOUNT_RADIUS,
      0.7 * MOUNT_RADIUS,
      paint.plate,
      12,
    );
  }
  return mesh;
}

// A design scaled to its contract span, in frame px: the hull at each heading and its mounts.
// `length` and `width` are the drawn hull's extents fore and aft and across, in frame px, as the
// enemy fleet's.
type Scaled = Design & {
  frame: number;
  length: number;
  width: number;
  hulls: Mesh[];
  mounts: { id: string; at: Point }[];
};

function scaled(design: Design): Scaled {
  const source = design.build(LIGHT);
  // The hull's widest breadth as it turns: the span the contract sizes.
  let breadth = 0;
  for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
    const [c, s] = [Math.cos((yaw * Math.PI) / 8), Math.sin((yaw * Math.PI) / 8)];
    let [low, high] = [Infinity, -Infinity];
    for (const face of source.hull) {
      for (const [l, w] of face.points) {
        low = Math.min(low, l * s + w * c);
        high = Math.max(high, l * s + w * c);
      }
    }
    breadth = Math.max(breadth, high - low);
  }
  const k = (enemySizeRatio(design.archetype) * ADA_MODEL_SPAN) / breadth;
  const mounted = source.mounts.map(({ id, at }) => ({
    id,
    at: [at[0] * k, at[1] * k, at[2] * k] as Point,
  }));
  const hulls = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) =>
    meshScale(design.build(lightAt(yaw)).hull, [k, k, k]),
  );
  const paint = MOUNT_PAINT[design.family];
  const solids = [
    ...hulls[0]!,
    ...mounted.flatMap(({ at }) => STATES.flatMap((state) => base(paint, at, state))),
  ];
  let extent = 0;
  for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
    for (const face of solids) {
      for (const point of face.points) {
        const [x, y] = projectAt(0, 0, view(yaw)(point));
        extent = Math.max(extent, Math.abs(x), Math.abs(y));
      }
    }
  }
  const points = source.hull.flatMap((face) => face.points);
  const along = (axis: 0 | 1) =>
    (Math.max(...points.map((point) => point[axis])) -
      Math.min(...points.map((point) => point[axis]))) *
    k;
  return {
    ...design,
    frame: Math.ceil((2 * extent + 2) / 8) * 8,
    length: along(0),
    width: along(1),
    hulls,
    mounts: mounted,
  };
}

const pathData = (loops: readonly V2[][]) =>
  loops.map((loop) => `M${loop.map(([x, y]) => `${x},${y}`).join("L")}Z`).join("");
const px2 = (value: number) => Math.round(value * 100) / 100 + 0;
const shift = (visible: readonly Fragment[], dx: number, dy: number): Fragment[] =>
  visible.map((fragment) => ({
    ...fragment,
    points: fragment.points.map(([x, y]): V2 => [x + dx, y + dy]),
  }));
const fills = (visible: readonly Fragment[]): Fill[] =>
  visible.map(({ points, slot, tones }) => ({
    color: tones[slot],
    points: points.map(([x, y]): V2 => [Number(x.toFixed(2)), Number(y.toFixed(2))]),
  }));
const area = (visible: readonly Fragment[]) =>
  visible.reduce((sum, { points }) => sum + Math.abs(loopArea(points)), 0);

export type Frame = { svg: string; silhouette: string; collision: V2[][] };

// One frame of `size`: notch tips first, then the tone paths, with its collision parts. A base
// the hull hides whole is an empty frame.
function frame(
  id: string,
  title: string,
  size: number,
  visible: readonly Fragment[],
  tolerances: readonly number[],
): Frame {
  const root = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><title>${title}</title>`;
  if (visible.length === 0) return { svg: svgText(`${root}</svg>`), silhouette: "", collision: [] };
  const traced = traceEnemyFills(id, fills(visible), [size, size], tolerances);
  const paths = tonePaths(visible);
  const svg = [
    root,
    ...traced.tips.map(
      ({ color, points }) =>
        `<polygon fill="${color}" points="${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}"/>`,
    ),
    ...paths.map(({ fill, loops }) => `<path fill="${fill}" d="${pathData(loops)}"/>`),
    "</svg>",
  ].join("");
  return {
    svg: svgText(svg),
    silhouette: pathData(paths[0]!.loops),
    collision: traced.collision,
  };
}

// Where a heading places a mount: its base sprite's centre and its top's pivot, in frame px, how
// near the viewer it stands, and the share of its intact collar the hull leaves visible.
type Placement = { anchor: V2; pivot: V2; nearness: number; share: number };
export type Drawn = {
  design: Scaled;
  hulls: Frame[];
  // By `{mount} {state}`, one frame per heading.
  bases: Map<string, Frame[]>;
  // By mount id, one placement per heading.
  placements: Map<string, Placement[]>;
};
export const baseKey = (mount: string, state: string) => `${mount} ${state}`;

export function draw(source: Design): Drawn {
  const design = scaled(source);
  const centre = design.frame / 2;
  const paint = MOUNT_PAINT[design.family];
  const headings = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => yaw);
  const hulls = headings.map((yaw) =>
    frame(
      `${design.key} ${yaw}`,
      `${design.title} ${yaw}`,
      design.frame,
      shift(visibleFragments(design.hulls[yaw]!, view(yaw)), centre, centre),
      HULL_TOLERANCES,
    ),
  );
  const bases = new Map<string, Frame[]>();
  const placements = new Map<string, Placement[]>();
  for (const { id, at } of design.mounts) {
    const shares: number[] = [];
    for (const state of STATES) {
      const mesh = base(paint, at, state);
      bases.set(
        baseKey(id, state),
        headings.map((yaw) => {
          const [ax, ay] = projectAt(0, 0, view(yaw)(at));
          const visible = visibleFragments(
            [...design.hulls[yaw]!, ...mesh.map((face) => ({ ...face, group: BASE }))],
            view(yaw),
            BASE,
          );
          if (state === "intact") {
            shares.push(area(visible) / area(visibleFragments(mesh, view(yaw))));
          }
          return frame(
            `${design.key} ${id} ${state} ${yaw}`,
            `${design.title} ${id} ${state} ${yaw}`,
            BASE_FRAME,
            shift(visible, BASE_FRAME / 2 - ax, BASE_FRAME / 2 - ay),
            BASE_TOLERANCES,
          );
        }),
      );
    }
    placements.set(
      id,
      headings.map((yaw) => {
        const [ax, ay] = projectAt(centre, centre, view(yaw)(at));
        const [px, py] = projectAt(
          centre,
          centre,
          view(yaw)([at[0], at[1], at[2] + COLLAR_HEIGHT]),
        );
        return {
          anchor: [round(ax), round(ay)],
          pivot: [round(px), round(py)],
          nearness: -depth([view(yaw)(at)]),
          share: shares[yaw]!,
        };
      }),
    );
  }
  return { design, hulls, bases, placements };
}

// The mounts of a heading, far to near.
export const order = ({ design, placements }: Drawn, yaw: number): string[] =>
  design.mounts
    .map(({ id }) => ({ id, nearness: placements.get(id)![yaw]!.nearness }))
    .sort((a, b) => a.nearness - b.nearness || (a.id < b.id ? -1 : 1))
    .map(({ id }) => id);

const ART = fileURLToPath(new URL("../../public/", import.meta.url));
const ROWS = fileURLToPath(new URL("../hostile-station-rows.json", import.meta.url));
const TOPS = fileURLToPath(new URL("../fleet-tops.json", import.meta.url));

type Aim = { index: number; muzzles: V2[]; collision: V2[][] };
// The enemy fleet's staged tops (art/enemy-redesign.md), when its producer has written them.
const fleetTops = (): Record<string, { aims: Aim[] }> | undefined =>
  existsSync(TOPS)
    ? (JSON.parse(readFileSync(TOPS, "utf8")) as { tops: Record<string, { aims: Aim[] }> }).tops
    : undefined;

// The version 1 hardpoints file in the shipped schema. The mounts, fill order, weapon tops and
// tiers are the shipped file's; a mount the hull hides at a heading is `hidden` there. `tops`
// holds the shot origins and collision of the fleet's tops once they are staged.
function hardpoints(drawn: Drawn): string {
  const { design, hulls, bases, placements } = drawn;
  const sidecars = (readManifest(design.manifest).sidecars ?? {}) as Sidecars;
  const shippedPath = sidecars[design.archetype]?.hardpoints;
  if (!shippedPath) throw new Error(`${design.manifest} has no ${design.archetype} hardpoints`);
  const shipped = JSON.parse(readFileSync(`${ART}${shippedPath.slice(1)}`, "utf8")) as {
    hardpoints: { id: string }[];
    fill: string[];
    weaponTops: Record<string, { top: string }>;
    tiers: unknown;
  };
  const ids = design.mounts.map(({ id }) => id);
  if (shipped.fill.join() !== ids.join())
    throw new Error(`${design.key}: mounts not in fill order`);
  const staged = fleetTops();
  const moved = (frames: readonly Frame[], yaw: number, [dx, dy]: V2) =>
    frames[yaw]!.collision.map((part) => part.map(([x, y]) => [px2(x + dx), px2(y + dy)]));
  return json({
    version: 1,
    archetype: design.archetype,
    frame: design.frame,
    // The drawn hull in frame px; `radius` is the spacing and footprint radius.
    hull: {
      length: round(design.length),
      width: round(design.width),
      radius: round(Math.max(design.length, design.width) / 2),
    },
    hardpoints: shipped.hardpoints,
    fill: shipped.fill,
    weaponTops: shipped.weaponTops,
    tiers: shipped.tiers,
    headings: Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => {
      const ys = hulls[yaw]!.collision.flat().map(([, y]) => y);
      return {
        index: yaw,
        order: ["hull", ...order(drawn, yaw)],
        hardpoints: ids.map((id) => {
          const { anchor, pivot, share } = placements.get(id)![yaw]!;
          const corner: V2 = [anchor[0] - BASE_FRAME / 2, anchor[1] - BASE_FRAME / 2];
          return {
            id,
            anchor,
            pivot,
            ...(share < HIDDEN_SHARE ? { hidden: true } : {}),
            collision: Object.fromEntries(
              STATES.map((state) => [state, moved(bases.get(baseKey(id, state))!, yaw, corner)]),
            ),
          };
        }),
        collision: hulls[yaw]!.collision,
        // The Disabled banner's centre: the pivot x and the centre y of the drawn hull.
        banner: [design.frame / 2, px2((Math.min(...ys) + Math.max(...ys)) / 2)],
      };
    }),
    ...(staged && {
      tops: Object.fromEntries(
        Object.entries(design.tops).map(([name, top]) => {
          if (!staged[top]) throw new Error(`fleet-tops.json has no ${top} top`);
          return [name, staged[top].aims];
        }),
      ),
    }),
  });
}

type Row = { id: string; [key: string]: unknown };
const directory = (manifest: ManifestFile) =>
  manifest === "core" ? "/art/enemies/" : `/art/${manifest}/enemies/`;

const untitled = (svg: string) => svg.replace(/<title>.*?<\/title>/u, "");

// The sheet of the bases, 16 roots to a row, and the root each base's row draws. Bases that draw
// alike share one root: a collar the hull does not cover is the same on every mount.
function basesSheet({ design, bases }: Drawn): { text: string; member: Map<string, string> } {
  const member = new Map<string, string>();
  const first = new Map<string, string>();
  const roots: string[] = [];
  for (const { id: mount } of design.mounts) {
    for (const state of STATES) {
      for (const [yaw, { svg }] of bases.get(baseKey(mount, state))!.entries()) {
        const id = `${design.prefix}-${mount}-${state}-${yaw}`;
        const same = first.get(untitled(svg));
        member.set(id, same ?? id);
        if (same !== undefined) continue;
        first.set(untitled(svg), id);
        const at = `x="${(roots.length % ENEMY_HEADINGS) * BASE_FRAME}" y="${Math.floor(roots.length / ENEMY_HEADINGS) * BASE_FRAME}"`;
        roots.push(`<svg id="${id}" ${at} ${svg.slice("<svg ".length)}`);
      }
    }
  }
  const wide = ENEMY_HEADINGS * BASE_FRAME;
  const tall = Math.ceil(roots.length / ENEMY_HEADINGS) * BASE_FRAME;
  return {
    text: `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${tall}" viewBox="0 0 ${wide} ${tall}">${roots.join("")}</svg>\n`,
    member,
  };
}

function writeIfChanged(path: string, text: string) {
  if (!existsSync(path) || readFileSync(path, "utf8") !== text) writeFileSync(path, text);
}

function main() {
  const rows: Record<string, { assets: Row[]; sidecars: Sidecars }> = {};
  for (const source of DESIGNS) {
    const drawn = draw(source);
    const { design, hulls } = drawn;
    const folder = directory(design.manifest);
    const files = {
      hull: `${folder}${design.key}-sheet.svg`,
      bases: `${folder}${design.key}-bases-sheet.svg`,
      hardpoints: `${folder}${design.key}-hardpoints.json`,
    };
    writeIfChanged(
      `${ART}${files.hull.slice(1)}`,
      packHullRoots(
        design.frame,
        hulls.map(({ svg }, yaw) => ({ id: `${design.prefix}-${yaw}`, svg })),
      ),
    );
    const { text, member } = basesSheet(drawn);
    writeIfChanged(`${ART}${files.bases.slice(1)}`, text);
    writeIfChanged(`${ART}${files.hardpoints.slice(1)}`, hardpoints(drawn));
    const shipped: Row[] = readManifest(design.manifest).assets;
    const sized = (size: number) => ({
      width: size,
      height: size,
      displayWidth: size * DISPLAY_SCALE,
      displayHeight: size * DISPLAY_SCALE,
    });
    const staged = (rows[design.manifest] ??= { assets: [], sidecars: {} });
    for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
      const id = `${design.prefix}-${yaw}`;
      // The platform's shipped hull is one fixed frame, so its heading rows are new.
      const row = shipped.find((entry) => entry.id === id) ?? {
        id,
        path: files.hull,
        ...sized(design.frame),
        facing: `world-${yaw}`,
        directionIndex: yaw,
        pivot: { x: 0.5, y: 0.5 },
        archetype: design.archetype,
        family: design.family,
        svgSheet: true,
      };
      staged.assets.push({ ...row, path: files.hull, ...sized(design.frame), svgSheet: true });
    }
    for (const { id: mount } of design.mounts) {
      for (const state of STATES) {
        for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
          const id = `${design.prefix}-${mount}-${state}-${yaw}`;
          const row = shipped.find((entry) => entry.id === id);
          if (!row) throw new Error(`${id} has no row in the ${design.manifest} manifest`);
          const kept = Object.fromEntries(
            Object.entries(row).filter(([key]) => key !== "svgSheetMember"),
          ) as Row;
          staged.assets.push({
            ...kept,
            path: files.bases,
            ...sized(BASE_FRAME),
            svgSheet: true,
            ...(member.get(id) !== id && { svgSheetMember: member.get(id) }),
          });
        }
      }
    }
    staged.sidecars[design.archetype] = { hardpoints: files.hardpoints };
    const hiddenCount = [...drawn.placements.values()].flat().filter(({ share }) => share < 0.5);
    console.log(
      `${design.key}: frame ${design.frame}, display ${design.frame * DISPLAY_SCALE}, ${design.mounts.length} mounts, ${hiddenCount.length} hidden mount headings`,
    );
  }
  writeIfChanged(ROWS, json(rows));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
