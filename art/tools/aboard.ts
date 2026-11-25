// The aboard backdrop: Ada's ship from outside over the in-between field, behind every page
// aboard. Drawn as SVG from the shared ship model (ship-model.ts) at heading 50, then muted as
// story backdrops are.
// Usage: node art/tools/aboard.ts writes public/art/aboard.svg, aboard-emergency.svg, the
// holodisk overlay frames aboard-holodisk-0.svg to -3.svg and aboard-holodisk.json, places their
// core manifest entries and links the sequence as `aboardHolodisk`. Contract: art/aboard.md.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { encodeRgbaPng, encodeRgbPng } from "@andornaut/art-kit/build/png";
import { blankImage } from "@andornaut/art-kit/build/rgbaImage";

import { linkData, placeEntries } from "./manifest.ts";
import { blend, grey, rgba, type RgbaImage, type Xy } from "./paint.ts";
import { json, SHIP_HEADINGS } from "./projection.ts";
import { SPACE_BG } from "./palette.ts";
import {
  centredView,
  DESIGN,
  LOGICAL_PER_DESIGN,
  shimmer,
  sparkles,
  type View,
} from "./shimmer.ts";
import { paintRegions } from "./ship-paths.ts";
import { classic, drawn, FRAME } from "./ship-model.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

// The story canvas in logical px; the SVG user unit is one logical px.
const CANVAS = { width: 960, height: 540 } as const;
// World 281.25 degrees: up and to the right, the engine mouths toward the viewer.
const HEADING = (SHIP_HEADINGS * 281.25) / 360;
// Logical px per ship frame px, and the canvas point (logical px) under the frame centre.
const SCALE = 5.85;
const CENTRE: Xy = [476, 257];
// The subject band: the canopy and the hull round it (art/layout.md, run anchor).
const SUBJECT = { top: 172, bottom: 256 } as const;
// Treatment d's blur, 1.2 design px, in logical px.
const SOFTEN = 1.2 * LOGICAL_PER_DESIGN;
// The field's sparkle blur, 0.6 design px, in logical px.
const SPARKLE_BLUR = 0.6 * LOGICAL_PER_DESIGN;
// The field's embedded raster, px per logical px: its bands span hundreds of logical px, so a
// quarter-density raster scaled smoothly holds them.
const FIELD_DENSITY = 0.25;
// A glow wider than a blur of this many logical px is embedded as a raster at an eighth of a px
// per logical px: its smooth fall-off then costs a scaled image, not a large gradient, to draw.
const BAKED_GLOW = { sigma: 12, density: 0.125 } as const;
const PNG = { deflateLevel: 9, deflateStrategy: 0, filterType: -1 } as const;
// The holodisk overlays' box on the canvas, logical px: every holodisk addition lies inside it.
const HOLODISK_BOX = { x: 379, y: 136, width: 285, height: 183 } as const;
// A renderer may blur only what lies inside the image, so an overlay's softened content would not
// meet the backdrop at its edge: each overlay is clear to `clear` logical px in from its edge,
// where `aboard` shows through, and fades in to opaque at `opaque`, past the blur's reach.
const RIM = { clear: 2, opaque: 6 } as const;

const HOLODISK = { pink: "#ffb3ec", magenta: "#e868c8", plum: "#a83a96" } as const;
const ASTRA = "#8fe0f2";
// Astra's light over the canopy, logical px: its tail stays inside the holodisk box.
const ASTRA_LIGHT = { rx: 115.6, ry: 80.9 } as const;
const ENGINE = "#64caff";
const EMERGENCY = { glow: "#ff6a6a", engine: "#ff8a7a", light: "#e05a5a", deep: "#300c14" };

type Rgb = readonly [number, number, number];
type Box = { x0: number; y0: number; x1: number; y1: number };

// Frame px to canvas logical px.
const toCanvas = ([x, y]: Xy): Xy => [CENTRE[0] + (x - 48) * SCALE, CENTRE[1] + (y - 48) * SCALE];
const faces = drawn(FRAME / 2, classic.paint, { yaw: HEADING });

// The canopy roof's bounds on the canvas, logical px: the dome the subject band holds and the
// point the drive and Astra's light key from.
const GLAZING = [
  classic.paint.canopyHighlight,
  classic.paint.canopyRoof,
  classic.paint.canopyShade,
];
const canopy = (() => {
  const points = faces
    .filter(({ color }) => GLAZING.includes(color))
    .flatMap(({ outline }) => outline.map((p) => toCanvas(p as unknown as Xy)));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
})();
const CANOPY_CENTRE: Xy = [(canopy.x0 + canopy.x1) / 2, (canopy.y0 + canopy.y1) / 2];
// Astra's drive: on the hull just ahead of the canopy, toward the nose.
const DRIVE: Xy = [
  canopy.x1 + (canopy.x1 - canopy.x0) * 0.225,
  CANOPY_CENTRE[1] + (canopy.y1 - canopy.y0) * 0.35,
];

