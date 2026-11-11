// Backdrop haze: a per-galaxy, screen-fixed layer of soft field-coloured shapes between the field
// background and the dust specks. Andromeda's is two logarithmic spiral arms round a pale core.
// Usage: node art/tools/haze.ts writes public/art/{galaxy}/haze.png and haze.json, replaces the
// `{galaxy}-haze` entry and links `backdropHaze` in that galaxy's manifest. Contract:
// art/galaxies.md (Backdrop haze).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { blankImage } from "@andornaut/art-kit/rgbaImage";

import { type GALAXIES, linkData, replaceEntries } from "./manifest.ts";
import { rgb } from "./oklab.ts";
import { writePng } from "./paint.ts";
import { json } from "./projection.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const fields = JSON.parse(readFileSync(`${art}galaxies.json`, "utf8")) as {
  galaxies: Record<string, { colors: Record<string, string> }>;
};

// Logical px per texel: the haze is blurred, so half resolution loses nothing.
const SCALE = 2;
// The texture covers the 720 by 360 play view with a margin on every side.
const WIDTH = 960;
const HEIGHT = 480;

type Arm = { colour: string; alpha: number; width: number; phase: number };
type Glow = { colour: string; alpha: number; rx: number; ry: number };
type Haze = {
  galaxy: (typeof GALAXIES)[number];
  // The spiral's centre in texture logical px.
  centre: readonly [number, number];
  // Arm radius r0 * exp(growth * t) for t in [0, turn] radians, squashed vertically by `squash`.
  r0: number;
  growth: number;
  turn: number;
  squash: number;
  // Each arm is drawn once per phase in `phases`, offset by its own `phase`.
  phases: readonly number[];
  arms: readonly Arm[];
  core: readonly Glow[];
  blur: number;
};

const field = (galaxy: string, role: string) => fields.galaxies[galaxy]!.colors[role]!;

const hazes: Haze[] = [
  {
    galaxy: "andromeda",
    // The core sits at (540, 126) of the play view: three quarters across, a third down.
    centre: [660, 186],
    r0: 36,
    growth: 0.42,
    turn: 4.2,
    squash: 0.55,
    phases: [0, Math.PI],
    arms: [
      { colour: field("andromeda", "environment"), alpha: 0.9, width: 92, phase: 0 },
      { colour: field("andromeda", "environmentDetail"), alpha: 0.55, width: 28, phase: 0.25 },
    ],
    core: [
      { colour: "#6E76AE", alpha: 0.55, rx: 92, ry: 52 },
      { colour: "#A3ABE6", alpha: 0.45, rx: 40, ry: 22 },
    ],
    blur: 20,
  },
];

// Texel centres in logical px.
const tw = WIDTH / SCALE;
const th = HEIGHT / SCALE;
const centreOf = (i: number) => [((i % tw) + 0.5) * SCALE, (Math.floor(i / tw) + 0.5) * SCALE];

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const [ex, ey] = [bx - ax, by - ay];
  const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)));
  return Math.hypot(px - ax - t * ex, py - ay - t * ey);
}

// Coverage 0 to 1 of a round-capped polyline of `width`, sampled 4 by 4 per texel.
function strokeMask(points: readonly (readonly [number, number])[], width: number): Float64Array {
  const mask = new Float64Array(tw * th);
  const half = width / 2;
  for (let i = 0; i < mask.length; i++) {
    const [cx, cy] = centreOf(i);
    let hits = 0;
    for (let sy = 0; sy < 4; sy++) {
      for (let sx = 0; sx < 4; sx++) {
        const [x, y] = [cx + ((sx + 0.5) / 4 - 0.5) * SCALE, cy + ((sy + 0.5) / 4 - 0.5) * SCALE];
        for (let k = 1; k < points.length; k++) {
          const [a, b] = [points[k - 1]!, points[k]!];
          if (segmentDistance(x, y, a[0], a[1], b[0], b[1]) <= half) {
            hits++;
            break;
          }
        }
      }
    }
    mask[i] = hits / 16;
  }
  return mask;
}

