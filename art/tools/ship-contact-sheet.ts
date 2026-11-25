// Review sheets for Ada's ship, drawn from the shipped data files: ship-materials.json,
// ship-paint.json, ship-jets.json and ship-retro-jets.json. Usage:
//   node art/tools/ship-contact-sheet.ts <output directory> [earlier materials] [earlier paint]
// The optional earlier ship-materials.json and ship-paint.json add a before-and-after sheet.
import { mkdirSync, readFileSync } from "node:fs";

import { filled, type RgbaImage, writePng } from "./paint.ts";
import { JET_PROFILE, LIGHT_FIELD_JET_LEVELS, jetLayers } from "./ship-jet-layers.ts";
import {
  jetLength,
  plumeColor,
  type PlumeLayer,
  type PlumeMouth,
  plumePolygon,
} from "./ship-plume.ts";

type Xy = readonly [number, number];
type Fill = { color: string; loops: Xy[][] };
type Draw = { path: number; slot: string };
type Mouth = PlumeMouth & { occluders?: Xy[][] };
type Jets = {
  engineLevels: { level: number; layers: PlumeLayer[] }[];
  headings: { index: number; mouths: Mouth[] }[];
  length: { base: number; exponent: number; scale: number };
  profile?: readonly (readonly [number, number])[];
};

const art = new URL("../../public/art/", import.meta.url);
const read = (path: string | URL) => JSON.parse(readFileSync(path, "utf8"));
const [out = ".check-results/ada-ship-production", earlierMaterials, earlierPaint] =
  process.argv.slice(2);
const materials = read(new URL("ship-materials.json", art));
const paints = read(new URL("ship-paint.json", art)).schemes as Record<string, string>[];
const forward = read(new URL("ship-jets.json", art)) as Jets;
const reverse = read(new URL("ship-retro-jets.json", art)) as Jets;

const FIELDS = {
  sunflower: { field: "#d8c994", keyline: "#181425", light: true },
  phantom: { field: "#514955", keyline: "#ffffff", light: false },
} as const;
type Field = (typeof FIELDS)[keyof typeof FIELDS];
const FRAME = 96;
const DISPLAY = 42 / FRAME;
const SS = 8;
const KEYLINE = 0.5;

const loops = (path: string): Xy[][] =>
  path
    .split("Z")
    .filter(Boolean)
    .map((loop) =>
      loop
        .replace(/^M/, "")
        .split("L")
        .map((p) => p.split(",").map(Number) as unknown as Xy),
    );
const hull = (source: { paths: string[] }, draws: Draw[], paint: Record<string, string>): Fill[] =>
  draws.map(({ path, slot }) => ({ color: paint[slot]!, loops: loops(source.paths[path]!) }));
const frame = (index: number, paint: Record<string, string>) =>
  hull(materials, materials.ship.headings[index].draws, paint);

const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

// A square sprite cell of `size` output px showing frame px scaled by `scale`, the pivot at
// its centre, supersampled. Subsamples hold an opaque colour index or none.
class Cell {
  readonly colors: string[] = [];
  readonly samples: Int16Array;
  readonly side: number;
  readonly scale: number;
  readonly size: number;

  constructor(size: number, scale: number) {
    this.size = size;
    this.scale = scale;
    this.side = size * SS;
    this.samples = new Int16Array(this.side * this.side).fill(-1);
  }

  // Nonzero fill of the loops, in frame px, into `target` subsamples.
  mask(loopSet: readonly Xy[][]): Uint8Array {
    const { side } = this;
    const k = this.scale * SS;
    const shift = side / 2 - (FRAME / 2) * k;
    const mask = new Uint8Array(side * side);
    const points = loopSet.map((loop) => loop.map(([x, y]) => [x * k + shift, y * k + shift]));
    for (let row = 0; row < side; row++) {
      const y = row + 0.5;
      const cuts: [number, number][] = [];
      for (const loop of points) {
        for (let i = 0; i < loop.length; i++) {
          const a = loop[i]!;
          const b = loop[(i + 1) % loop.length]!;
          if (a[1]! <= y !== b[1]! <= y) {
            cuts.push([
              a[0]! + ((y - a[1]!) * (b[0]! - a[0]!)) / (b[1]! - a[1]!),
              b[1]! > a[1]! ? 1 : -1,
            ]);
          }
        }
      }
      cuts.sort((p, q) => p[0] - q[0]);
      let winding = 0;
      let last = 0;
      for (const [x, stepped] of cuts) {
        if (winding) {
          const from = Math.max(0, Math.ceil(last - 0.5));
          const to = Math.min(side, Math.ceil(x - 0.5));
          for (let column = from; column < to; column++) mask[row * side + column] = 1;
        }
        winding += stepped;
        last = x;
      }
    }
    return mask;
  }

  paint(color: string, mask: Uint8Array, only?: Uint8Array): void {
    let index = this.colors.indexOf(color);
    if (index < 0) index = this.colors.push(color) - 1;
    for (let i = 0; i < mask.length; i++)
      if (mask[i] && (!only || only[i])) this.samples[i] = index;
  }

