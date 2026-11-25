// Review sheets of the polish set: `node art/tools/polish-contact-sheet.ts <dir>` writes
// `<dir>/glyphs.svg` (the weapon glyphs on the HUD disc and the hostile-station glyph on its
// chip), `<dir>/debris.svg` (every tumble frame on its galaxy's field under the light-field ink
// keyline) and `<dir>/decorations.svg` (every decoration frame on its field), from the produced
// files, at game scale and enlarged.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { readUiIcon } from "./ui-icon-sources.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const INK = "#181425";
const PAPER = "#F4F4F2";
const FIELDS = {
  sunflower: "#D8C994",
  cartwheel: "#BC9D90",
  whirlpool: "#B8CEC4",
  andromeda: "#9298B5",
  needle: "#C6BBA6",
  phantom: "#514955",
} as const;
type Galaxy = keyof typeof FIELDS;
const GAP = 8;
const LABEL = 16;

const text = (x: number, y: number, label: string, fill = INK) =>
  `<text x="${x}" y="${y}" font-family="DejaVu Sans" font-size="11" fill="${fill}">${label}</text>`;

// A sheet's nested roots by id, each without its position.
function roots(path: string): Map<string, { width: number; height: number; svg: string }> {
  const sheet = readFileSync(`${art}${path}`, "utf8");
  const out = new Map<string, { width: number; height: number; svg: string }>();
  for (const [, id, attributes, body] of sheet.matchAll(
    /<svg id="([^"]+)" x="[^"]+" y="[^"]+" ([^>]*)>(.*?)<\/svg>(?=<svg id=|<\/svg>)/gsu,
  )) {
    const view = /viewBox="0 0 ([\d.]+) ([\d.]+)"/u.exec(attributes!)!;
    out.set(id!, {
      width: Number(view[1]),
      height: Number(view[2]),
      svg: body!.replace(/<title>.*?<\/title>/u, ""),
    });
  }
  return out;
}

type Row = { height: number; width: number; ink: string };

function page(rows: readonly { field: string; label: string; light: boolean; row: Row }[]) {
  let y = GAP;
  const parts: string[] = [];
  const width = Math.max(...rows.map(({ row }) => row.width)) + GAP;
  for (const { field, label, light, row } of rows) {
    parts.push(
      `<rect x="0" y="${y}" width="${width}" height="${row.height + LABEL + GAP}" fill="${field}"/>`,
      text(GAP, y + 12, label, light ? INK : "#FFFFFF"),
      `<g transform="translate(0 ${y + LABEL})">${row.ink}</g>`,
    );
    y += row.height + LABEL + 2 * GAP;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}"><rect width="100%" height="100%" fill="${PAPER}"/>${parts.join("")}</svg>\n`;
}

// ------------------------------------------------------------------ glyphs

const WEAPONS = ["laser", "multiLaser", "rapidMissile", "heavyMissile", "scattershot", "phaser"];
const inner = (svg: string) => svg.replace(/^<svg[^>]*>|<\/svg>\s*$/gu, "");

// The 33 px HUD disc with its 20 px glyph: navy face, the selected cream ring or the idle one.
function disc(id: string, x: number, scale: number, selected: boolean): string {
  const glyph = inner(readUiIcon(`weapon-${id}`)).replaceAll(
    "#ead4aa",
    selected ? "#ead4aa" : "#a9a3c2",
  );
  return `<g transform="translate(${x} 0) scale(${scale})"><circle cx="16.5" cy="16.5" r="16.5" fill="${INK}"/><circle cx="16.5" cy="16.5" r="14.5" fill="${selected ? "#ead4aa" : "#5a5670"}"/><circle cx="16.5" cy="16.5" r="12.5" fill="${INK}"/><circle cx="16.5" cy="16.5" r="11.5" fill="#262b44"/><g transform="translate(6.5 6.5)">${glyph}</g></g>`;
}

function glyphRow(scale: number): Row {
  let x = GAP;
  const ink: string[] = [];
  for (const selected of scale > 2 ? [true] : [true, false]) {
    for (const id of WEAPONS) {
      ink.push(disc(id, x, scale, selected));
      x += 33 * scale + GAP;
    }
    x += GAP;
  }
  return { height: 33 * scale, width: x, ink: ink.join("") };
}

// The 24 px hostile-station glyph bare and on its 28 px chip, on the station face and the
// job face.
function chipRow(scales: readonly number[]): Row {
  const glyph = inner(readUiIcon("map-hostile-station"));
  let x = GAP;
  const ink: string[] = [];
  for (const scale of scales) {
    ink.push(`<g transform="translate(${x} ${2 * scale}) scale(${scale})">${glyph}</g>`);
    x += 24 * scale + GAP;
    for (const face of ["#c4afcc", "#feae34"]) {
      ink.push(
        `<g transform="translate(${x} 0) scale(${scale})"><circle cx="14" cy="14" r="14" fill="${INK}"/><circle cx="14" cy="14" r="13" fill="${face}"/><g transform="translate(2 2)">${glyph}</g></g>`,
      );
      x += 28 * scale + GAP;
    }
    x += GAP;
  }
  return { height: 28 * Math.max(...scales), width: x, ink: ink.join("") };
}