function ellipseMask([ox, oy]: readonly [number, number], rx: number, ry: number) {
  const mask = new Float64Array(tw * th);
  for (let i = 0; i < mask.length; i++) {
    const [cx, cy] = centreOf(i);
    let hits = 0;
    for (let sy = 0; sy < 4; sy++) {
      for (let sx = 0; sx < 4; sx++) {
        const [x, y] = [cx + ((sx + 0.5) / 4 - 0.5) * SCALE, cy + ((sy + 0.5) / 4 - 0.5) * SCALE];
        if (((x - ox) / rx) ** 2 + ((y - oy) / ry) ** 2 <= 1) hits++;
      }
    }
    mask[i] = hits / 16;
  }
  return mask;
}

// Separable Gaussian blur of one channel, sigma in texels, clamped at the edges to transparent.
function blur(channel: Float64Array, sigma: number): Float64Array {
  const reach = Math.ceil(sigma * 3);
  const kernel = Array.from({ length: 2 * reach + 1 }, (_, k) =>
    Math.exp(-((k - reach) ** 2) / (2 * sigma * sigma)),
  );
  const sum = kernel.reduce((s, v) => s + v, 0);
  const weights = kernel.map((v) => v / sum);
  const pass = (source: Float64Array, horizontal: boolean) => {
    const target = new Float64Array(source.length);
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        let total = 0;
        for (let k = -reach; k <= reach; k++) {
          const [sx, sy] = horizontal ? [x + k, y] : [x, y + k];
          if (sx >= 0 && sx < tw && sy >= 0 && sy < th) {
            total += source[sy * tw + sx]! * weights[k + reach]!;
          }
        }
        target[y * tw + x] = total;
      }
    }
    return target;
  };
  return pass(pass(channel, true), false);
}

function render(haze: Haze) {
  // Premultiplied RGBA, 0 to 1, built layer over layer.
  const [r, g, b, a] = [0, 1, 2, 3].map(() => new Float64Array(tw * th));
  const layer = (mask: Float64Array, colour: string, alpha: number) => {
    const [cr, cg, cb] = rgb(colour).map((v) => v / 255);
    for (let i = 0; i < mask.length; i++) {
      const k = mask[i]! * alpha;
      r![i] = cr! * k + r![i]! * (1 - k);
      g![i] = cg! * k + g![i]! * (1 - k);
      b![i] = cb! * k + b![i]! * (1 - k);
      a![i] = k + a![i]! * (1 - k);
    }
  };
  const [ox, oy] = haze.centre;
  for (const arm of haze.arms) {
    for (const phase of haze.phases) {
      const points: [number, number][] = [];
      for (let t = 0; t <= haze.turn + 1e-9; t += 0.05) {
        const radius = haze.r0 * Math.exp(haze.growth * t);
        const angle = t + phase + arm.phase;
        points.push([ox + radius * Math.cos(angle), oy + haze.squash * radius * Math.sin(angle)]);
      }
      layer(strokeMask(points, arm.width), arm.colour, arm.alpha);
    }
  }
  for (const glow of haze.core) {
    layer(ellipseMask(haze.centre, glow.rx, glow.ry), glow.colour, glow.alpha);
  }
  const sigma = haze.blur / SCALE;
  const [br, bg, bb, ba] = [r!, g!, b!, a!].map((channel) => blur(channel, sigma));
  const image = blankImage(tw, th);
  for (let i = 0; i < tw * th; i++) {
    const alpha = ba![i]!;
    const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
    const un = (v: number) => (alpha > 1e-6 ? v / alpha : 0);
    image.data.set([byte(un(br![i]!)), byte(un(bg![i]!)), byte(un(bb![i]!)), byte(alpha)], i * 4);
  }
  return image;
}

for (const haze of hazes) {
  const id = `${haze.galaxy}-haze`;
  const path = `/art/${haze.galaxy}/haze.png`;
  writePng(`${art}${haze.galaxy}/haze.png`, render(haze));
  writeFileSync(
    `${art}${haze.galaxy}/haze.json`,
    json({
      version: 1,
      asset: id,
      layer: "backdrop",
      anchor: "view",
      parallax: 0,
      filter: "linear",
    }),
  );
  replaceEntries(
    haze.galaxy,
    (entry) => entry === id,
    [
      {
        id,
        path,
        width: tw,
        height: th,
        displayWidth: WIDTH,
        displayHeight: HEIGHT,
        facing: "fixed",
        pivot: { x: 0.5, y: 0.5 },
      },
    ],
    (entry) =>
      entry.startsWith("enemy-") || entry.startsWith("craft-") || entry.includes("portrait"),
  );
  linkData(haze.galaxy, { backdropHaze: `/art/${haze.galaxy}/haze.json` });
}
