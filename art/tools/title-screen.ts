// The start screen's art: the "Ada the Navigator" wordmark in Chibi's 5x7 block lettering
// (chibis-way-home art/tools/logo.ts) and the neutral space field behind the ship.
//
// Writes public/art/ui/title-wordmark.svg, public/art/title-field.png and
// public/art/title-screen.json, with the core manifest's `title-` entries and `titleScreen` link.
// Rebuild with `node art/tools/title-screen.ts`; reruns are byte-identical.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { filled, rgba, type RgbaImage, writePng } from "./paint.ts";
import { INK, IN_BETWEEN, SPACE_BG } from "./palette.ts";
import { linkData, replaceEntries } from "./manifest.ts";
import { json } from "./projection.ts";
import { Random } from "./random.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

// Chibi's GLYPHS for the letters the title uses, plus d, g, r, t, v and N drawn to the same
// rules. g is nine rows: its tail drops two rows below the baseline, so it never reads as a.
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  d: ["....#", "....#", ".##.#", "#..##", "#...#", "#...#", ".####"],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".####"],
  g: [".....", ".....", ".####", "#...#", "#...#", "#...#", ".####", "....#", ".###."],
  h: ["#....", "#....", "#.##.", "##..#", "#...#", "#...#", "#...#"],
  i: ["..#..", ".....", ".##..", "..#..", "..#..", "..#..", ".###."],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  t: [".#...", ".#...", "####.", ".#...", ".#...", ".#..#", "..##."],
  v: [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
};

// Two lines as Chibi's stacked title, each glyph cell `b` px; an `outline` px ink edge round the
// lettering; `gap` px between the line boxes. Line 1 sits `indent` px in, so the lockup's width
// is even and it centres on whole pixels.
const WORDMARK = {
  lines: [
    { text: "Ada the", b: 6, indent: 10 },
    { text: "Navigator", b: 5, indent: 0 },
  ],
  outline: 2,
  gap: 7,
  width: 270,
} as const;
// The hull's front-side face and its white top, as the lettering's face and its top-left rim.
const FILL = "d4dfe9";
const RIM = "ffffff";

type Cell = 0 | 1 | 2 | 3; // clear, ink, fill, rim

/** One line: Chibi's word() with a square-dilated ink outline `outline` px wide. */
function line(
  text: string,
  b: number,
  outline: number,
): { cells: Cell[]; width: number; height: number } {
  const rows = Math.max(...[...text].map((ch) => GLYPHS[ch]?.length ?? 7));
  const cw = 6 * b;
  const width = text.length * cw - b + 2 * outline;
  const height = rows * b + 2 * outline;
  const mask = new Uint8Array(width * height);
  [...text].forEach((ch, i) => {
    if (ch === " ") {
      return;
    }
    const glyph = GLYPHS[ch];
    if (!glyph) {
      throw new Error(`no glyph for ${ch}`);
    }
    glyph.forEach((row, gy) => {
      [...row].forEach((c, gx) => {
        if (c !== "#") {
          return;
        }
        for (let y = 0; y < b; y++) {
          for (let x = 0; x < b; x++) {
            mask[(outline + gy * b + y) * width + outline + i * cw + gx * b + x] = 1;
          }
        }
      });
    });
  });
  const cells: Cell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        cells.push(!mask[y * width + x - 1] || !mask[(y - 1) * width + x] ? 3 : 2);
        continue;
      }
      let ink = false;
      for (let dy = -outline; dy <= outline && !ink; dy++) {
        for (let dx = -outline; dx <= outline && !ink; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          ink = yy >= 0 && yy < height && xx >= 0 && xx < width && mask[yy * width + xx] === 1;
        }
      }
      cells.push(ink ? 1 : 0);
    }
  }
  return { cells, width, height };
}