// The engine mouths at this heading, from ship.ts's speed-jet contract.
const jets = JSON.parse(readFileSync(`${art}ship-jets.json`, "utf8")) as {
  headings: { index: number; mouths: { anchor: Xy }[] }[];
};
const MOUTHS = jets.headings
  .find(({ index }) => index === HEADING)!
  .mouths.map(({ anchor }) => toCanvas(anchor));

// Numbers: one decimal for coordinates, three for opacities and stop offsets, no leading zero.
const fixed = (v: number, places: number) =>
  String(Number(v.toFixed(places)) || 0).replace(/^(-?)0\./, "$1.");
const n1 = (v: number) => fixed(v, 1);
const n3 = (v: number) => fixed(v, 3);

function hex([r, g, b]: Rgb): string {
  const h = [r, g, b].map((c) => c.toString(16).padStart(2, "0"));
  return h.every(([a, b]) => a === b) ? `#${h.map(([a]) => a).join("")}` : `#${h.join("")}`;
}
const rgb = (colour: string): Rgb => {
  const [r, g, b] = rgba(colour);
  return [r!, g!, b!];
};

// Treatment d's 25% desaturation toward ITU-R 601 luma, per colour: it is linear, so muting each
// fill before compositing equals muting the composite.
function mute([r, g, b]: Rgb): Rgb {
  const l = (r * 19595 + g * 38470 + b * 7471 + 0x8000) >> 16;
  return [r, g, b].map((c) => Math.trunc(c + 0.25 * (l - c))) as unknown as Rgb;
}

/** The emergency jump's red: the field's lightness carried on a red ramp, 65% over the field. */
function redden([r, g, b]: Rgb): Rgb {
  const light = rgb(EMERGENCY.light);
  const deep = rgb(EMERGENCY.deep);
  const l = (r + g + b) / 3 / 255;
  return [r, g, b].map((c, i) =>
    Math.max(
      0,
      Math.min(255, Math.round(c * 0.35 + (light[i]! * l * 1.2 + deep[i]! * (1 - l)) * 0.65)),
    ),
  ) as unknown as Rgb;
}

/** The field as a small opaque PNG data URI under `box` (logical px), on the canvas's raster grid. */
function field(box: Box, emergency: boolean): string {
  const f = FIELD_DENSITY;
  // One raster px past the box each side, so smoothing at its edge interpolates.
  const gx0 = Math.max(0, Math.floor(box.x0 * f) - 1);
  const gy0 = Math.max(0, Math.floor(box.y0 * f) - 1);
  const gx1 = Math.min(CANVAS.width * f, Math.ceil(box.x1 * f) + 1);
  const gy1 = Math.min(CANVAS.height * f, Math.ceil(box.y1 * f) + 1);
  const canvas = centredView(CANVAS.width, CANVAS.height, 1);
  // Each raster px samples the field at its centre.
  const view: View = {
    width: gx1 - gx0,
    height: gy1 - gy0,
    scale: f * LOGICAL_PER_DESIGN,
    x0: canvas.x0 + (gx0 + 0.5) / f / LOGICAL_PER_DESIGN,
    y0: canvas.y0 + (gy0 + 0.5) / f / LOGICAL_PER_DESIGN,
  };
  let image: RgbaImage = shimmer(view, { sparkle: false });
  if (emergency) {
    for (let p = 0; p < image.data.length; p += 4) {
      image.data.set(redden([image.data[p]!, image.data[p + 1]!, image.data[p + 2]!]), p);
    }
  }
  image = blend(image, grey(image), 0.25);
  const png = encodeRgbPng(PNG, image);
  const uri = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
  return `<image href="${uri}" x="${n1(gx0 / f)}" y="${n1(gy0 / f)}" width="${n1((gx1 - gx0) / f)}" height="${n1((gy1 - gy0) / f)}" preserveAspectRatio="none"/>`;
}

