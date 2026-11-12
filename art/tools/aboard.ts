// The aboard backdrop: Ada's ship from outside over the in-between field, behind every page
// aboard. Drawn from the ship model in ship.ts at heading 25, then muted as story backdrops are.
// Usage: node art/tools/aboard.ts writes public/art/aboard.png, the holodisk overlay frames
// aboard-holodisk-0 to -3, aboard-emergency.png and aboard-holodisk.json, places their core
// manifest entries and links the sequence as `aboardHolodisk`. Contract: art/aboard.md.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { blankImage } from "@andornaut/art-kit/rgbaImage";

import { linkData, placeEntries } from "./manifest.ts";
import {
  blend,
  blur,
  fillPolygon,
  grey,
  over,
  region,
  resize,
  rgba,
  type RgbaImage,
  writePng,
  type Xy,
} from "./paint.ts";
import { json } from "./projection.ts";
import { SPACE_BG } from "./palette.ts";
import { centredView, DESIGN, shimmer, type View } from "./shimmer.ts";
import { classic, drawn } from "./ship.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

// The story canvas: 960 by 540 logical px at 2 image px per logical px.
const CANVAS = { width: 960, height: 540, density: 2 } as const;
const D = CANVAS.density;
// Heading 25 of 32: up and to the right, the engine mouths toward the viewer.
const HEADING = 25;
// Logical px per ship frame px, and the canvas point (logical px) under the frame centre.
const SCALE = 5.85;
const CENTRE: Xy = [476, 245];
// The subject band: the canopy and the hull round it (art/layout.md, run anchor).
const SUBJECT = { top: 172, bottom: 256 } as const;
// Ship drawing supersampling.
const SS = 3;

const HOLODISK = { pink: "#ffb3ec", magenta: "#e868c8", plum: "#a83a96" } as const;
const ASTRA = "#8fe0f2";
const ENGINE = "#64caff";
const EMERGENCY = { glow: "#ff6a6a", engine: "#ff8a7a", light: "#e05a5a", deep: "#300c14" };

// Frame px to canvas logical px.
const toCanvas = ([x, y]: Xy): Xy => [CENTRE[0] + (x - 48) * SCALE, CENTRE[1] + (y - 48) * SCALE];
const faces = drawn(HEADING, false, classic.paint);

// The canopy roof's bounds on the canvas, logical px: the dome the subject band holds and the
// point the drive and Astra's light key from.
const canopy = (() => {
  const points = faces
    .filter(({ color }) => color.toLowerCase() === classic.paint.canopyRoof.toLowerCase())
    .flatMap(({ outline }) => outline.map((p) => toCanvas(p as unknown as Xy)));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
})();
const CANOPY_CENTRE: Xy = [(canopy.x0 + canopy.x1) / 2, (canopy.y0 + canopy.y1) / 2];
// Astra's drive: on the hull just ahead of the canopy, toward the nose.
const DRIVE: Xy = [
  canopy.x1 + (canopy.x1 - canopy.x0) * 0.28,
  CANOPY_CENTRE[1] + (canopy.y1 - canopy.y0) * 0.35,
];

/** The ship's polygons, supersampled and reduced with Lanczos filtering, over `target`. */
function drawShip(target: RgbaImage) {
  const outlines = faces.map(({ color, outline }) => ({
    color,
    points: outline.map((p) => toCanvas(p as unknown as Xy)),
  }));
  const all = outlines.flatMap(({ points }) => points);
  const x0 = Math.floor(Math.min(...all.map(([x]) => x))) - 2;
  const y0 = Math.floor(Math.min(...all.map(([, y]) => y))) - 2;
  const x1 = Math.ceil(Math.max(...all.map(([x]) => x))) + 2;
  const y1 = Math.ceil(Math.max(...all.map(([, y]) => y))) + 2;
  const [w, h] = [(x1 - x0) * D, (y1 - y0) * D];
  const big = blankImage(w * SS, h * SS);
  for (const { color, points } of outlines) {
    fillPolygon(
      big,
      points.map(([x, y]): Xy => [(x - x0) * D * SS, (y - y0) * D * SS]),
      rgba(color),
    );
  }
  over(target, resize(big, w, h), x0 * D, y0 * D);
}

/**
 * A soft elliptical glow centred on a canvas point (logical px): alpha `peak (1 - d)^2` for the
 * elliptical distance d out to rx by ry, then a Gaussian of `sigma` logical px.
 */
