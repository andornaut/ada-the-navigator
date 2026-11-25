// Rare giant decorations: muted native SVG frames in each galaxy's own decoration tones. Every
// galaxy has three solid formations (art/tools/decoration-models.ts), resolved by depth into
// flat tones. Sunflower and Andromeda also keep their three flat planet frames, six in all.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import { decorationMesh } from "./decoration-models.ts";
import { type ManifestFile, readManifest, replaceEntries } from "./manifest.ts";
import { stageRows } from "./polish-rows.ts";
import { svgText } from "./svg-text.ts";
import { loopArea, pathData, tonePaths, type V2, visibleFragments } from "./visible.ts";

type GalaxyId = Exclude<ManifestFile, "core">;

export interface DecorationRecipe {
  readonly parallax: number;
  readonly chunk: readonly [number, number];
  readonly chance: number;
  readonly salt: string;
  readonly scale: readonly [number, number];
  readonly rotation: readonly [number, number];
  readonly sizes: readonly { scale: number; weight: number }[];
  readonly sprites: readonly {
    asset: string;
    width: number;
    height: number;
    bodies: readonly DecorationBody[];
  }[];
}

const FRAME = [1024, 768] as const;
// Clear frame px round a solid formation.
const MARGIN = 60;
// The formation's visible span in logical px at size scale 1.
const SPAN = 720;
// The galaxies whose flat planet frames stay beside the solid formations.
const PLANET_FRAMES: readonly GalaxyId[] = ["sunflower", "andromeda"];
// Their six-frame sheet, staged beside the shipped three-frame sheet until the switch.
const STAGED_SHEET = "decoration-set-sheet.svg";

type Drawing = { kind: "planet" | "solid"; variant: number };

// A galaxy's frames in sprite order. `staged` is the set after the switch.
function drawings(galaxy: GalaxyId, staged: boolean): Drawing[] {
  const planets = [0, 1, 2].map((variant): Drawing => ({ kind: "planet", variant }));
  const solids = [0, 1, 2].map((variant): Drawing => ({ kind: "solid", variant }));
  if (!PLANET_FRAMES.includes(galaxy)) return solids;
  return staged ? [...planets, ...solids] : planets;
}

const draw = (c: Colours, galaxy: GalaxyId, { kind, variant }: Drawing) =>
  kind === "planet" ? decorationDrawing(c, galaxy, variant) : solidDrawing(c, galaxy, variant);

const BLACK = { body: "#000000", lit: "#000000", night: "#000000", ring: "#000000" };

function sprites(galaxy: GalaxyId, staged: boolean): DecorationRecipe["sprites"] {
  return drawings(galaxy, staged).map((drawing, index) => {
    const { bodies } = draw(BLACK, galaxy, drawing);
    const xs = bodies.flatMap((body) =>
      body.polygons.flatMap((polygon) => polygon.outer.map((point) => point[0])),
    );
    const width = SPAN / (Math.max(...xs) - Math.min(...xs));
    return {
      asset: `backdrop-decoration-${galaxy}-${index + 1}`,
      width: n(width),
      height: n(width * 0.75),
      bodies,
    };
  });
}

/** Display geometry and placement are shared by the runtime and native Art proofs. */
export function decorationRecipe(galaxy: GalaxyId): DecorationRecipe {
  return {
    parallax: 0.12,
    chunk: [1050, 780],
    chance: 0.65,
    salt: "rare-decoration",
    scale: [0.98, 1.02],
    rotation: [-18, 18],
    sizes: [
      { scale: 1, weight: 6 },
      { scale: 2, weight: 3 },
      { scale: 3, weight: 1 },
    ],
    sprites: sprites(galaxy, false),
  };
}

function frames(colours: Colours, galaxy: GalaxyId, staged: boolean) {
  return drawings(galaxy, staged).map((drawing, index) => ({
    entry: {
      id: `backdrop-decoration-${galaxy}-${index + 1}`,
      path: `/art/${galaxy}/decoration-${index + 1}.svg`,
      width: FRAME[0],
      height: FRAME[1],
      kind: "backdrop-decoration",
      facing: "fixed",
      pivot: { x: 0.5, y: 0.5 },
    },
    svg: svgText(draw(colours, galaxy, drawing).svg),
  }));
}