/**
 * A blurred elliptical shape's radial profile for an SVG radial gradient: `shape` is "glow"
 * (alpha `(1 - d)^2` for the elliptical distance d out to rx by ry) or "disc" (solid). `sigmas`
 * are the Gaussian blurs applied in turn, logical px; `darken` blurs the first on clear black, as
 * the field's sparkle layer is, so its edge darkens. Returns the ellipse the gradient fills and
 * stops with `alpha` (0 to 1 of the peak) and `k`, the colour's share against black.
 */
function profile(
  rx: number,
  ry: number,
  shape: "glow" | "disc",
  sigmas: readonly number[],
  darken = false,
) {
  const sigma = Math.hypot(...sigmas);
  const [ax, ay] = [rx + 3 * sigma, ry + 3 * sigma];
  // Grid spacing: a sixth of the finest blur applied or of the shape's half-axes.
  const h = Math.min(darken ? Math.min(...sigmas) : sigma, rx, ry) / 6;
  const [nx, ny] = [Math.ceil(ax / h) + 2, Math.ceil(ay / h) + 2];
  const [w, hh] = [2 * nx + 1, 2 * ny + 1];
  const base = new Float64Array(w * hh);
  for (let j = 0; j < hh; j++) {
    for (let i = 0; i < w; i++) {
      let sum = 0;
      for (let s = 0; s < 16; s++) {
        const x = (i - nx + ((s % 4) + 0.5) / 4 - 0.5) * h;
        const y = (j - ny + (Math.floor(s / 4) + 0.5) / 4 - 0.5) * h;
        const d = Math.hypot(x / rx, y / ry);
        sum += d >= 1 ? 0 : shape === "disc" ? 1 : (1 - d) ** 2;
      }
      base[j * w + i] = sum / 16;
    }
  }
  const blurred = (source: Float64Array, s: number) => {
    const reach = Math.ceil((3 * s) / h);
    const k = Array.from({ length: 2 * reach + 1 }, (_, i) =>
      Math.exp(-(((i - reach) * h) ** 2) / (2 * s * s)),
    );
    const total = k.reduce((a, b) => a + b, 0);
    const pass = (from: Float64Array, dx: number, dy: number) => {
      const to = new Float64Array(from.length);
      for (let j = 0; j < hh; j++) {
        for (let i = 0; i < w; i++) {
          let v = 0;
          for (let t = -reach; t <= reach; t++) {
            const [x, y] = [i + t * dx, j + t * dy];
            if (x >= 0 && x < w && y >= 0 && y < hh) v += from[y * w + x]! * k[t + reach]!;
          }
          to[j * w + i] = v / total;
        }
      }
      return to;
    };
    return pass(pass(source, 1, 0), 0, 1);
  };
  let alpha = blurred(base, darken ? sigmas[0]! : sigma);
  let colour = alpha.map((a) => (darken ? a * a : a));
  for (const s of darken ? sigmas.slice(1) : []) {
    alpha = blurred(alpha, s);
    colour = blurred(colour, s);
  }
  const at = (field: Float64Array, x: number, y: number) => {
    const [fx, fy] = [x / h + nx, y / h + ny];
    const [i, j] = [Math.floor(fx), Math.floor(fy)];
    const [u, v] = [fx - i, fy - j];
    const get = (a: number, b: number) => field[Math.min(hh - 1, b) * w + Math.min(w - 1, a)]!;
    return (
      get(i, j) * (1 - u) * (1 - v) +
      get(i + 1, j) * u * (1 - v) +
      get(i, j + 1) * (1 - u) * v +
      get(i + 1, j + 1) * u * v
    );
  };
  const samples = Array.from({ length: 241 }, (_, m) => {
    const s = m / 240;
    let [a, c] = [0, 0];
    for (let q = 0; q < 16; q++) {
      const theta = ((q + 0.5) / 16) * (Math.PI / 2);
      a += at(alpha, ax * s * Math.cos(theta), ay * s * Math.sin(theta));
      c += at(colour, ax * s * Math.cos(theta), ay * s * Math.sin(theta));
    }
    return { s, alpha: a / 16, k: a > 0 ? Math.min(1, c / a) : 1 };
  });
  return { ax, ay, samples };
}