function glyphs(): string {
  const rows = [];
  for (const [field, name, light] of [
    [FIELDS.phantom, "Phantom", false],
    [FIELDS.sunflower, "Sunflower", true],
  ] as const) {
    for (const scale of [1, 2, 6]) {
      rows.push({
        field,
        light,
        label: `Weapon glyphs on the HUD disc, ${name}, ${scale}x${scale > 2 ? "" : ": selected, then idle"}`,
        row: glyphRow(scale),
      });
    }
  }
  rows.push({
    field: FIELDS.sunflower,
    light: true,
    label: "map-hostile-station: bare and on the 28 px chip, 1x, 2x and 6x",
    row: chipRow([1, 2, 6]),
  });
  return page(rows);
}

// ------------------------------------------------------------------ debris

const DEBRIS: readonly { galaxy: Galaxy; id: string; sheet: string; contour: boolean }[] = [
  {
    galaxy: "cartwheel",
    id: "cartwheel-debris",
    sheet: "cartwheel/cartwheel-debris-sheet.svg",
    contour: true,
  },
  {
    galaxy: "whirlpool",
    id: "whirlpool-debris-plate",
    sheet: "whirlpool/whirlpool-debris-plate-sheet.svg",
    contour: true,
  },
  {
    galaxy: "whirlpool",
    id: "whirlpool-debris-girder",
    sheet: "whirlpool/whirlpool-debris-girder-sheet.svg",
    contour: true,
  },
  {
    galaxy: "needle",
    id: "needle-debris-plate",
    sheet: "needle/debris-plate-sheet.svg",
    contour: false,
  },
  {
    galaxy: "needle",
    id: "needle-debris-girder",
    sheet: "needle/debris-girder-sheet.svg",
    contour: false,
  },
];
// Frame px to logical display px.
const DISPLAY = 0.4375;
// The coral contour's stroke in frame px: 1.5 display px each side of the silhouette.
const CONTOUR_STROKE = 3 / DISPLAY;

function debris(): string {
  const rows = [];
  for (const { contour, galaxy, id, sheet } of DEBRIS) {
    const frames = roots(sheet);
    for (const scale of [1, 2, 4]) {
      let x = GAP;
      let height = 0;
      const ink: string[] = [];
      for (let k = 0; k < 8; k++) {
        const frame = frames.get(`${id}-${k}`)!;
        const [w, h] = [frame.width * DISPLAY * scale, frame.height * DISPLAY * scale];
        // One display px of ink outside the drawing, at half strength round a coral contour:
        // the frame's first path is its silhouette, with the contour stroke where it has one.
        const silhouette = /<path [^>]*\bd="([^"]+)"\/>/u.exec(frame.svg)![1]!;
        const reach = 2 / DISPLAY + (contour ? CONTOUR_STROKE : 0);
        const keyline = `<path fill="${INK}" stroke="${INK}" stroke-width="${reach}" stroke-linejoin="round" opacity="${contour ? 0.5 : 1}" d="${silhouette}"/>`;
        ink.push(
          `<svg x="${x}" y="0" width="${w}" height="${h}" viewBox="0 0 ${frame.width} ${frame.height}">${keyline}${frame.svg}</svg>`,
        );
        x += w + GAP;
        height = Math.max(height, h);
      }
      rows.push({
        field: FIELDS[galaxy],
        light: true,
        label: `${id}, frames 0 to 7, ${scale}x`,
        row: { height, width: x, ink: ink.join("") },
      });
    }
  }
  return page(rows);
}

// ------------------------------------------------------------------ decorations

function decorations(): string {
  const rows = [];
  for (const galaxy of Object.keys(FIELDS) as Galaxy[]) {
    const staged = `${galaxy}/decoration-set-sheet.svg`;
    const sheet = existsSync(`${art}${staged}`) ? staged : `${galaxy}/decoration-sheet.svg`;
    const frames = [...roots(sheet)];
    for (const scale of [0.3, 0.6]) {
      let x = GAP;
      const ink: string[] = [];
      for (const [, frame] of frames) {
        const [w, h] = [frame.width * scale, frame.height * scale];
        ink.push(
          `<svg x="${x}" y="0" width="${w}" height="${h}" viewBox="0 0 ${frame.width} ${frame.height}">${frame.svg}</svg>`,
        );
        x += w + GAP;
      }
      rows.push({
        field: FIELDS[galaxy],
        light: galaxy !== "phantom",
        label: `${galaxy} decorations 1 to ${frames.length}, ${scale} of the frame`,
        row: { height: 768 * scale, width: x, ink: ink.join("") },
      });
    }
  }
  return page(rows);
}

function main() {
  const [out, ...only] = process.argv.slice(2);
  if (!out) {
    throw new Error(
      "Usage: node art/tools/polish-contact-sheet.ts <dir> [glyphs|debris|decorations]",
    );
  }
  mkdirSync(out, { recursive: true });
  const sheets = { glyphs, debris, decorations };
  for (const [name, build] of Object.entries(sheets)) {
    if (only.length === 0 || only.includes(name)) writeFileSync(`${out}/${name}.svg`, build());
  }
}

main();
