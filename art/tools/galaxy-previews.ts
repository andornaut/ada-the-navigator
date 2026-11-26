// The galaxy selector's authored preview cards (art/galaxies.md, Preview cards): each galaxy's
// field with two calm plates, its main station fitted to the card and Ada beside it, with the
// greyed locked card. `node art/tools/galaxy-previews.ts` reads the main station sheets of the
// station redesign and writes the cards the selector draws.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { blankImage } from "@andornaut/art-kit/build/rgbaImage";

import { GALAXIES } from "./manifest.ts";
import { grey, rgba, type RgbaImage, writePng } from "./paint.ts";
import { classic, drawn } from "./ship-model.ts";

type GalaxyId = (typeof GALAXIES)[number];
type V2 = readonly [number, number];
// One fill: its colour and closed loops, filled by the nonzero rule.
type Shape = { color: string; loops: V2[][] };

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const fields = JSON.parse(readFileSync(`${art}galaxies.json`, "utf8")) as {
  galaxies: Record<string, { colors: { background: string } }>;
  lightField: { ink: string };
  preview: { width: number; height: number; locked: { offset: number; scale: number } };
};

const { width: WIDTH, height: HEIGHT } = fields.preview;
// Samples per card px on each axis.
const SS = 4;
const INK = fields.lightField.ink;
// The plates: the field 10% toward white and 7% toward ink.
const PLATES = { lighter: 0.1, darker: 0.07 } as const;
// The station: its box, its centre and the most of its game size it may draw at.
const STATION = { box: [108, 70], at: [64, 45], scale: 0.65 } as const;
// Ada at heading 56, 21 px wide.
const ADA = { box: [21, 21], at: [148, 60], scale: 1, heading: 56 } as const;
// The edge round the station and Ada, in card px.
const EDGE = 0.5;

// Each galaxy's main station: its sheet and the frame it shows.
const MAIN: Readonly<Record<GalaxyId, { sheet: string; id: string }>> = {
  sunflower: { sheet: "station-bloom-sheet.svg", id: "station-a" },
  cartwheel: { sheet: "cartwheel/wheel-hub-sheet.svg", id: "outpost-hub-repaired-a" },
  whirlpool: { sheet: "whirlpool/ramp-station-sheet.svg", id: "whirlpool-station-0" },
  andromeda: { sheet: "andromeda/saucer-station-sheet.svg", id: "station-settlers-a" },
  needle: { sheet: "needle/eye-station-sheet.svg", id: "needle-station-a" },
  phantom: { sheet: "phantom/triarm-station-sheet.svg", id: "phantom-station-0" },
};

// A sheet frame's fills in display px.
function stationShapes({ id, sheet }: { sheet: string; id: string }): Shape[] {
  const path = `${art}${sheet}`;
  if (!existsSync(path)) {
    throw new Error(`/art/${sheet} is missing: produce the main stations before the cards`);
  }
  const frame = new RegExp(
    `<svg id="${id}" x="[^"]+" y="[^"]+" xmlns="[^"]+" width="([\\d.]+)" height="[\\d.]+" viewBox="0 0 ([\\d.]+) [\\d.]+">(.*?)</svg>`,
    "su",
  ).exec(readFileSync(path, "utf8"));
  if (!frame) throw new Error(`${sheet} has no frame ${id}`);
  const scale = Number(frame[1]) / Number(frame[2]);
  const body = frame[3]!.replace(/<title>.*?<\/title>/u, "");
  const shapes = [...body.matchAll(/<path fill="(#[0-9a-fA-F]{6})" d="([^"]+)"\/>/gu)].map(
    ([, color, d]): Shape => ({
      color: color!,
      loops: d!
        .split("M")
        .filter((loop) => loop.length > 0)
        .map((loop) =>
          loop
            .replace(/Z$/u, "")
            .split("L")
            .map((point): V2 => {
              const [x, y] = point.split(",").map(Number) as [number, number];
              return [x * scale, y * scale];
            }),
        ),
    }),
  );
  if (body.replace(/<path fill="#[0-9a-fA-F]{6}" d="[^"]+"\/>/gu, "") !== "") {
    throw new Error(`${sheet} frame ${id} holds more than filled paths`);
  }
  return shapes;
}

// Ada's idle frame at the card's heading, in display px, far fills first.
const adaShapes = (): Shape[] =>
  drawn(48, classic.paint, { yaw: ADA.heading }).map(({ color, outline }) => ({
    color,
    loops: [outline.map(([x, y]): V2 => [(x * 42) / 96, (y * 42) / 96])],
  }));

const mix = (from: string, to: string, t: number) => {
  const [a, b] = [rgba(from), rgba(to)];
  return [0, 1, 2].map((c) => Math.round(a[c]! + (b[c]! - a[c]!) * t));
};