/** Stops for a profile at `peak` alpha (0 to 255): the support ends below half a level. */
function stops(p: ReturnType<typeof profile>, peak: number) {
  const level = (a: number) => (a * peak) / 255;
  let end = p.samples.findLastIndex(({ alpha }) => alpha * peak >= 0.5) + 1;
  end = Math.min(end, p.samples.length - 1);
  const kept = p.samples.slice(0, end + 1).map((sample, m) => ({
    ...sample,
    alpha: m === end ? 0 : level(sample.alpha),
  }));
  // Greedy linear runs: each stop reaches as far as every sample between stays within 0.3 of a
  // level and 0.5% of colour.
  const chosen = [kept[0]!];
  let from = 0;
  while (from < kept.length - 1) {
    let to = from + 1;
    for (let next = to + 1; next < kept.length; next++) {
      const [a, b] = [kept[from]!, kept[next]!];
      const fits = kept.slice(from + 1, next).every((mid) => {
        const t = (mid.s - a.s) / (b.s - a.s);
        return (
          Math.abs(a.alpha + t * (b.alpha - a.alpha) - mid.alpha) <= 0.3 / 255 &&
          Math.abs(a.k + t * (b.k - a.k) - mid.k) <= 0.005
        );
      });
      if (!fits) break;
      to = next;
    }
    chosen.push(kept[to]!);
    from = to;
  }
  const scale = kept[end]!.s;
  return {
    rx: p.ax * scale,
    ry: p.ay * scale,
    stops: chosen.map(({ s, alpha, k }) => ({ offset: s / scale, alpha, k })),
  };
}

/** An SVG document under construction: gradient definitions and drawn elements. */
class Doc {
  readonly defs: string[] = [];
  readonly body: string[] = [];
  private next = 0;
  readonly ids = new Map<string, string>();

  id(): string {
    return `g${(this.next++).toString(36)}`;
  }

  /** A radial gradient of `stops`, the colour `mix(dark, colour, k)`, shared by identical stops. */
  gradient(st: ReturnType<typeof stops>["stops"], colour: Rgb, dark?: Rgb): string {
    const body = st
      .map(({ offset, alpha, k }) => {
        const c = dark
          ? (colour.map((v, i) => Math.round(dark[i]! + k * (v - dark[i]!))) as unknown as Rgb)
          : colour;
        return `<stop offset="${n3(offset)}" stop-color="${hex(c)}" stop-opacity="${n3(alpha)}"/>`;
      })
      .join("");
    let id = this.ids.get(body);
    if (!id) {
      id = this.id();
      this.ids.set(body, id);
      this.defs.push(`<radialGradient id="${id}">${body}</radialGradient>`);
    }
    return id;
  }
}

interface Spot {
  centre: Xy;
  rx: number;
  ry: number;
  fill: string;
  opacity?: number;
  // A gradient spot's stops: opacity by normalized elliptical distance.
  stops?: readonly { offset: number; alpha: number }[];
  // A baked glow's image element, drawn in place of the ellipse.
  image?: string;
}

/** A glow's stops sampled into a small RGBA PNG over its support, as an image element. */
function bake([cx, cy]: Xy, { rx, ry, stops: st }: ReturnType<typeof stops>, colour: Rgb): string {
  const f = BAKED_GLOW.density;
  const [gx0, gy0] = [Math.floor((cx - rx) * f), Math.floor((cy - ry) * f)];
  const [gx1, gy1] = [Math.ceil((cx + rx) * f), Math.ceil((cy + ry) * f)];
  const image = blankImage(gx1 - gx0, gy1 - gy0);
  for (let j = 0; j < image.height; j++) {
    for (let i = 0; i < image.width; i++) {
      const s = Math.hypot(((gx0 + i + 0.5) / f - cx) / rx, ((gy0 + j + 0.5) / f - cy) / ry);
      const k = st.findIndex(({ offset }) => offset >= s);
      let alpha = 0;
      if (k === 0) {
        alpha = st[0]!.alpha;
      } else if (k > 0) {
        const [a, b] = [st[k - 1]!, st[k]!];
        alpha = a.alpha + ((s - a.offset) / (b.offset - a.offset)) * (b.alpha - a.alpha);
      }
      image.data.set([...colour, Math.round(alpha * 255)], (j * image.width + i) * 4);
    }
  }
  const uri = `data:image/png;base64,${Buffer.from(encodeRgbaPng(PNG, image)).toString("base64")}`;
  return `<image href="${uri}" x="${n1(gx0 / f)}" y="${n1(gy0 / f)}" width="${n1(image.width / f)}" height="${n1(image.height / f)}" preserveAspectRatio="none"/>`;
}

const ellipse = ({ centre: [cx, cy], rx, ry, fill, opacity, image }: Spot) =>
  image ??
  (rx === ry
    ? `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(rx)}" fill="${fill}"${opacity === undefined ? "" : ` fill-opacity="${n3(opacity)}"`}/>`
    : `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${fill}"${opacity === undefined ? "" : ` fill-opacity="${n3(opacity)}"`}/>`);