  fills(fills: readonly Fill[], only?: Uint8Array): void {
    for (const { color, loops: loopSet } of fills) this.paint(color, this.mask(loopSet), only);
  }

  // Every subsample within `radius` output px of a set subsample.
  grown(mask: Uint8Array, radius: number): Uint8Array {
    const { side } = this;
    const reach = Math.round(radius * SS);
    const result = new Uint8Array(mask.length);
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        if (!mask[y * side + x]) continue;
        for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            if (dx * dx + dy * dy > reach * reach) continue;
            const [px, py] = [x + dx, y + dy];
            if (px >= 0 && py >= 0 && px < side && py < side) result[py * side + px] = 1;
          }
        }
      }
    }
    return result;
  }

  // Box reduction over the field colour, drawn into the sheet with whole-pixel enlargement.
  draw(sheet: RgbaImage, x0: number, y0: number, field: string, zoom = 1): void {
    const palette = this.colors.map(rgb);
    const ground = rgb(field);
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const sum = [0, 0, 0];
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const index = this.samples[(y * SS + sy) * this.side + x * SS + sx]!;
            const c = index < 0 ? ground : palette[index]!;
            for (let i = 0; i < 3; i++) sum[i]! += c[i]!;
          }
        }
        const pixel = [...sum.map((v) => Math.round(v / SS / SS)), 255];
        for (let zy = 0; zy < zoom; zy++) {
          for (let zx = 0; zx < zoom; zx++) {
            sheet.data.set(pixel, ((y0 + y * zoom + zy) * sheet.width + x0 + x * zoom + zx) * 4);
          }
        }
      }
    }
  }
}

type Exhaust = { direction: "forward" | "reverse"; f: number; level: number };

function plumes(jets: Jets, index: number, { f, level }: Exhaust, light: boolean): Fill[] {
  const layers = light
    ? jetLayers(LIGHT_FIELD_JET_LEVELS[level - 1]!).map((layer, i) => ({
        ...jets.engineLevels[level - 1]!.layers[i]!,
        colors: layer.colors,
      }))
    : jets.engineLevels[level - 1]!.layers;
  const length = jetLength(jets.length, f);
  return jets.headings[index]!.mouths.flatMap((mouth) =>
    layers.map((layer) => ({
      color: plumeColor(layer.colors, f),
      loops: [plumePolygon(jets.profile ?? JET_PROFILE, mouth, layer, length) as Xy[]],
    })),
  );
}

// One sprite as the game composes it: reverse plumes under the hull, forward plumes over it
// with the nearer hull restored, and the keyline round the hull only.
function sprite(
  size: number,
  scale: number,
  field: Field,
  index: number,
  body: Fill[],
  exhaust?: Exhaust,
): Cell {
  const cell = new Cell(size, scale);
  const silhouette = cell.mask(body.flatMap((fill) => fill.loops.map((loop) => [loop])).flat());
  const union = new Uint8Array(silhouette.length);
  for (const fill of body) {
    const mask = cell.mask(fill.loops);
    for (let i = 0; i < mask.length; i++) if (mask[i]) union[i] = 1;
  }
  if (exhaust?.direction === "reverse") cell.fills(plumes(reverse, index, exhaust, field.light));
  cell.paint(field.keyline, cell.grown(union, KEYLINE));
  cell.fills(body);
  if (exhaust?.direction === "forward") {
    cell.fills(plumes(forward, index, exhaust, field.light));
    const nearer = cell.mask(
      forward.headings[index]!.mouths.flatMap((mouth) => mouth.occluders ?? []),
    );
    cell.fills(body, nearer);
  }
  return cell;
}

function sheet(name: string, width: number, height: number, draw: (image: RgbaImage) => void) {
  const image = filled([243, 243, 241, 255], width, height);
  draw(image);
  writePng(`${out}/${name}.png`, image, true);
}
function band(image: RgbaImage, y: number, height: number, color: string): void {
  const pixel = [...rgb(color), 255];
  for (let row = y; row < y + height; row++) {
    for (let x = 0; x < image.width; x++) image.data.set(pixel, (row * image.width + x) * 4);
  }
}

mkdirSync(out, { recursive: true });
const classic = paints[0]!;
const ALL = Array.from({ length: 64 }, (_, index) => index);
const EIGHT = [0, 8, 16, 24, 32, 40, 48, 56];
const FULL: Exhaust = { direction: "forward", f: 1, level: 1 };

// All 64 headings, idle and full thrust: at game scale, at twice game scale and with the game
// scale pixels enlarged four times.
for (const [fieldName, field] of Object.entries(FIELDS)) {
  for (const [label, scale, cellSize, zoom] of [
    ["1x", DISPLAY, 64, 1],
    ["2x", DISPLAY * 2, 128, 1],
    ["pixels-4x", DISPLAY, 64, 4],
  ] as const) {
    const step = cellSize * zoom;
    sheet(`headings-64-${fieldName}-${label}`, step * 16, step * 8, (image) => {
      band(image, 0, step * 8, field.field);
      for (const [row, exhaust] of [undefined, FULL].entries()) {
        for (const index of ALL) {
          sprite(cellSize, scale, field, index, frame(index, classic), exhaust).draw(
            image,
            (index % 16) * step,
            (row * 4 + Math.floor(index / 16)) * step,
            field.field,
            zoom,
          );
        }
      }
    });
  }
}