function glow(
  target: RgbaImage,
  [cx, cy]: Xy,
  rx: number,
  ry: number,
  colour: string,
  peak: number,
  sigma: number,
) {
  const pad = Math.ceil(sigma * 3);
  const x0 = Math.floor((cx - rx) * D) - pad * D;
  const y0 = Math.floor((cy - ry) * D) - pad * D;
  const [w, h] = [Math.ceil(2 * rx * D) + 2 * pad * D, Math.ceil(2 * ry * D) + 2 * pad * D];
  const layer = blankImage(w, h);
  const [r, g, b] = rgba(colour);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = ((x0 + x + 0.5) / D - cx) / rx;
      const dy = ((y0 + y + 0.5) / D - cy) / ry;
      const d = Math.hypot(dx, dy);
      if (d < 1) {
        layer.data.set([r!, g!, b!, Math.round(peak * (1 - d) ** 2)], (y * w + x) * 4);
      } else {
        layer.data.set([r!, g!, b!, 0], (y * w + x) * 4);
      }
    }
  }
  blur(layer, sigma * D);
  over(target, layer, x0, y0);
}

/** A filled dot, supersampled by 4 for an even edge. */
function dot(target: RgbaImage, [cx, cy]: Xy, radius: number, colour: string, alpha: number) {
  const n = Math.ceil(radius * D) + 2;
  const [x0, y0] = [Math.floor(cx * D) - n, Math.floor(cy * D) - n];
  const layer = blankImage(2 * n, 2 * n);
  const [r, g, b] = rgba(colour);
  for (let y = 0; y < 2 * n; y++) {
    for (let x = 0; x < 2 * n; x++) {
      let hits = 0;
      for (let s = 0; s < 16; s++) {
        const px = (x0 + x + ((s % 4) + 0.5) / 4) / D - cx;
        const py = (y0 + y + (Math.floor(s / 4) + 0.5) / 4) / D - cy;
        if (Math.hypot(px, py) <= radius) {
          hits++;
        }
      }
      layer.data.set([r!, g!, b!, Math.round((alpha * hits) / 16)], (y * 2 * n + x) * 4);
    }
  }
  over(target, layer, x0, y0);
}

// The engine mouths at this heading, from ship.ts's speed-jet contract.
const jets = JSON.parse(readFileSync(`${art}ship-jets.json`, "utf8")) as {
  headings: { index: number; mouths: { anchor: Xy }[] }[];
};
const MOUTHS = jets.headings
  .find(({ index }) => index === HEADING)!
  .mouths.map(({ anchor }) => toCanvas(anchor));

/**
 * Treatment d as story backdrops have it here: a 1.2 design px blur, 25% desaturation and a
 * haze of the space background from 22% at the design frame's top to 72% at its bottom
 * (ease-in), held beyond the frame.
 */
function treat(view: View, image: RgbaImage): RgbaImage {
  const blurred = { ...image, data: image.data.slice() };
  blur(blurred, 1.2 * view.scale);
  const out = blend(blurred, grey(blurred), 0.25);
  const haze = blankImage(view.width, view.height);
  const [r, g, b] = rgba(SPACE_BG);
  for (let y = 0; y < view.height; y++) {
    const t = Math.max(0, Math.min(1, (view.y0 + y / view.scale) / (DESIGN.height - 1)));
    const alpha = Math.trunc(255 * (0.22 + 0.5 * t * t));
    for (let x = 0; x < view.width; x++) {
      haze.data.set([r!, g!, b!, alpha], (y * view.width + x) * 4);
    }
  }
  over(out, haze);
  return out;
}

/** The emergency jump's red: the field's lightness carried on a red ramp, 65% over the field. */
function redden(image: RgbaImage) {
  const [lr, lg, lb] = rgba(EMERGENCY.light);
  const [dr, dg, db] = rgba(EMERGENCY.deep);
  for (let i = 0; i < image.width * image.height; i++) {
    const p = i * 4;
    const l = (image.data[p]! + image.data[p + 1]! + image.data[p + 2]!) / 3 / 255;
    const red = [
      lr! * l * 1.2 + dr! * (1 - l),
      lg! * l * 1.2 + dg! * (1 - l),
      lb! * l * 1.2 + db! * (1 - l),
    ];
    for (let c = 0; c < 3; c++) {
      image.data[p + c] = Math.max(
        0,
        Math.min(255, Math.round(image.data[p + c]! * 0.35 + red[c]! * 0.65)),
      );
    }
  }
}

