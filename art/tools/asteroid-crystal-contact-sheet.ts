// Review sheets of the crystal variants: `node art/tools/asteroid-crystal-contact-sheet.ts <dir>`
// writes, for each galaxy, `<dir>/crystal-variants-<galaxy>-<scale>x.svg` (every medium and
// larger shape plain, with its small cluster and with its full cluster, at spin frames 0, 6, 12
// and 18, at 1x or 2x display size) and `<dir>/crystal-field-<galaxy>.svg` (a 960 by 540 display
// px field of ordinary rocks picked by the selection rule), `<dir>/crystal-ore-fields-cartwheel.svg`
// (two Cartwheel ore fields of full clusters at game scale) and `<dir>/crystal-frames.svg` (every
// spin frame of every spinning variant at 2x on Cartwheel). Every rock draws over its 1 px edge:
// the ink keyline on light fields, white on Phantom. `<dir>/crystal-fits.json` lists each
// variant's fitted crystal sizes and, per frame, the pixels its shipped SVG draws outside its
// plain rock's shipped SVG at 4 px per frame px. `<dir>/crystal-medium-review.svg` compares the
// fitted medium clusters with review-only ones at 0.4 and 0.6 of the approved crystal size, which reach
// past the outline.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  type Cluster,
  CRYSTAL_FITS,
  CRYSTAL_VARIANTS,
  crystalId,
  crystalVariants,
  DISPLAY,
  rockFrames,
  VEIN_FITS,
  SHAPES,
} from "./asteroids.ts";
import type { V2 } from "./silhouette.ts";

type Row = {
  id: string;
  size: string;
  frame: { width: number; height: number };
  pivot: [number, number];
  frames: { collision: V2[][] }[];
  svgSheet: string;
};

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const read = <T>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T;
const catalog = read<{ asteroids: Row[] }>(`${art}asteroids.json`);
const staged = read<{
  crystals: {
    selection: { ordinary: { sizes: string[]; share: number; salt: string; except: string[] } };
    variants: Record<string, Partial<Record<Cluster, string>>>;
    rocks: Row[];
  };
}>(fileURLToPath(new URL("../asteroid-crystal-rows.json", import.meta.url)));
const galaxies = read<{
  galaxies: Record<string, { colors: { background: string }; foregroundEdge?: string }>;
}>(`${art}galaxies.json`).galaxies;
const oreField = read<{
  variants: {
    id: string;
    layouts: { count: number; rocks: { id: string; position: V2; frame: number }[] }[];
  }[];
}>(`${art}cartwheel/ore-field.json`);

const INK = "#181425";
const FIELDS = ["sunflower", "cartwheel", "andromeda", "needle", "whirlpool", "phantom"].map(
  (id) => ({
    id,
    field: galaxies[id]!.colors.background,
    edge: galaxies[id]!.foregroundEdge ?? INK,
  }),
);
const SAMPLE_FRAMES = [0, 6, 12, 18];
const GAP = 8;
const LABEL = 16;

// A shipped frame's drawing: the nested root `<id>-<k>` of its sheet.
const sheets = new Map<string, string>();
function shipped(row: Row, k: number): string {
  let text = sheets.get(row.svgSheet);
  if (!text) {
    text = readFileSync(`${art}${row.svgSheet.replace(/^\/art\//u, "")}`, "utf8");
    sheets.set(row.svgSheet, text);
  }
  const match = new RegExp(`<svg id="${row.id}-${k}" [^>]*>(.*?)</svg>`, "su").exec(text);
  if (!match) throw new Error(`${row.svgSheet} lacks ${row.id}-${k}`);
  return match[1]!.replace(/<title>.*?<\/title>/su, "");
}

const rows = new Map([...catalog.asteroids, ...staged.crystals.rocks].map((row) => [row.id, row]));