const spotBox = ({ centre: [cx, cy], rx, ry }: Spot): Box => ({
  x0: cx - rx,
  y0: cy - ry,
  x1: cx + rx,
  y1: cy + ry,
});
const meets = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const union = (boxes: readonly Box[]): Box => ({
  x0: Math.min(...boxes.map(({ x0 }) => x0)),
  y0: Math.min(...boxes.map(({ y0 }) => y0)),
  x1: Math.max(...boxes.map(({ x1 }) => x1)),
  y1: Math.max(...boxes.map(({ y1 }) => y1)),
});

/**
 * A soft elliptical glow centred on a canvas point (logical px): alpha `peak (1 - d)^2` for the
 * elliptical distance d out to rx by ry, then Gaussians of `sigmas` logical px, as a radial
 * gradient, or for a wide blur an embedded raster (`image`).
 */
function glow(
  doc: Doc,
  centre: Xy,
  rx: number,
  ry: number,
  colour: Rgb,
  peak: number,
  sigmas: readonly number[],
): Spot {
  const s = stops(profile(rx, ry, "glow", sigmas), peak);
  if (Math.hypot(...sigmas) > BAKED_GLOW.sigma) {
    return { centre, rx: s.rx, ry: s.ry, fill: "", stops: s.stops, image: bake(centre, s, colour) };
  }
  return {
    centre,
    rx: s.rx,
    ry: s.ry,
    fill: `url(#${doc.gradient(s.stops, colour)})`,
    stops: s.stops,
  };
}

// The field's sparkles (shimmer.ts): discs on a clear layer, blurred and laid over the field, then
// softened with it. The layer is clear black, or a glow disc's colour (at any alpha, even none)
// where a dot lies on one, so a dot's blurred edge darkens toward that.
const SPOTS = (() => {
  const view = centredView(CANVAS.width, CANVAS.height, 2);
  const spots = sparkles(view, 0).map((spot) => ({
    ...spot,
    centre: [
      (spot.x - view.x0) * LOGICAL_PER_DESIGN,
      (spot.y - view.y0) * LOGICAL_PER_DESIGN,
    ] as Xy,
    r: spot.r * LOGICAL_PER_DESIGN,
    alpha: Math.trunc((spot.glow ? 26 : 200) * spot.tw),
  }));
  const glows = spots.filter(({ glow }) => glow);
  return spots
    .map((spot) => {
      const under = spot.glow
        ? undefined
        : glows.findLast(
            ({ centre, r }) =>
              Math.hypot(centre[0] - spot.centre[0], centre[1] - spot.centre[1]) < r,
          );
      return { ...spot, dark: under ? rgb(under.colour) : ([0, 0, 0] as Rgb) };
    })
    .filter(({ alpha }) => alpha > 0);
})();
const sparkleProfiles = new Map<number, ReturnType<typeof profile>>();

function sparkle(doc: Doc, spot: (typeof SPOTS)[number], tone: (c: Rgb) => Rgb): Spot {
  const key = Math.round(spot.r * 1000);
  let p = sparkleProfiles.get(key);
  if (!p) {
    p = profile(spot.r, spot.r, "disc", [SPARKLE_BLUR, SOFTEN], true);
    sparkleProfiles.set(key, p);
  }
  // Dots share one gradient per colour at full alpha and carry their own opacity; glows are faint
  // enough that their own alpha sets where the support ends.
  const s = stops(p, spot.glow ? spot.alpha : 255);
  const id = doc.gradient(s.stops, mute(tone(rgb(spot.colour))), mute(tone(spot.dark)));
  return {
    centre: spot.centre,
    rx: s.rx,
    ry: s.ry,
    fill: `url(#${id})`,
    ...(spot.glow ? {} : { opacity: spot.alpha / 255 }),
  };
}