/**
 * The holodisk moment from outside, frame 0 to 3: the disk's dot at the drive (hold); a pink
 * pulse there (read); a ring of 16 magenta dots and Astra's teal light in the canopy (link);
 * the ring wider and Astra brighter (restored).
 */
function holodisk(target: RgbaImage, frame: number) {
  if (frame >= 1) {
    glow(
      target,
      DRIVE,
      26 + 16 * frame,
      26 + 16 * frame,
      HOLODISK.pink,
      frame === 1 ? 150 : 120,
      4,
    );
  }
  dot(target, DRIVE, 4.5, HOLODISK.plum, 255);
  dot(target, DRIVE, 3.5, HOLODISK.magenta, 255);
  if (frame >= 2) {
    const r = frame === 2 ? 34 : 58;
    for (let k = 0; k < 16; k++) {
      const a = (2 * Math.PI * k) / 16;
      dot(
        target,
        [DRIVE[0] + Math.cos(a) * r, DRIVE[1] + Math.sin(a) * r * 0.6],
        2.5,
        HOLODISK.magenta,
        230,
      );
    }
    const w = canopy.x1 - canopy.x0;
    glow(target, CANOPY_CENTRE, w * 0.9, w * 0.63, ASTRA, frame === 2 ? 110 : 150, 8);
  }
}

type Look = { emergency?: boolean; holodisk?: number };

function render(view: View, { emergency = false, holodisk: frame }: Look = {}): RgbaImage {
  const image = shimmer(view);
  if (emergency) {
    redden(image);
  }
  for (const [x, y] of MOUTHS) {
    glow(image, [x - 10, y + 4], 34, 24, emergency ? EMERGENCY.engine : ENGINE, 170, 6);
  }
  drawShip(image);
  if (frame !== undefined) {
    holodisk(image, frame);
  }
  if (emergency) {
    glow(image, CANOPY_CENTRE, 300, 180, EMERGENCY.glow, 90, 24);
  }
  return treat(view, image);
}

const view = centredView(CANVAS.width, CANVAS.height, CANVAS.density);
const base = render(view);
writePng(`${art}aboard.png`, base, true);
writePng(`${art}aboard-emergency.png`, render(view, { emergency: true }), true);

// Holodisk overlays: each frame's render cropped to one box round every pixel any frame
// changes, opaque, so each overlay alone shows its frame over `aboard`.
const frames = [0, 1, 2, 3].map((frame) => render(view, { holodisk: frame }));
let [bx0, by0, bx1, by1] = [view.width, view.height, 0, 0];
for (const frame of frames) {
  for (let y = 0; y < view.height; y++) {
    for (let x = 0; x < view.width; x++) {
      const p = (y * view.width + x) * 4;
      if ([0, 1, 2].some((c) => frame.data[p + c] !== base.data[p + c])) {
        bx0 = Math.min(bx0, x);
        by0 = Math.min(by0, y);
        bx1 = Math.max(bx1, x + 1);
        by1 = Math.max(by1, y + 1);
      }
    }
  }
}
// Grow by 2 px and snap to whole logical px.
bx0 = Math.max(0, Math.floor((bx0 - 2) / D) * D);
by0 = Math.max(0, Math.floor((by0 - 2) / D) * D);
bx1 = Math.min(view.width, Math.ceil((bx1 + 2) / D) * D);
by1 = Math.min(view.height, Math.ceil((by1 + 2) / D) * D);
const at = { x: bx0 / D, y: by0 / D };
frames.forEach((frame, k) => {
  writePng(`${art}aboard-holodisk-${k}.png`, region(frame, bx0, by0, bx1 - bx0, by1 - by0));
});

const round1 = (v: number) => Math.round(v * 10) / 10;
const background = (id: string) => ({
  id,
  path: `/art/${id}.png`,
  width: view.width,
  height: view.height,
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
  path: `/art/aboard-holodisk-${k}.png`,
  width: bx1 - bx0,
  height: by1 - by0,
  displayWidth: (bx1 - bx0) / D,
  displayHeight: (by1 - by0) / D,
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
console.log(
  `canopy ${JSON.stringify(canopy)}, drive ${DRIVE.map(round1)}, holodisk box at ${JSON.stringify(at)} ${(bx1 - bx0) / D} by ${(by1 - by0) / D}`,
);