// The six paints at eight headings: game scale, twice game scale and enlarged pixels.
for (const [fieldName, field] of Object.entries(FIELDS)) {
  sheet(`paints-${fieldName}`, 8 * (64 + 128 + 256), paints.length * 256, (image) => {
    band(image, 0, image.height, field.field);
    for (const [row, paint] of paints.entries()) {
      for (const [column, index] of EIGHT.entries()) {
        const body = frame(index, paint);
        sprite(64, DISPLAY, field, index, body).draw(
          image,
          column * 64,
          row * 256 + 96,
          field.field,
        );
        sprite(128, DISPLAY * 2, field, index, body).draw(
          image,
          512 + column * 128,
          row * 256 + 64,
          field.field,
        );
        sprite(64, DISPLAY, field, index, body).draw(
          image,
          1536 + column * 256,
          row * 256,
          field.field,
          4,
        );
      }
    }
  });
}

// Jets: Engine levels 1 to 3 at half and full thrust and full retro, four headings.
const JET_HEADINGS = [8, 0, 24, 40];
const MODES: Exhaust[] = [1, 2, 3].flatMap((level) => [
  { direction: "forward", f: 0.5, level },
  { direction: "forward", f: 1, level },
  { direction: "reverse", f: 1, level },
]);
for (const [fieldName, field] of Object.entries(FIELDS)) {
  sheet(`jets-${fieldName}`, 4 * (64 + 128 + 256), MODES.length * 256, (image) => {
    band(image, 0, image.height, field.field);
    for (const [row, exhaust] of MODES.entries()) {
      for (const [column, index] of JET_HEADINGS.entries()) {
        const body = frame(index, classic);
        sprite(64, DISPLAY, field, index, body, exhaust).draw(
          image,
          column * 64,
          row * 256 + 96,
          field.field,
        );
        sprite(128, DISPLAY * 2, field, index, body, exhaust).draw(
          image,
          256 + column * 128,
          row * 256 + 64,
          field.field,
        );
        sprite(64, DISPLAY, field, index, body, exhaust).draw(
          image,
          768 + column * 256,
          row * 256,
          field.field,
          4,
        );
      }
    }
  });
}

// The canopy alone across all 64 headings, at four times game scale on both fields.
sheet("canopy-strip", 16 * 80, 8 * 80, (image) => {
  for (const [half, field] of Object.values(FIELDS).entries()) {
    for (const index of ALL) {
      const body = frame(index, classic);
      const cell = sprite(192, DISPLAY * 4, field, index, body);
      // Crop 80 px about the canopy's centre.
      const glass = body.filter(({ color }) =>
        [classic.canopyHighlight, classic.canopyRoof, classic.canopyShade].includes(color),
      );
      const points = glass.flatMap((fill) => fill.loops.flat());
      const centre = [0, 1].map((axis) => {
        const values = points.map((p) => p[axis]!);
        return ((Math.min(...values) + Math.max(...values)) / 2 - FRAME / 2) * DISPLAY * 4 + 96;
      });
      const whole = filled([0, 0, 0, 255], 192, 192);
      cell.draw(whole, 0, 0, field.field);
      const [left, top] = centre.map((c) => Math.max(0, Math.min(112, Math.round(c!) - 40)));
      for (let y = 0; y < 78; y++) {
        for (let x = 0; x < 78; x++) {
          const from = ((top! + y) * 192 + left! + x) * 4;
          image.data.set(
            whole.data.subarray(from, from + 4),
            ((half * 320 + Math.floor(index / 16) * 80 + y + 1) * image.width +
              (index % 16) * 80 +
              x +
              1) *
              4,
          );
        }
      }
    }
  }
});

// Before and after at eight headings: game scale and four times game scale, both fields.
if (earlierMaterials && earlierPaint) {
  const before = read(earlierMaterials);
  const beforePaint = read(earlierPaint).schemes[0] as Record<string, string>;
  const earlier = (index: number) =>
    hull(before, before.ship.headings[index].profiles.distinct, beforePaint);
  sheet("shipped-versus-new", 8 * 192, 2 * (2 * 64 + 2 * 192), (image) => {
    for (const [half, field] of Object.values(FIELDS).entries()) {
      const top = half * (2 * 64 + 2 * 192);
      band(image, top, 2 * 64 + 2 * 192, field.field);
      for (const [column, index] of EIGHT.entries()) {
        for (const [row, body] of [earlier(index), frame(index, classic)].entries()) {
          sprite(64, DISPLAY, field, index, body).draw(
            image,
            column * 192 + 64,
            top + row * 64,
            field.field,
          );
          sprite(192, DISPLAY * 4, field, index, body).draw(
            image,
            column * 192,
            top + 128 + row * 192,
            field.field,
          );
        }
      }
    }
  });
}