/** The lockup as an SVG of one path per colour, each row's runs as unit-high rectangles. */
function wordmark(): { svg: string; width: number; height: number } {
  const lines = WORDMARK.lines.map((l) => ({ ...l, ...line(l.text, l.b, WORDMARK.outline) }));
  const width = WORDMARK.width;
  const height = lines.reduce((sum, l) => sum + l.height, 0) + WORDMARK.gap;
  const grid = new Uint8Array(width * height);
  let top = 0;
  for (const l of lines) {
    if (l.indent + l.width > width) {
      throw new Error(`${l.text} is wider than the lockup`);
    }
    for (let y = 0; y < l.height; y++) {
      for (let x = 0; x < l.width; x++) {
        grid[(top + y) * width + l.indent + x] = l.cells[y * l.width + x]!;
      }
    }
    top += l.height + WORDMARK.gap;
  }
  const colours: Record<number, string> = { 1: INK, 2: FILL, 3: RIM };
  const paths = [1, 2, 3].map((cell) => {
    let d = "";
    for (let y = 0; y < height; y++) {
      let x = 0;
      while (x < width) {
        if (grid[y * width + x] !== cell) {
          x++;
          continue;
        }
        const start = x;
        while (x < width && grid[y * width + x] === cell) {
          x++;
        }
        d += `M${start} ${y}h${x - start}v1h-${x - start}z`;
      }
    }
    return `  <path fill="#${colours[cell]}" d="${d}"/>`;
  });
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`,
    `  <title>Ada the Navigator</title>`,
    ...paths,
    `</svg>`,
    ``,
  ].join("\n");
  return { svg, width, height };
}

// The field covers play-view logical px x -120 to 840 and y 0 to 540 (960 by 540 at 2 image px
// per logical px), so it fills every logical view up to 960 wide and 540 tall from the play
// view's top-left; the camera's space background fills beyond it.
const FIELD = { x: -120, y: 0, width: 960, height: 540, density: 2 } as const;
const ENVIRONMENT = "34333f";
const ENVIRONMENT_DETAIL = "403f4d";
// Soft masses: centre and radius in play-view px, colour and peak alpha, falling linearly to 0.
const MASSES = [
  { at: [150, 290], r: 240, colour: ENVIRONMENT, alpha: 1 },
  { at: [600, 80], r: 220, colour: ENVIRONMENT_DETAIL, alpha: 0.8 },
  { at: [520, 250], r: 160, colour: IN_BETWEEN[2], alpha: 0.16 },
] as const;
// Sparse stars: one-px dust in two quiet tones, and a few two-px lavender points at 0.7.
const STARS = {
  seed: 7,
  count: 270,
  bright: { share: 0.12, size: 2, colour: "c4afcc", alpha: 0.7 },
  dust: { size: 1, colours: [ENVIRONMENT_DETAIL, "57536e"] },
} as const;
// Rects kept clear of stars, in play-view px: the wordmark and the note, each with a margin.
const STAR_CLEAR = [
  { x: 215, y: 142, width: 290, height: 114 },
  { x: 220, y: 312, width: 280, height: 34 },
] as const;
// An ink shade under the action row and note: alpha 0 at y 290 to 0.45 at 360, held below.
const SHADE = { from: 290, to: 360, alpha: 0.45 } as const;

function mix(image: RgbaImage, i: number, colour: readonly number[], alpha: number): void {
  for (let c = 0; c < 3; c++) {
    const k = i * 4 + c;
    image.data[k] = Math.round(image.data[k]! * (1 - alpha) + colour[c]! * alpha);
  }
}

function field(): RgbaImage {
  const d = FIELD.density;
  const image = filled(rgba(SPACE_BG), FIELD.width * d, FIELD.height * d);
  const ink = rgba(INK);
  for (let py = 0; py < image.height; py++) {
    const y = FIELD.y + (py + 0.5) / d;
    for (let px = 0; px < image.width; px++) {
      const x = FIELD.x + (px + 0.5) / d;
      const i = py * image.width + px;
      for (const mass of MASSES) {
        const t = Math.hypot(x - mass.at[0], y - mass.at[1]) / mass.r;
        if (t < 1) {
          mix(image, i, rgba(mass.colour), mass.alpha * (1 - t));
        }
      }
    }
  }
  const random = new Random(STARS.seed);
  const clear = (x: number, y: number, size: number) =>
    STAR_CLEAR.some(
      (r) => x + size > r.x && x < r.x + r.width && y + size > r.y && y < r.y + r.height,
    );
  for (let n = 0; n < STARS.count; n++) {
    const x = Math.floor(random.uniform(0, FIELD.width));
    const y = Math.floor(random.uniform(0, FIELD.height));
    const bright = random.random() < STARS.bright.share;
    const tone = random.random() < 0.5 ? 0 : 1;
    const size = bright ? STARS.bright.size : STARS.dust.size;
    if (
      clear(FIELD.x + x, FIELD.y + y, size) ||
      x + size > FIELD.width ||
      y + size > FIELD.height
    ) {
      continue;
    }
    const colour = rgba(bright ? STARS.bright.colour : STARS.dust.colours[tone]!);
    const alpha = bright ? STARS.bright.alpha : 1;
    for (let py = y * d; py < (y + size) * d; py++) {
      for (let px = x * d; px < (x + size) * d; px++) {
        mix(image, py * image.width + px, colour, alpha);
      }
    }
  }
  for (let py = 0; py < image.height; py++) {
    const y = FIELD.y + (py + 0.5) / d;
    const t = Math.min(1, Math.max(0, (y - SHADE.from) / (SHADE.to - SHADE.from)));
    if (t > 0) {
      for (let px = 0; px < image.width; px++) {
        mix(image, py * image.width + px, ink, SHADE.alpha * t);
      }
    }
  }
  return image;
}

const mark = wordmark();
writeFileSync(`${art}ui/title-wordmark.svg`, mark.svg);
writePng(`${art}title-field.png`, field(), true);
writeFileSync(
  `${art}title-screen.json`,
  json({
    version: 1,
    background: `#${SPACE_BG}`,
    field: { id: "title-field", at: [FIELD.x, FIELD.y] },
    ship: { frame: 26, jetSpeed: 0.8, animated: false },
    wordmark: { id: "title-wordmark" },
  }),
);
replaceEntries(
  "core",
  (id) => id.startsWith("title-"),
  [
    {
      id: "title-field",
      path: "/art/title-field.png",
      width: FIELD.width * FIELD.density,
      height: FIELD.height * FIELD.density,
      displayWidth: FIELD.width,
      displayHeight: FIELD.height,
      facing: "front",
      pivot: { x: 0, y: 0 },
    },
    {
      id: "title-wordmark",
      path: "/art/ui/title-wordmark.svg",
      width: mark.width,
      height: mark.height,
      displayWidth: mark.width,
      displayHeight: mark.height,
      facing: "front",
      pivot: { x: 0, y: 0 },
    },
  ],
  (id) => id.startsWith("cockpit"),
);
linkData("core", { titleScreen: "/art/title-screen.json" });