/** The ship's opaque paint regions as one path per colour, canvas logical px. */
function shipPaths(): string[] {
  const regions = paintRegions(
    faces.map(({ color, outline }) => ({
      color,
      outline: outline.map((p) => toCanvas(p as unknown as Xy)),
    })),
  );
  // Relative moves on the 0.1 grid, so rounding never drifts along a contour.
  const tenth = (v: number) => Math.round(v * 10);
  const t = (v: number) => fixed(v / 10, 1);
  const join = (values: readonly number[]) =>
    values.map((v, i) => (i && v >= 0 ? " " : "") + t(v)).join("");
  return regions.map(({ color, loops }) => {
    const d = loops
      .map((loop) => {
        const points = loop.map(([x, y]) => [tenth(x), tenth(y)] as const);
        let [px, py] = points[0]!;
        let out = `M${join([px, py])}`;
        for (const [x, y] of points.slice(1)) {
          const [dx, dy] = [x - px, y - py];
          if (dx === 0 && dy === 0) continue;
          out += dy === 0 ? `h${t(dx)}` : dx === 0 ? `v${t(dy)}` : `l${join([dx, dy])}`;
          [px, py] = [x, y];
        }
        return `${out}z`;
      })
      .join("");
    return `<path fill="${hex(mute(rgb(color)))}" d="${d}"/>`;
  });
}
const SHIP = shipPaths();
const SHIP_BOX = (() => {
  const points = faces.flatMap(({ outline }) => outline.map((p) => toCanvas(p as unknown as Xy)));
  return union(points.map(([x, y]) => ({ x0: x, y0: y, x1: x, y1: y })));
})();

// Treatment d's haze: the space background from 22% opacity at the design frame's top to 72% at
// its bottom, easing in (0.22 + 0.5 t^2), held beyond the frame. Eight linear runs follow the
// curve within half a level.
const HAZE = (() => {
  const canvas = centredView(CANVAS.width, CANVAS.height, 1);
  const y = (design: number) => (design - canvas.y0) * LOGICAL_PER_DESIGN;
  const body = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return `<stop offset="${n3(t)}" stop-color="${hex(rgb(SPACE_BG))}" stop-opacity="${n3(0.22 + 0.5 * t * t)}"/>`;
  }).join("");
  return `<linearGradient id="h" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(y(0))}" x2="0" y2="${n1(y(DESIGN.height - 1))}">${body}</linearGradient>`;
})();

type Look = { emergency?: boolean; holodisk?: number };

/** The holodisk additions for frame 0 to 3: inside the softened group, then after it. */
function holodisk(doc: Doc, frame: number) {
  const soft: string[] = [];
  const after: Spot[] = [];
  // Solid additions' reach (their edge and the group blur's), and the glows, with the blur that
  // still spreads each.
  const boxes: Box[] = [];
  const glows: { spot: Spot; spread: number }[] = [];
  const soften = (spot: Spot) => {
    if (spot.stops) {
      glows.push({ spot, spread: 3 * SOFTEN });
    } else {
      boxes.push(spotBox({ ...spot, rx: spot.rx + 3 * SOFTEN, ry: spot.ry + 3 * SOFTEN }));
    }
    soft.push(ellipse(spot));
  };
  if (frame >= 1) {
    const r = 26 + 16 * frame;
    soften(glow(doc, DRIVE, r, r, mute(rgb(HOLODISK.pink)), frame === 1 ? 150 : 120, [4]));
  }
  soften({ centre: DRIVE, rx: 4.5, ry: 4.5, fill: hex(mute(rgb(HOLODISK.plum))) });
  soften({ centre: DRIVE, rx: 3.5, ry: 3.5, fill: hex(mute(rgb(HOLODISK.magenta))) });
  if (frame >= 2) {
    const r = frame === 2 ? 34 : 58;
    for (let k = 0; k < 16; k++) {
      const a = (2 * Math.PI * k) / 16;
      soften({
        centre: [DRIVE[0] + Math.cos(a) * r, DRIVE[1] + Math.sin(a) * r * 0.6],
        rx: 2.5,
        ry: 2.5,
        fill: hex(mute(rgb(HOLODISK.magenta))),
        opacity: 230 / 255,
      });
    }
    const light = glow(
      doc,
      CANOPY_CENTRE,
      ASTRA_LIGHT.rx,
      ASTRA_LIGHT.ry,
      mute(rgb(ASTRA)),
      frame === 2 ? 110 : 150,
      [8, SOFTEN],
    );
    after.push(light);
    glows.push({ spot: light, spread: 0 });
  }
  return { soft, after, box: union(boxes), glows };
}

/**
 * The scene as minified SVG, framed to `view` (logical px, the whole canvas by default), with
 * an optional faded rim.
 */