// Review-only medium clusters at REVIEW_SIZES of the approved crystal size with no fit, so they
// reach past the plain silhouette, to find the least overhang that reads as crystals at 1x.
const REVIEW_SIZES = [0.4, 0.6];
const review = new Map<string, { row: Row; frames: string[] }>();
for (const shape of SHAPES.filter(({ size }) => size === "medium")) {
  for (const [cluster, size] of REVIEW_SIZES.flatMap((size) =>
    (["small", "full"] as const).map((cluster) => [cluster, size] as const),
  )) {
    const id = `${crystalId(shape.id, cluster)}-review-${size}`;
    const { entry, frames } = rockFrames(
      { ...shape, id },
      { cluster, declared: "frame", review: size },
    );
    review.set(id, {
      row: { ...(entry as unknown as Row), svgSheet: "" },
      frames: frames.map(({ source }) =>
        source.replace(/^<svg[^>]*>|<\/svg>\s*$/gu, "").replace(/<title>.*?<\/title>/su, ""),
      ),
    });
  }
}
// Review-only flush veins on the medium shapes, `<crystal id>-vein`.
for (const shape of SHAPES.filter(({ size }) => size === "medium")) {
  for (const cluster of ["small", "full"] as const) {
    const id = `${crystalId(shape.id, cluster)}-vein`;
    const { entry, frames } = rockFrames(
      { ...shape, id },
      { cluster, declared: "frame", vein: true },
    );
    review.set(id, {
      row: { ...(entry as unknown as Row), svgSheet: "" },
      frames: frames.map(({ source }) =>
        source.replace(/^<svg[^>]*>|<\/svg>\s*$/gu, "").replace(/<title>.*?<\/title>/su, ""),
      ),
    });
  }
}
const look = (id: string) => rows.get(id) ?? review.get(id)!.row;
const body = (id: string, k: number) =>
  rows.has(id) ? shipped(rows.get(id)!, k) : review.get(id)!.frames[k]!;
const CRYSTAL_SHAPES = SHAPES.filter(({ id }) => Object.keys(staged.crystals.variants[id]!).length);

// One rock at display scale `scale` with its pivot at (x, y), over its edge: the drawing's alpha
// at 0.5, grown by 1 display px with a square kernel, in the edge colour.
function rock(id: string, k: number, x: number, y: number, scale: number): string {
  const row = look(id);
  const w = row.frame.width * DISPLAY * scale;
  const h = row.frame.height * DISPLAY * scale;
  return `<svg x="${x - row.pivot[0] * w}" y="${y - row.pivot[1] * h}" width="${w}" height="${h}" viewBox="0 0 ${row.frame.width} ${row.frame.height}" overflow="visible"><g filter="url(#edge)">${body(id, k)}</g>${body(id, k)}</svg>`;
}

const edgeFilter = (edge: string) =>
  `<defs><filter id="edge" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feComponentTransfer in="SourceAlpha" result="a"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer><feMorphology in="a" operator="dilate" radius="${(1 / DISPLAY).toFixed(4)}" result="d"/><feFlood flood-color="${edge}"/><feComposite in2="d" operator="in"/></filter></defs>`;

const svg = (w: number, h: number, edge: string, content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}">${edgeFilter(edge)}${content}</svg>\n`;

const text = (x: number, y: number, fill: string, value: string) =>
  `<text x="${x}" y="${y}" font-family="DejaVu Sans" font-size="11" fill="${fill}">${value}</text>`;

// Every shape: plain, small cluster, full cluster, each at the sample frames.
function variantSheet(field: string, edge: string, scale: number): string {
  const parts: string[] = [];
  let y = GAP;
  let width = 0;
  for (const shape of CRYSTAL_SHAPES) {
    const ids = [
      shape.id,
      ...(["small", "full"] as const).map((c) => crystalId(shape.id, c)),
    ].filter((id) => rows.has(id));
    const frames = look(shape.id).frames.length > 1 ? SAMPLE_FRAMES : [0];
    const high = Math.max(...ids.map((id) => look(id).frame.height)) * DISPLAY * scale;
    parts.push(
      text(
        GAP,
        y + 11,
        edge,
        `${shape.id}: plain, small${staged.crystals.variants[shape.id]!.full ? ", full" : ""}`,
      ),
    );
    y += LABEL;
    let x = GAP;
    for (const id of ids) {
      const row = look(id);
      const w = row.frame.width * DISPLAY * scale;
      for (const k of frames) {
        parts.push(
          rock(
            id,
            k,
            x + w / 2,
            y + high - (1 - row.pivot[1]) * row.frame.height * DISPLAY * scale,
            scale,
          ),
        );
        x += w + GAP;
      }
      x += GAP * 2;
    }
    width = Math.max(width, x);
    y += high + GAP;
  }
  return svg(width, y, edge, `<rect width="100%" height="100%" fill="${field}"/>${parts.join("")}`);
}