// The frames as one sheet of nested roots, `width` px wide.
function sheetSvg(sheet: string, width: number, members: ReturnType<typeof frames>): string {
  const page = packAtlas({ compare: () => 0, extrude: 0, maxSize: width, widths: [width] }, [
    {
      value: sheet,
      rectangles: members.map(({ entry }) => ({ width: entry.width, height: entry.height })),
    },
  ])?.pages[0];
  const slots = page?.placed[0]?.at;
  if (!page || slots?.length !== members.length) {
    throw new Error(`Cannot pack ${sheet}`);
  }
  const roots = members.map(({ entry, svg }, index) => {
    const { x, y } = slots[index]!;
    return `<svg id="${entry.id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${page.height}" viewBox="0 0 ${width} ${page.height}">${roots.join("")}</svg>\n`;
}

/**
 * Write the galaxy's rare decoration assets and matching manifest entries. A galaxy that keeps
 * its planet frames also writes its six-frame sheet beside the shipped one and stages the
 * manifest rows and backdrop sprites that switch to it.
 */
export function writeDecorations(
  palette: Readonly<Record<string, string>>,
  galaxy: GalaxyId,
): void {
  const colours = {
    body: palette.body!,
    lit: palette.lit!,
    night: palette.night!,
    ring: palette.ring!,
  };
  const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
  const prefix = `backdrop-decoration-${galaxy}-`;
  const directory = `/art/${galaxy}/`;
  const sheet = `${directory}decoration-sheet.svg`;
  const live = frames(colours, galaxy, false);
  const owns = (id: string) => id.startsWith(prefix);
  const installed: readonly { id: string; path?: unknown; svgSheet?: unknown }[] =
    readManifest(galaxy).assets;
  const rows = installed.filter(({ id, path }) => owns(id) || path === sheet);
  const write = (path: string, svg: string) => writeFileSync(art + path.slice("/art/".length), svg);

  if (PLANET_FRAMES.includes(galaxy)) {
    const staged = `${directory}${STAGED_SHEET}`;
    const members = frames(colours, galaxy, true);
    write(staged, sheetSvg(staged, 3 * FRAME[0], members));
    stageRows(`decorations-${galaxy}`, {
      manifest: galaxy,
      replaces: sheet,
      assets: members.map(({ entry }) => ({ ...entry, path: staged, svgSheet: true })),
      backdrop: { decorations: { sprites: sprites(galaxy, true) } },
    });
  }

  if (!rows.some(({ path, svgSheet }) => path === sheet || svgSheet === true)) {
    for (const { entry, svg } of live) write(entry.path, svg);
    replaceEntries(
      galaxy,
      owns,
      live.map(({ entry }) => entry),
    );
    return;
  }
  if (
    rows.length !== live.length ||
    rows.some(
      ({ id, path, svgSheet }, index) =>
        id !== live[index]!.entry.id || path !== sheet || svgSheet !== true,
    )
  ) {
    throw new Error(`Invalid ${galaxy} backdrop decoration sheet selection`);
  }
  write(sheet, sheetSvg(sheet, 2 * FRAME[0], live));
  replaceEntries(
    galaxy,
    owns,
    live.map(({ entry }) => ({ ...entry, path: sheet, svgSheet: true })),
  );
}

type Colours = { body: string; lit: string; night: string; ring: string };
const tau = Math.PI * 2;
const n = (v: number) => Number(v.toFixed(2));
type Vertex = readonly [number, number];
interface DecorationPolygon {
  readonly outer: readonly Vertex[];
  readonly holes: readonly (readonly Vertex[])[];
}
export interface DecorationBody {
  readonly id: string;
  readonly polygons: readonly DecorationPolygon[];
}
let bodies: { id: string; polygons: DecorationPolygon[] }[] = [];
let current = "formation";
let recording = true;
function clip(points: readonly Vertex[]): Vertex[] {
  let out = [...points];
  for (const [axis, edge, sign] of [
    [0, 0, 1],
    [0, 1024, -1],
    [1, 0, 1],
    [1, 768, -1],
  ] as const) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i]!,
        b = input[(i + 1) % input.length]!;
      const insideA = sign * (a[axis] - edge) >= 0,
        insideB = sign * (b[axis] - edge) >= 0;
      if (insideA) out.push(a);
      if (insideA !== insideB) {
        const t = (edge - a[axis]) / (b[axis] - a[axis]);
        out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
  }
  return out;
}
function record(outer: readonly Vertex[], holes: readonly (readonly Vertex[])[] = []) {
  if (!recording) return;
  const boundary = clip(outer);
  if (boundary.length < 3) return;
  let body = bodies.find((body) => body.id === current);
  if (!body) {
    body = { id: current, polygons: [] };
    bodies.push(body);
  }
  const normalize = (ring: readonly Vertex[]) =>
    clip(ring).map(
      ([x, y]) => [Number((x / 1024).toFixed(6)), Number((y / 768).toFixed(6))] as const,
    );
  body.polygons.push({
    outer: normalize(boundary),
    holes: holes.map(normalize).filter((ring) => ring.length >= 3),
  });
}
const polygon = (points: readonly Vertex[], fill: string) => {
  record(points);
  return `<polygon fill="${fill}" points="${points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ")}"/>`;
};
const path = (d: string, fill: string) => `<path fill="${fill}" d="${d}"/>`;
const around = (x: number, y: number, r: number, count = 14) =>
  Array.from(
    { length: count },
    (_, i) =>
      [n(x + Math.cos((i * tau) / count) * r), n(y + Math.sin((i * tau) / count) * r)] as const,
  );
function planet(c: Colours, x: number, y: number, r: number, id: string, gas = false) {
  const previous = current;
  current = id === "giant" ? "formation" : id;
  record(around(x, y, r));
  current = previous;
  const wasRecording = recording;
  recording = false;
  const outline = polygon(around(x, y, r), "white");
  let ink =
    `<defs><clipPath id="${id}">${outline}</clipPath></defs><g clip-path="url(#${id})">` +
    polygon(around(x, y, r), c.body);
  if (gas) {
    ink += path(
      `M${x - r * 1.2} ${y - r * 0.52} Q${x} ${y + r * 0.1} ${x + r * 1.2} ${y - r * 0.18} L${x + r * 1.2} ${y + r * 0.02} Q${x} ${y + r * 0.36} ${x - r * 1.2} ${y - r * 0.3} Z`,
      c.lit,
    );
    ink += path(
      `M${x - r * 1.2} ${y + r * 0.16} Q${x} ${y + r * 0.73} ${x + r * 1.2} ${y + r * 0.35} L${x + r * 1.2} ${y + r * 0.58} Q${x} ${y + r * 0.98} ${x - r * 1.2} ${y + r * 0.4} Z`,
      c.ring,
    );
  }
  ink += `<ellipse cx="${x + r * 0.45}" cy="${y + r * 0.12}" rx="${r * 0.88}" ry="${r * 1.04}" fill="${c.night}"/>`;
  recording = wasRecording;
  return ink + "</g>";
}
function rings(
  c: Colours,
  x: number,
  y: number,
  rx: number,
  ry: number,
  angle: number,
  front = false,
) {
  if (!front) {
    const radians = (angle * Math.PI) / 180;
    const ring = (a: number, b: number, half: number) => {
      const boundary = (side: number) =>
        Array.from({ length: 128 }, (_, i): Vertex => {
          const t = (i * tau) / 128,
            nx = Math.cos(t) / a,
            ny = Math.sin(t) / b,
            length = Math.hypot(nx, ny);
          const px = a * Math.cos(t) + (side * half * nx) / length,
            py = b * Math.sin(t) + (side * half * ny) / length;
          return [
            n(x + px * Math.cos(radians) - py * Math.sin(radians)),
            n(y + px * Math.sin(radians) + py * Math.cos(radians)),
          ];
        });
      record(boundary(1), [boundary(-1)]);
    };
    ring(rx, ry, 6.5);
    ring(rx * 0.88, ry * 0.82, 10);
  }
  const transform = `transform="rotate(${angle} ${x} ${y})"`;
  return front
    ? `<g ${transform}><path d="M${x - rx} ${y} A${rx} ${ry} 0 0 0 ${x + rx} ${y}" fill="none" stroke="${c.ring}" stroke-width="13"/><path d="M${x - rx * 0.88} ${y} A${rx * 0.88} ${ry * 0.82} 0 0 0 ${x + rx * 0.88} ${y}" fill="none" stroke="${c.body}" stroke-width="20"/></g>`
    : `<g ${transform}><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${c.ring}" stroke-width="13"/><ellipse cx="${x}" cy="${y}" rx="${rx * 0.88}" ry="${ry * 0.82}" fill="none" stroke="${c.body}" stroke-width="20"/></g>`;
}
// The three tones of a solid formation, light to dark, as planet palette keys: lit, body and
// night. Sunflower takes the three tones of its planet frames, and Andromeda its ring tone as
// the darkest, so each galaxy's solids span the range its planet frames already ship.
const SOLID_TONES: Readonly<Partial<Record<GalaxyId, readonly (keyof Colours)[]>>> = {
  sunflower: ["body", "night", "ring"],
  andromeda: ["lit", "body", "ring"],
};
const solidTones = (c: Colours, galaxy: GalaxyId) =>
  (SOLID_TONES[galaxy] ?? ["lit", "body", "night"]).map((key) => c[key]);

// A loop smaller than this many square frame px is a sliver between facets and is not drawn.
const SLIVER = 12;

type Resolved = { paths: { tone: number; loops: V2[][] }[]; bodies: DecorationBody[] };
const resolved = new Map<string, Resolved>();

const inside = ([x, y]: V2, ring: readonly V2[]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[i]!, ring[j]!];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) {
      hit = !hit;
    }
  }
  return hit;
};