function render(
  { emergency = false, holodisk: frame }: Look = {},
  view: Box = { x0: 0, y0: 0, x1: CANVAS.width, y1: CANVAS.height },
  rim?: typeof RIM,
): string {
  const doc = new Doc();
  const tone = emergency ? redden : (c: Rgb) => c;
  const visible = (spot: Spot) => meets(spotBox(spot), view);
  // Only sparkles the frame shows get a gradient.
  const below = SPOTS.filter((spot) => visible(sparkle(new Doc(), spot, tone))).map((spot) =>
    sparkle(doc, spot, tone),
  );
  const engines = MOUTHS.map(([x, y]) =>
    glow(doc, [x - 10, y + 4], 34, 24, mute(rgb(emergency ? EMERGENCY.engine : ENGINE)), 170, [6]),
  );
  const added = frame === undefined ? undefined : holodisk(doc, frame);
  const over: Spot[] = [...(added?.after ?? [])];
  if (emergency) {
    over.push(glow(doc, CANOPY_CENTRE, 300, 180, mute(rgb(EMERGENCY.glow)), 90, [24, SOFTEN]));
  }
  // The softened group: everything treatment d blurs that is sharp or drawn under the hull.
  const pad = Math.ceil(3 * SOFTEN) + 1;
  let group = union([SHIP_BOX, ...engines.map(spotBox), ...(added ? [added.box] : [])]);
  group = {
    x0: Math.max(group.x0 - pad, view.x0 - pad),
    y0: Math.max(group.y0 - pad, view.y0 - pad),
    x1: Math.min(group.x1 + pad, view.x1 + pad),
    y1: Math.min(group.y1 + pad, view.y1 + pad),
  };
  const [x, y] = [Math.floor(group.x0), Math.floor(group.y0)];
  const [w, h] = [Math.ceil(group.x1) - x, Math.ceil(group.y1) - y];
  doc.defs.push(
    `<filter id="s" filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${n1(SOFTEN)}"/></filter>`,
    HAZE,
  );
  const body = [
    field(view, emergency),
    ...below.map(ellipse),
    `<g filter="url(#s)">`,
    ...engines.map(ellipse),
    ...SHIP,
    ...(added?.soft ?? []),
    "</g>",
    ...over.filter(visible).map(ellipse),
    `<rect x="${view.x0}" y="${view.y0}" width="${view.x1 - view.x0}" height="${view.y1 - view.y0}" fill="url(#h)"/>`,
  ];
  const [vw, vh] = [view.x1 - view.x0, view.y1 - view.y0];
  if (rim) {
    // Two masks multiply a horizontal and a vertical ramp: clear, fading in, opaque.
    const ramp = (id: string, size: number, axis: "x" | "y") => {
      const [a, b] = [rim.clear / size, rim.opaque / size];
      const stops = [
        [a, 0],
        [b, 1],
        [1 - b, 1],
        [1 - a, 0],
      ]
        .map(([o, op]) => `<stop offset="${n3(o!)}" stop-color="#fff" stop-opacity="${op}"/>`)
        .join("");
      const [x1, y1, x2, y2] = axis === "x" ? [view.x0, 0, view.x1, 0] : [0, view.y0, 0, view.y1];
      return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
    };
    const rect = `x="${view.x0}" y="${view.y0}" width="${vw}" height="${vh}"`;
    doc.defs.push(
      ramp("rx", vw, "x"),
      ramp("ry", vh, "y"),
      `<mask id="my" maskUnits="userSpaceOnUse" ${rect}><rect ${rect} fill="url(#ry)"/></mask>`,
      `<mask id="m" maskUnits="userSpaceOnUse" ${rect}><rect ${rect} fill="url(#rx)" mask="url(#my)"/></mask>`,
    );
  }
  const shown = rim ? [`<g mask="url(#m)">`, ...body, "</g>"] : body;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="${view.x0} ${view.y0} ${vw} ${vh}"><defs>${doc.defs.join("")}</defs>${shown.join("")}</svg>\n`;
}

writeFileSync(`${art}aboard.svg`, render());
writeFileSync(`${art}aboard-emergency.svg`, render({ emergency: true }));

// Holodisk overlays: each frame's scene framed to one box round every addition, opaque inside
// its rim, so each overlay alone shows its frame over `aboard`.
const frameBox: Box = {
  x0: HOLODISK_BOX.x,
  y0: HOLODISK_BOX.y,
  x1: HOLODISK_BOX.x + HOLODISK_BOX.width,
  y1: HOLODISK_BOX.y + HOLODISK_BOX.height,
};
// The opaque part, inside the rim.
const box: Box = {
  x0: frameBox.x0 + RIM.opaque,
  y0: frameBox.y0 + RIM.opaque,
  x1: frameBox.x1 - RIM.opaque,
  y1: frameBox.y1 - RIM.opaque,
};
// Solid additions lie inside the opaque part. A glow's tail at its edge (spread by any blur still
// to come), under the haze, is under four levels at full contrast, so its fade across the rim
// reads as part of the glow.
const hazeAt = (y: number) => {
  const canvas = centredView(CANVAS.width, CANVAS.height, 1);
  const t = Math.max(0, Math.min(1, (canvas.y0 + y / LOGICAL_PER_DESIGN) / (DESIGN.height - 1)));
  return 0.22 + 0.5 * t * t;
};
const edgeLevels = ({
  spot: {
    centre: [cx, cy],
    rx,
    ry,
    stops,
  },
  spread,
}: {
  spot: Spot;
  spread: number;
}) =>
  (
    [
      [(cx - box.x0 - spread) / rx, cy],
      [(box.x1 - cx - spread) / rx, cy],
      [(cy - box.y0 - spread) / ry, box.y0],
      [(box.y1 - cy - spread) / ry, box.y1],
    ] as const
  ).map(([s, y]) => {
    const i = stops!.findIndex(({ offset }) => offset >= s);
    if (i <= 0) return i === 0 ? 255 : 0;
    const [a, b] = [stops![i - 1]!, stops![i]!];
    const alpha = a.alpha + ((s - a.offset) / (b.offset - a.offset)) * (b.alpha - a.alpha);
    return alpha * 255 * (1 - hazeAt(y));
  });
for (const frame of [0, 1, 2, 3]) {
  const { glows, box: added } = holodisk(new Doc(), frame);
  const edge = Math.max(0, ...glows.flatMap(edgeLevels));
  console.log(`holodisk ${frame}: glow edge ${edge.toFixed(2)} levels at full contrast`);
  if (
    added.x0 < box.x0 ||
    added.y0 < box.y0 ||
    added.x1 > box.x1 ||
    added.y1 > box.y1 ||
    edge >= 4
  ) {
    throw new Error(
      `Holodisk frame ${frame} reaches ${JSON.stringify(added)}, ${edge} of a level at the edge, past the overlay box`,
    );
  }
  writeFileSync(`${art}aboard-holodisk-${frame}.svg`, render({ holodisk: frame }, frameBox, RIM));
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const at = { x: HOLODISK_BOX.x, y: HOLODISK_BOX.y };
const background = (id: string) => ({
  id,
  path: `/art/${id}.svg`,
  width: CANVAS.width,
  height: CANVAS.height,
  displayWidth: CANVAS.width,
  displayHeight: CANVAS.height,
  facing: "front",
  pivot: { x: 0.5, y: 0.5 },
  subject: SUBJECT,
  // The canopy's centre in canvas logical px: where a quantum jump from aboard centres.
  focus: { x: round1(CANOPY_CENTRE[0]), y: round1(CANOPY_CENTRE[1]) },
});
const overlay = (k: number) => ({
  id: `aboard-holodisk-${k}`,
  path: `/art/aboard-holodisk-${k}.svg`,
  width: HOLODISK_BOX.width,
  height: HOLODISK_BOX.height,
  displayWidth: HOLODISK_BOX.width,
  displayHeight: HOLODISK_BOX.height,
  facing: "front",
  pivot: { x: 0, y: 0 },
  at,
});
placeEntries("core", "aboard", [
  background("aboard"),
  background("aboard-emergency"),
  ...[0, 1, 2, 3].map(overlay),
]);

// The holodisk sequence, in story-overnight.json's step schema: each overlay step fades its
// overlay in over the one before, then holds; the last holds until the page changes.
const ids = [0, 1, 2, 3].map((k) => `aboard-holodisk-${k}`);
const HOLDS = [400, 250, 400, 600];
writeFileSync(
  `${art}aboard-holodisk.json`,
  json({
    version: 1,
    holodisk: {
      background: "aboard",
      overlays: Object.fromEntries(ids.map((id) => [id, { at }])),
      steps: ids.map((id, k) => ({ overlay: id, fadeMs: 0, holdMs: HOLDS[k] })),
      durationMs: HOLDS.reduce((sum, ms) => sum + ms, 0),
      reducedMotion: [
        { overlay: ids[0], fadeMs: 0, holdMs: 0 },
        { overlay: ids[3], fadeMs: 300, holdMs: 0 },
      ],
      reducedMotionMs: 300,
      // When the next page starts (Astra's "Memory restored."), the overlay fades out.
      exitFadeMs: 200,
    },
  }),
);
linkData("core", { aboardHolodisk: "/art/aboard-holodisk.json" });
console.log(`canopy ${JSON.stringify(canopy)}, drive ${DRIVE.map(round1)}`);