// Every spin frame of every spinning variant, 2x on Cartwheel.
// Medium rocks plain, with the shipped fitted clusters, and with the review-only clusters at
// each of REVIEW_SIZES, on Cartwheel and Sunflower at 1x and 2x.
function reviewSheet(): string {
  const parts: string[] = [];
  let y = GAP;
  let width = 0;
  for (const { id: galaxy, field, edge } of FIELDS.filter(
    ({ id }) => id === "cartwheel" || id === "sunflower",
  )) {
    for (const scale of [1, 2]) {
      const top = y;
      const cells: string[] = [];
      cells.push(
        text(
          GAP,
          y + 11,
          edge,
          `${galaxy} ${scale}x: plain | fitted small, full | review ${REVIEW_SIZES.join(", ")} small, full (past the outline)`,
        ),
      );
      y += LABEL;
      for (const shape of SHAPES.filter(({ size }) => size === "medium")) {
        const ids = [
          shape.id,
          crystalId(shape.id, "small"),
          crystalId(shape.id, "full"),
          ...REVIEW_SIZES.flatMap((size) =>
            (["small", "full"] as const).map((c) => `${crystalId(shape.id, c)}-review-${size}`),
          ),
        ];
        const high = Math.max(...ids.map((id) => look(id).frame.height)) * DISPLAY * scale;
        let x = GAP;
        for (const id of ids) {
          const row = look(id);
          const w = row.frame.width * DISPLAY * scale;
          for (const k of SAMPLE_FRAMES) {
            cells.push(
              rock(
                id,
                k,
                x + w / 2,
                y + high - (1 - row.pivot[1]) * row.frame.height * DISPLAY * scale,
                scale,
              ),
            );
            x += w + GAP;
          }
          x += GAP * 2;
        }
        width = Math.max(width, x);
        y += high + GAP;
      }
      parts.push(
        `<rect x="0" y="${top}" width="100%" height="${y - top}" fill="${field}"/>`,
        ...cells,
      );
    }
  }
  return svg(width, y, INK, parts.join(""));
}

function frameSheet(): string {
  const { field, edge } = FIELDS.find(({ id }) => id === "cartwheel")!;
  const parts: string[] = [];
  let y = GAP;
  let width = 0;
  for (const variant of CRYSTAL_VARIANTS.filter((v) => look(v.id).frames.length > 1)) {
    const row = look(variant.id);
    const w = row.frame.width * DISPLAY * 2;
    const h = row.frame.height * DISPLAY * 2;
    parts.push(text(GAP, y + 11, edge, `${variant.id}, frames 0 to 23`));
    y += LABEL;
    let x = GAP;
    for (let k = 0; k < row.frames.length; k++) {
      parts.push(rock(variant.id, k, x + w / 2, y + row.pivot[1] * h, 2));
      x += w + GAP;
    }
    width = Math.max(width, x);
    y += h + GAP;
  }
  return svg(width, y, edge, `<rect width="100%" height="100%" fill="${field}"/>${parts.join("")}`);
}