// A canvas of SS by SS samples per card px.
function canvas(background: readonly number[]) {
  const [w, h] = [WIDTH * SS, HEIGHT * SS];
  const data = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) data.set(background, i * 3);
  // The samples a shape covers, loops in card px.
  const cover = (loops: readonly (readonly V2[])[]): Uint8Array => {
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const sy = (y + 0.5) / SS;
      const cuts: { x: number; step: number }[] = [];
      for (const loop of loops) {
        for (const [i, a] of loop.entries()) {
          const b = loop[(i + 1) % loop.length]!;
          if (a[1] <= sy !== b[1] <= sy) {
            cuts.push({
              x: a[0] + ((sy - a[1]) * (b[0] - a[0])) / (b[1] - a[1]),
              step: b[1] > a[1] ? 1 : -1,
            });
          }
        }
      }
      cuts.sort((p, q) => p.x - q.x);
      let winding = 0;
      for (const [i, cut] of cuts.slice(0, -1).entries()) {
        winding += cut.step;
        if (winding === 0) continue;
        const from = Math.max(0, Math.ceil(cut.x * SS - 0.5));
        const to = Math.min(w - 1, Math.ceil(cuts[i + 1]!.x * SS - 0.5) - 1);
        for (let x = from; x <= to; x++) mask[y * w + x] = 1;
      }
    }
    return mask;
  };
  const paint = (mask: Uint8Array, colour: readonly number[]) => {
    for (let i = 0; i < w * h; i++) if (mask[i]) data.set(colour, i * 3);
  };
  // The mask grown by `reach` samples in every direction.
  const grown = (mask: Uint8Array, reach: number): Uint8Array => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            const [px, py] = [x + dx, y + dy];
            if (px >= 0 && py >= 0 && px < w && py < h && dx * dx + dy * dy <= reach * reach) {
              out[py * w + px] = 1;
            }
          }
        }
      }
    }
    return out;
  };
  // The canvas reduced to the card by a box filter.
  const image = (): RgbaImage => {
    const out = blankImage(WIDTH, HEIGHT);
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let sy = 0; sy < SS; sy++) {
            for (let sx = 0; sx < SS; sx++) {
              sum += data[((y * SS + sy) * w + x * SS + sx) * 3 + c]!;
            }
          }
          out.data[(y * WIDTH + x) * 4 + c] = Math.round(sum / (SS * SS));
        }
        out.data[(y * WIDTH + x) * 4 + 3] = 255;
      }
    }
    return out;
  };
  return { cover, paint, grown, image };
}

// The shapes fitted to `box`, at no more than `scale` of their size, centred on `at`.
function fitted(
  shapes: readonly Shape[],
  { at, box, scale }: { box: V2; at: V2; scale: number },
): Shape[] {
  const points = shapes.flatMap(({ loops }) => loops.flat());
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min(box[0] / (x1 - x0), box[1] / (y1 - y0), scale);
  return shapes.map(({ color, loops }) => ({
    color,
    loops: loops.map((loop) =>
      loop.map(([x, y]): V2 => [at[0] + (x - (x0 + x1) / 2) * k, at[1] + (y - (y0 + y1) / 2) * k]),
    ),
  }));
}

function card(galaxy: GalaxyId): RgbaImage {
  const field = fields.galaxies[galaxy]!;
  const background = field.colors.background;
  const edge = rgba(INK).slice(0, 3);
  const c = canvas(rgba(background).slice(0, 3));
  c.paint(
    c.cover([
      [
        [0, HEIGHT * 0.95],
        [WIDTH * 0.55, HEIGHT * 0.33],
        [WIDTH, HEIGHT * 0.58],
        [WIDTH, HEIGHT],
        [0, HEIGHT],
      ],
    ]),
    mix(background, "#ffffff", PLATES.lighter),
  );
  c.paint(
    c.cover([
      [
        [WIDTH * 0.42, 0],
        [WIDTH, 0],
        [WIDTH, HEIGHT * 0.3],
      ],
    ]),
    mix(background, INK, PLATES.darker),
  );
  for (const shapes of [fitted(stationShapes(MAIN[galaxy]), STATION), fitted(adaShapes(), ADA)]) {
    const masks = shapes.map(({ loops }) => c.cover(loops));
    const whole = new Uint8Array(masks[0]!.length);
    for (const mask of masks) for (let i = 0; i < mask.length; i++) if (mask[i]) whole[i] = 1;
    c.paint(c.grown(whole, EDGE * SS), edge);
    for (const [i, mask] of masks.entries()) c.paint(mask, rgba(shapes[i]!.color).slice(0, 3));
  }
  return c.image();
}

// The locked rule: each pixel offset + scale * Y, Y the ITU-R 601 luma, truncated.
function locked(image: RgbaImage): RgbaImage {
  const out = grey(image);
  const { offset, scale } = fields.preview.locked;
  for (let i = 0; i < out.width * out.height; i++) {
    const v = Math.trunc(offset + scale * out.data[i * 4]!);
    out.data.set([v, v, v, 255], i * 4);
  }
  return out;
}

const directory = `${art}previews/`;
mkdirSync(directory, { recursive: true });
for (const galaxy of GALAXIES) {
  const image = card(galaxy);
  writePng(`${directory}card-${galaxy}.png`, image, true);
  writePng(`${directory}card-${galaxy}-locked.png`, locked(image), true);
}