// The formation fitted to the frame inside the margin and centred, as tone paths and the bodies
// of its silhouette: the largest piece is `formation`, each further piece `part-2` onward, and
// openings through a piece are its holes.
function resolve(galaxy: GalaxyId, variant: number): Resolved {
  const key = `${galaxy} ${variant}`;
  const cached = resolved.get(key);
  if (cached) return cached;
  const visible = visibleFragments(decorationMesh(galaxy, variant), (point) => point);
  const xs = visible.flatMap(({ points }) => points.map(([x]) => x));
  const ys = visible.flatMap(({ points }) => points.map(([, y]) => y));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min((FRAME[0] - 2 * MARGIN) / (x1 - x0), (FRAME[1] - 2 * MARGIN) / (y1 - y0));
  const [tx, ty] = [FRAME[0] / 2 - (k * (x0 + x1)) / 2, FRAME[1] / 2 - (k * (y0 + y1)) / 2];
  const fitted = visible.map((fragment) => ({
    ...fragment,
    points: fragment.points.map(([x, y]): V2 => [x * k + tx, y * k + ty]),
  }));
  const paths = tonePaths(fitted, 1, SLIVER).map(({ fill, loops }) => ({
    tone: Number(fill),
    loops,
  }));
  const silhouette = paths[0]!.loops;
  const sign = Math.sign(
    loopArea(silhouette.toSorted((a, b) => Math.abs(loopArea(b)) - Math.abs(loopArea(a)))[0]!),
  );
  const outers = silhouette
    .filter((loop) => Math.sign(loopArea(loop)) === sign)
    .toSorted((a, b) => Math.abs(loopArea(b)) - Math.abs(loopArea(a)));
  const holes = silhouette.filter((loop) => Math.sign(loopArea(loop)) !== sign);
  const normal = (loop: readonly V2[]) =>
    loop.map(
      ([x, y]) => [Number((x / FRAME[0]).toFixed(6)), Number((y / FRAME[1]).toFixed(6))] as const,
    );
  const result = {
    paths,
    bodies: outers.map((outer, index) => ({
      id: index === 0 ? "formation" : `part-${index + 1}`,
      polygons: [
        {
          outer: normal(outer),
          holes: holes.filter((hole) => inside(hole[0]!, outer)).map(normal),
        },
      ],
    })),
  };
  resolved.set(key, result);
  return result;
}