// The model's world-seeded [0, 1) hash (src/model/asteroids.ts `unit`).
function unit(seed: number, id: string, salt: string): number {
  let value = seed >>> 0 || 0x811c9dc5;
  for (const character of `${id}:${salt}`) {
    value = Math.imul(value ^ character.charCodeAt(0), 0x01000193) >>> 0;
  }
  value ^= value >>> 15;
  value = Math.imul(value, 0x2c1b3c6d) >>> 0;
  return ((value ^ (value >>> 12)) >>> 0) / 0x100000000;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A 960 by 540 field of ordinary rocks, small and medium mostly, each drawing its small cluster
// when the selection rule picks it, with sample flight seeds and placement ids.
function fieldSample(galaxy: (typeof FIELDS)[number]): {
  svg: string;
  picked: number;
  total: number;
} {
  const [W, H] = [960, 540];
  const { salt, share, except, sizes } = staged.crystals.selection.ordinary;
  const seed = 0x5eed0000 + galaxy.id.length;
  const rnd = mulberry(0x0ae5 + galaxy.id.length);
  const pool = SHAPES.flatMap((shape) =>
    Array.from({ length: { small: 6, medium: 4, large: 1, huge: 0 }[shape.size] }, () => shape.id),
  );
  const placed: { id: string; k: number; x: number; y: number; r: number }[] = [];
  const clear = (x: number, y: number, r: number) =>
    placed.every((p) => Math.hypot(p.x - x, (p.y - y) * 2) > p.r + r + 16);
  let picked = 0;
  for (let n = 0; placed.length < 32 && n < 4000; n++) {
    const plain = pool[Math.floor(rnd() * pool.length)]!;
    const row = look(plain);
    const r = (row.frame.width * DISPLAY) / 2;
    const x = 30 + rnd() * (W - 60);
    const y = 30 + rnd() * (H - 60);
    if (!clear(x, y, r * 0.8)) continue;
    const placementId = `rock:${n % 7},${Math.floor(n / 7)}:${placed.length}`;
    const small =
      !except.includes(galaxy.id) &&
      sizes.includes(row.size) &&
      unit(seed, placementId, salt) < share;
    picked += small ? 1 : 0;
    const id = small ? staged.crystals.variants[plain]!.small! : plain;
    placed.push({ id, k: Math.floor(rnd() * row.frames.length), x, y, r: r * 0.8 });
  }
  const drawn = placed.toSorted((a, b) => a.y - b.y).map((p) => rock(p.id, p.k, p.x, p.y, 1));
  const caption = `${galaxy.id}: ${picked} of ${placed.length} ordinary rocks carry the small cluster (medium and larger only)${except.includes(galaxy.id) ? " (none outside ore fields here)" : ""}`;
  return {
    svg: svg(
      W,
      H,
      galaxy.edge,
      `<rect width="100%" height="100%" fill="${galaxy.field}"/>${drawn.join("")}${text(8, H - 8, galaxy.edge, caption)}`,
    ),
    picked,
    total: placed.length,
  };
}

// Cartwheel ore fields at game scale, every rock in its full cluster: each family's 8 rock
// layout, unturned, about its centre. A field keeps ordinary rocks 600 world units from its
// centre, wider than the view, so the view at a field shows only its rocks.
// Medium rocks plain, with the fitted crystals and with the flush veins, every spin frame, at 1x
// and 2x on one field.
function veinSheet(galaxy: (typeof FIELDS)[number]): string {
  const parts: string[] = [];
  let y = GAP;
  let width = 0;
  for (const scale of [1, 2]) {
    for (const shape of SHAPES.filter(({ size }) => size === "medium")) {
      for (const [id, label] of [
        [shape.id, "plain"],
        [crystalId(shape.id, "small"), "fitted crystals, small"],
        [crystalId(shape.id, "full"), "fitted crystals, full"],
        [`${crystalId(shape.id, "small")}-vein`, "vein, small"],
        [`${crystalId(shape.id, "full")}-vein`, "vein, full"],
      ] as const) {
        const row = look(id);
        const w = row.frame.width * DISPLAY * scale;
        const h = row.frame.height * DISPLAY * scale;
        parts.push(
          text(GAP, y + 11, galaxy.edge, `${shape.id} ${label}, ${scale}x, frames 0 to 23`),
        );
        y += LABEL;
        let x = GAP;
        for (let k = 0; k < row.frames.length; k++) {
          parts.push(rock(id, k, x + w / 2, y + row.pivot[1] * h, scale));
          x += w + GAP / 2;
        }
        width = Math.max(width, x);
        y += h + GAP;
      }
      y += GAP;
    }
  }
  return svg(
    width,
    y,
    galaxy.edge,
    `<rect width="100%" height="100%" fill="${galaxy.field}"/>${parts.join("")}`,
  );
}

function oreFieldSample(vein = false): string {
  const { field, edge } = FIELDS.find(({ id }) => id === "cartwheel")!;
  const [W, H] = [1400, 760];
  const parts: string[] = [];
  const families = oreField.variants.slice(0, 2);
  families.forEach((family, f) => {
    const [cx, cy] = [W / 2, H / 2 + f * H];
    const layout = family.layouts.find(({ count }) => count === 8)!;
    const rocks = layout.rocks
      .map(({ id, position: [wx, wy], frame }) => ({
        id: id.replace(
          /^resource-(\w+)$/u,
          vein && id.startsWith("resource-m")
            ? "asteroid-$1-crystals-full-vein"
            : "asteroid-$1-crystals-full",
        ),
        k: frame,
        x: cx + (wx - wy),
        y: cy + (wx + wy) / 2,
      }))
      .toSorted((a, b) => a.y - b.y);
    parts.push(
      ...rocks.map((r) => rock(r.id, r.k, r.x, r.y, 1)),
      text(
        8,
        f * H + H - 8,
        edge,
        `cartwheel ore field, ${family.id}, 8 rocks, full${vein ? ": medium veins, large crystals" : " clusters"}`,
      ),
    );
  });
  return svg(
    W,
    H * families.length,
    edge,
    `<rect width="100%" height="100%" fill="${field}"/>${parts.join("")}`,
  );
}

// The share of 100000 object ids the rule picks.
function measuredShare(): number {
  const { salt, share } = staged.crystals.selection.ordinary;
  let picked = 0;
  for (let i = 0; i < 100000; i++) {
    picked += unit(0x5eed0000 + (i % 10), `rock:${i % 97},${i % 89}:${i}`, salt) < share ? 1 : 0;
  }
  return picked / 100000;
}

// One shipped frame alone at 4 px per frame px, as alpha.
async function alpha(row: Row, k: number): Promise<Uint8Array> {
  const { width, height } = row.frame;
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 4}" height="${height * 4}" viewBox="0 0 ${width} ${height}">${body(row.id, k)}</svg>`;
  const { data } = await sharp(Buffer.from(source))
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

// Each variant's fitted crystal sizes, and per frame the pixels it draws (alpha 128 or more)
// where its plain rock draws none.
async function fits() {
  crystalVariants(catalog.asteroids as never);
  const out: Record<string, { sizes: number[]; outside: number[] }> = {};
  for (const row of staged.crystals.rocks) {
    const plain = look(CRYSTAL_VARIANTS.find(({ id }) => id === row.id)!.shape);
    const outside: number[] = [];
    for (let k = 0; k < row.frames.length; k++) {
      const [mine, base] = [await alpha(row, k), await alpha(plain, k)];
      outside.push(mine.reduce((n, a, i) => n + (a >= 128 && base[i]! < 128 ? 1 : 0), 0));
    }
    out[row.id] = { sizes: CRYSTAL_FITS.get(row.id)!, outside };
  }
  return out;
}

const dir = process.argv[2];
if (!dir) throw new Error("Usage: node art/tools/asteroid-crystal-contact-sheet.ts <dir>");
mkdirSync(dir, { recursive: true });
for (const { id, field, edge } of FIELDS) {
  for (const scale of [1, 2]) {
    writeFileSync(`${dir}/crystal-variants-${id}-${scale}x.svg`, variantSheet(field, edge, scale));
  }
  const sample = fieldSample(FIELDS.find((f) => f.id === id)!);
  writeFileSync(`${dir}/crystal-field-${id}.svg`, sample.svg);
  console.log(`${id}: ${sample.picked} of ${sample.total} picked`);
}
writeFileSync(`${dir}/crystal-ore-fields-cartwheel.svg`, oreFieldSample());
console.log(`share over 100000 ids: ${measuredShare()}`);
writeFileSync(`${dir}/crystal-frames.svg`, frameSheet());
writeFileSync(`${dir}/crystal-medium-review.svg`, reviewSheet());
for (const galaxy of FIELDS.filter(({ id }) =>
  ["sunflower", "cartwheel", "phantom"].includes(id),
)) {
  writeFileSync(`${dir}/crystal-vein-review-${galaxy.id}.svg`, veinSheet(galaxy));
}
writeFileSync(`${dir}/crystal-vein-ore-fields-cartwheel.svg`, oreFieldSample(true));
const veins: Record<string, unknown> = {};
for (const id of review.keys()) {
  if (!id.endsWith("-vein")) continue;
  const row = look(id);
  const plain = look(id.replace(/-crystals-\w+-vein$/u, ""));
  const outside: number[] = [];
  for (let k = 0; k < row.frames.length; k++) {
    const [mine, base] = [await alpha(row, k), await alpha(plain, k)];
    outside.push(mine.reduce((n, a, i) => n + (a >= 128 && base[i]! < 128 ? 1 : 0), 0));
  }
  veins[id] = { lifts: VEIN_FITS.get(id), outsideMax: Math.max(...outside) };
  console.log(`${id}: ${JSON.stringify(veins[id])}`);
}
writeFileSync(`${dir}/crystal-vein-fits.json`, `${JSON.stringify(veins, null, 2)}\n`);
const fitted = await fits();
writeFileSync(`${dir}/crystal-fits.json`, `${JSON.stringify(fitted, null, 2)}\n`);
for (const [id, { sizes, outside }] of Object.entries(fitted)) {
  console.log(`${id}: sizes ${sizes.join(", ")}; outside pixels max ${Math.max(...outside)}`);
}