function solidDrawing(
  c: Colours,
  galaxy: GalaxyId,
  variant: number,
): { svg: string; bodies: DecorationBody[] } {
  const { bodies, paths } = resolve(galaxy, variant);
  const tones = solidTones(c, galaxy);
  const ink = paths
    .map(({ loops, tone }) => `<path fill="${tones[tone]}" d="${pathData(loops)}"/>`)
    .join("");
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME[0]}" height="${FRAME[1]}" viewBox="0 0 ${FRAME[0]} ${FRAME[1]}">${ink}</svg>\n`,
    bodies,
  };
}

// The flat planet frames Sunflower and Andromeda keep.
function decorationDrawing(
  c: Colours,
  galaxy: GalaxyId,
  variant: number,
): { svg: string; bodies: DecorationBody[] } {
  bodies = [];
  current = "formation";
  recording = true;
  let ink = "";
  const v = variant;
  if (galaxy === "sunflower") {
    ink +=
      polygon(
        [
          [4, 50],
          [300, 80],
          [192, 286],
          [0, 242],
        ],
        c.night,
      ) +
      polygon(
        [
          [760, 522],
          [1024, 420],
          [1024, 752],
          [883, 714],
        ],
        c.body,
      );
    ink += rings(c, 512, 384, 470, 140, -18 + v * 9) + rings(c, 570, 365, 400, 205, 24 - v * 7);
    ink += planet(c, 512, 384, 335, "giant");
    ink +=
      rings(c, 512, 384, 470, 140, -18 + v * 9, true) +
      rings(c, 570, 365, 400, 205, 24 - v * 7, true);
    ink += planet(c, 112, 584, 38, "moon");
  } else {
    ink += planet(c, 512 + v * 12, 384, 335, "giant", true);
    ink += planet(c, 108, 180, 36, "moon1") + planet(c, 903, 579, 44, "moon2");
  }
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">${ink}</svg>\n`,
    bodies,
  };
}

/** One live frame of a galaxy's set, by sprite index. */
export function decorationSvg(c: Colours, galaxy: GalaxyId, index: number): string {
  return draw(c, galaxy, drawings(galaxy, false)[index]!).svg;
}

/** Every frame of a galaxy's set after the switch, in sprite order. */
export function decorationSet(c: Colours, galaxy: GalaxyId): string[] {
  return drawings(galaxy, true).map((drawing) => draw(c, galaxy, drawing).svg);
}
