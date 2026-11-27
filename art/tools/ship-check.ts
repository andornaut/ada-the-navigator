import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { blankImage } from "@andornaut/art-kit/build/rgbaImage";

import { rgb, toOklab } from "./oklab.ts";
import {
  anchor,
  ENEMY_HEADINGS,
  SHIP_HEADINGS,
  SHIP_HEADING_CONTRACT,
  vector,
} from "./projection.ts";
import {
  JET_LENGTH,
  JET_LEVELS,
  JET_PROFILE,
  jetLayers,
  LIGHT_FIELD_JET_LEVELS,
  plumeReach,
  RETRO_JET,
} from "./ship-jet-layers.ts";
import { AUTHORED_JET_CURVE, AUTHORED_JET_LENGTH } from "./ship-jet-svg.ts";
import {
  CANOPY,
  classic,
  DISPLAY,
  drawn,
  drawnParts,
  ENGINE_MATERIAL_RELATIONSHIPS,
  forwardJetMouthGeometry,
  forwardJetMouths,
  FRAME,
  PAINT_SLOTS,
  mouthEdgeJetMouths,
  plumeRoot,
  plumeSide,
  retroMouthAxis,
  retroRoot,
  SCHEMES,
  shipVertices,
  TIP_CAP_X,
  TONE_STEPS,
  UP,
} from "./ship-model.ts";
import { svgPaths } from "./ship-paths.ts";
import { WARP_FRAME, WARP_HEADING, WARP_POSES } from "./ship-poses.ts";
import {
  jetLength,
  layersAt,
  plumePolygon,
  type PlumeLayer,
  type PlumeMouth,
} from "./ship-plume.ts";
import { paintShip } from "./ship-raster.ts";

const assets = new URL("../../public/art/", import.meta.url);
const worldView = (degrees: number) => (degrees * SHIP_HEADINGS) / 360;
const ALL = Array.from({ length: SHIP_HEADINGS }, (_, index) => index);

test("a sampled canopy tangency retains closed vector material contours", () => {
  const fragments = drawn(48, classic.paint, { yaw: worldView(73.125) });
  const paths = svgPaths(fragments);
  assert(paths.length > 0);
  assert(paths.every(({ path }) => path.endsWith("Z")));
});
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) =>
  [1, 3, 5].reduce(
    (sum, at, i) =>
      sum + linear(parseInt(hex.slice(at, at + 2), 16) / 255) * [0.2126, 0.7152, 0.0722][i]!,
    0,
  );

test("exported paints match the schemes: authored Classic tones and derived steps", () => {
  const metadata = JSON.parse(readFileSync(new URL("ship-paint.json", assets), "utf8")) as {
    schemes: Record<string, string | undefined>[];
  };
  assert.deepEqual(
    metadata.schemes.map(({ id }) => id),
    ["classic", "cobalt", "seafoam", "graphite", "iris", "amber"],
  );
  assert.deepEqual(
    metadata.schemes,
    SCHEMES.map(({ canopySides, id, name, paint }) => ({ id, name, ...paint, canopySides })),
  );
  assert(metadata.schemes.every((scheme) => scheme.price === undefined));
  assert.deepEqual(
    PAINT_SLOTS.map((slot) => classic.paint[slot]),
    [
      "#ffffff",
      "#ebf1f7",
      "#b4c4d6",
      "#8497ae",
      "#6d829d",
      "#445a76",
      "#2456b8",
      "#2251af",
      "#1a418f",
      "#123271",
      "#abbfce",
      "#87bce5",
      "#2585d0",
      "#1f78c3",
      "#86deff",
    ],
  );
  assert.deepEqual(
    SCHEMES.map(({ paint }) => paint.accent),
    ["#2456b8", "#16245c", "#aebbc7", "#f6efe6", "#58d4e8", "#12233a"],
  );
  // Each derived tone keeps its step's linear luminance ratio to its top after byte rounding.
  const steps = [
    ["top", "topTurned", TONE_STEPS.turned],
    ["top", "wallLeft", TONE_STEPS.wallLeft],
    ["top", "wallRight", TONE_STEPS.wallRight],
    ["top", "tailLeft", TONE_STEPS.tailLeft],
    ["top", "tailRight", TONE_STEPS.tailRight],
    ["accent", "accentTurned", TONE_STEPS.turned],
    ["accent", "accentLeft", TONE_STEPS.wallLeft],
    ["accent", "accentRight", TONE_STEPS.wallRight],
  ] as const;
  for (const { id, paint } of SCHEMES) {
    for (const [top, slot, level] of steps) {
      if (id === "classic" && top === "top") continue;
      const actual = luminance(paint[slot]) / luminance(paint[top]);
      assert(Math.abs(actual - linear(level)) < 0.02, `${id} ${slot}`);
    }
    if (id !== "classic") {
      const skirt = luminance(paint.skirt) / luminance(paint.top);
      assert(Math.abs(skirt - luminance("#abbfce")) < 0.006, `${id} skirt`);
    }
  }
  assert.deepEqual([FRAME, DISPLAY, UP], [96, 42, 40]);
});

function mask(yaw: number) {
  const image = blankImage(288, 288);
  paintShip(
    image,
    drawn(48, classic.paint, { yaw }).map(({ color, outline }) => ({
      color,
      outline: outline.map(([x, y]) => [x * 3, y * 3] as const),
    })),
  );
  return Array.from({ length: 288 * 288 }, (_, i) => image.data[i * 4 + 3]! > 0);
}

test("actual opaque render has mirrored outer coverage at matched opposing views", () => {
  for (const yaw of [22.5, 33.75, 112.5, 168.75, 202.5, 292.5].map(worldView)) {
    const a = mask(yaw),
      b = mask((SHIP_HEADINGS / 4 - yaw + SHIP_HEADINGS) % SHIP_HEADINGS);
    let different = 0;
    for (let y = 0; y < 288; y++)
      for (let x = 0; x < 288; x++) if (a[y * 288 + x] !== b[y * 288 + 287 - x]) different++;
    assert.equal(
      different,
      0,
      `heading ${yaw} outer silhouette must reflect about the projected centreline`,
    );
  }
});

test("the opaque hull and canopy leave no enclosed background slivers", () => {
  for (const yaw of [22.5, 33.75, 112.5, 168.75, 202.5, 292.5].map(worldView)) {
    const filled = mask(yaw),
      exterior = new Set<number>(),
      queue = [0];
    for (let at = 0; at < queue.length; at++) {
      const p = queue[at]!;
      if (filled[p] || exterior.has(p)) continue;
      exterior.add(p);
      const x = p % 288,
        y = Math.floor(p / 288);
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nx = x + dx,
          ny = y + dy;
        if (
          nx >= 0 &&
          nx < 288 &&
          ny >= 0 &&
          ny < 288 &&
          !filled[ny * 288 + nx] &&
          !exterior.has(ny * 288 + nx)
        )
          queue.push(ny * 288 + nx);
      }
    }
    assert.equal(
      filled.filter((value, i) => !value && !exterior.has(i)).length,
      0,
      `heading ${yaw} contains an unintended transparent hole`,
    );
  }
});

test("one light from the upper left tones every heading in the declared slots", () => {
  const roles = Object.fromEntries(PAINT_SLOTS.map((slot) => [slot, slot])) as typeof classic.paint;
  const seen = new Set<string>();
  for (const yaw of ALL) {
    const slots = new Set(drawn(48, roles, { yaw }).map(({ color }) => color));
    for (const slot of slots) {
      assert(PAINT_SLOTS.includes(slot as (typeof PAINT_SLOTS)[number]));
      seen.add(slot);
    }
    // Every heading shows the canopy roof, the wing top and a tip cap.
    assert(slots.has("canopyRoof"), `heading ${yaw} canopy`);
    assert(slots.has("top") || slots.has("topTurned"), `heading ${yaw} wing top`);
    assert(
      ["accent", "accentTurned", "accentLeft", "accentRight"].some((slot) => slots.has(slot)),
      `heading ${yaw} tip cap`,
    );
  }
  assert.deepEqual([...seen].sort(), [...PAINT_SLOTS].sort());
  // Head on, the ridge parts the lit wing top from the turned one.
  const headOn = new Set(drawn(48, roles, { yaw: 8 }).map(({ color }) => color));
  assert(headOn.has("top") && headOn.has("topTurned"));
});

test("the tail rises from the ridge 2 units behind the canopy's rear edge", () => {
  const { apex, nose, shoulder } = shipVertices();
  const { centre, along } = CANOPY;
  assert.equal(shoulder[1], centre + along + 2);
  // On the ridge line from the nose through (0, 6, 9.5), so the wing tops keep their plane.
  assert(Math.abs((shoulder[2] - nose[2]) / (shoulder[1] - nose[1]) - 8.3 / 38) < 1e-12);
  assert.deepEqual(apex, [0, 17, 16.5]);
});

// Canopy samples, at 8 per frame px on each axis, whose topmost drawn fragment is a tail face.
function canopyUnderTail(frame: number, pose: Parameters<typeof drawnParts>[1]): number {
  const SS = 8;
  const W = frame * SS;
  const top = new Int8Array(W * W).fill(-1);
  const glass = new Uint8Array(W * W);
  const tail = new Set(["steep", "block", "wall", "mouth--1", "mouth-1"]);
  for (const { outline, part } of drawnParts(frame / 2, pose)) {
    const kind = part === "bubble" || part === "lip" ? 0 : tail.has(part) ? 1 : 2;
    const ys = outline.map(([, y]) => y * SS);
    for (
      let y = Math.max(0, Math.floor(Math.min(...ys)));
      y <= Math.min(W - 1, Math.ceil(Math.max(...ys)));
      y++
    ) {
      const centre = y + 0.5;
      const xs: number[] = [];
      for (const [i, a] of outline.entries()) {
        const b = outline[(i + 1) % outline.length]!;
        const [ay, by] = [a[1] * SS, b[1] * SS];
        if (ay <= centre !== by <= centre) {
          xs.push((a[0] + ((centre - ay) / (by - ay)) * (b[0] - a[0])) * SS);
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const to = Math.min(W, Math.ceil(xs[i + 1]! - 0.5));
        for (let x = Math.max(0, Math.ceil(xs[i]! - 0.5)); x < to; x++) {
          top[y * W + x] = kind;
          if (kind === 0) glass[y * W + x] = 1;
        }
      }
    }
  }
  return top.reduce((n, kind, i) => n + (glass[i] && kind === 1 ? 1 : 0), 0);
}

// Samples, at 8 per frame px, that a closing of the drawn canopy by a 0.5 frame px disk adds:
// the area of every concave nick any face (or the background) cuts into its outline.
function canopyNicks(frame: number, pose: Parameters<typeof drawnParts>[1]): number {
  const SS = 8;
  const R = 4;
  const W = frame * SS;
  const glass = new Uint8Array(W * W);
  for (const { outline, part } of drawnParts(frame / 2, pose)) {
    const value = part === "bubble" || part === "lip" ? 1 : 0;
    const ys = outline.map(([, y]) => y * SS);
    for (
      let y = Math.max(0, Math.floor(Math.min(...ys)));
      y <= Math.min(W - 1, Math.ceil(Math.max(...ys)));
      y++
    ) {
      const centre = y + 0.5;
      const xs: number[] = [];
      for (const [i, a] of outline.entries()) {
        const b = outline[(i + 1) % outline.length]!;
        const [ay, by] = [a[1] * SS, b[1] * SS];
        if (ay <= centre !== by <= centre) {
          xs.push((a[0] + ((centre - ay) / (by - ay)) * (b[0] - a[0])) * SS);
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const to = Math.min(W, Math.ceil(xs[i + 1]! - 0.5));
        for (let x = Math.max(0, Math.ceil(xs[i]! - 0.5)); x < to; x++) glass[y * W + x] = value;
      }
    }
  }
  let [x0, y0, x1, y1] = [W, W, 0, 0];
  glass.forEach((v, i) => {
    if (!v) return;
    const [x, y] = [i % W, Math.floor(i / W)];
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  });
  const disk: [number, number][] = [];
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R) disk.push([dx, dy]);
  const morph = (source: Uint8Array, grow: boolean) => {
    const result = new Uint8Array(source.length);
    for (let y = y0 - 2 * R; y <= y1 + 2 * R; y++)
      for (let x = x0 - 2 * R; x <= x1 + 2 * R; x++) {
        const hit = disk.some(([dx, dy]) => source[(y + dy) * W + x + dx] === (grow ? 1 : 0));
        result[y * W + x] = grow === hit ? 1 : 0;
      }
    return result;
  };
  const closed = morph(morph(glass, true), false);
  return closed.reduce((n, v, i) => n + (v && !glass[i] ? 1 : 0), 0);
}

test("the canopy's outline has no nick at any heading or jump pose", () => {
  // One sample is the polygon tessellation's own step.
  for (const yaw of ALL) assert(canopyNicks(FRAME, { yaw }) <= 1, `heading ${yaw}`);
  for (const { id, ...shape } of WARP_POSES) {
    assert(canopyNicks(WARP_FRAME, { ...shape, yaw: WARP_HEADING }) <= 1, `jump pose ${id}`);
  }
});

test("no tail face covers the canopy at any heading or jump pose", () => {
  for (const yaw of ALL) assert.equal(canopyUnderTail(FRAME, { yaw }), 0, `heading ${yaw}`);
  for (const { id, ...shape } of WARP_POSES) {
    assert.equal(
      canopyUnderTail(WARP_FRAME, { ...shape, yaw: WARP_HEADING }),
      0,
      `jump pose ${id}`,
    );
  }
});

test("the tip caps are the outer 28 percent of each half span", () => {
  const span = retroMouthAxis(1).corner[0];
  assert.equal(span, 21.44);
  assert.equal(TIP_CAP_X, 15.4);
  assert.equal(Math.round(((span - TIP_CAP_X) / span) * 100), 28);
});

test("the canopy has three flat bands with the approved shade steps", () => {
  for (const { id, paint } of SCHEMES) {
    const [highlightL, roofL, shadeL] = [
      paint.canopyHighlight,
      paint.canopyRoof,
      paint.canopyShade,
    ].map((colour) => toOklab(rgb(colour))[0]);
    assert(highlightL! > roofL!, `${id} highlight is lighter than its roof`);
    assert(shadeL! < roofL!, `${id} shade is darker than its roof`);
    if (id === "iris") {
      // The bright green roof keeps the violet glazing reference for its mouth.
      assert.equal(paint.canopyShade, "#5b865e");
    } else {
      assert(roofL! - shadeL! < 0.08, `${id} shade is a soft step`);
    }
  }
});

test("engine openings keep Classic's luminous brightness and paint-derived hues", () => {
  assert.equal(classic.canopySides, ENGINE_MATERIAL_RELATIONSHIPS.referenceWall);
  assert.deepEqual(
    SCHEMES.map(({ paint }) => paint.engineOpening),
    ["#86deff", "#e4f6ff", "#ffd4c0", "#dac3ff", "#b0d3ff", "#82e0fa"],
  );
});

type Mouth = { anchor: number[]; axis: number[]; half: number[]; occluders?: number[][][] };
type Jets = {
  engineLevels: { level: number; layers: { name: string; width: number; length: number }[] }[];
  frame: number;
  headings: { index: number; mouths: Mouth[] }[];
  length: { base: number; exponent: number; scale: number };
  profile: number[][];
};

test("forward plumes root at the mouth centres with three layers and the hull regions over them", () => {
  const jets = JSON.parse(readFileSync(new URL("ship-jets.json", assets), "utf8")) as Jets;
  assert.equal(jets.frame, FRAME);
  assert.deepEqual(jets.length, JET_LENGTH);
  assert.deepEqual(jets.profile, JET_PROFILE);
  assert.deepEqual(
    jets.engineLevels,
    JET_LEVELS.map((entry) => ({ level: entry.level, layers: jetLayers(entry) })),
  );
  for (const { layers } of jets.engineLevels) {
    assert.deepEqual(
      layers.map(({ length, name, width }) => ({ length, name, width })),
      [
        { length: 1.1, name: "halo", width: 5.8 },
        { length: 1, name: "outer", width: 4.2 },
        { length: 0.55, name: "core", width: 1.6 },
      ],
    );
  }
  for (const sign of [-1, 1]) {
    const root = plumeRoot(sign);
    assert.equal(root[0], sign * 12.25);
    assert.equal(root[2], 2.2);
  }
  const reach = plumeReach(JET_LENGTH.base + JET_LENGTH.scale);
  for (const heading of jets.headings) {
    assert.deepEqual(heading.mouths, forwardJetMouths(FRAME / 2, { yaw: heading.index }, reach));
    for (const [index, mouth] of heading.mouths.entries()) {
      assert.deepEqual(
        mouth.anchor,
        anchor(SHIP_HEADINGS, FRAME / 2, heading.index, plumeRoot(index === 0 ? -1 : 1)),
      );
      assert.deepEqual(mouth.axis, vector(SHIP_HEADINGS, heading.index, [0, 1, 0]));
      assert(Array.isArray(mouth.occluders));
      for (const key of ["normalAperture", "outerCorner", "coreOutboard", "rearClip"]) {
        assert(!(key in mouth));
      }
    }
  }
  // Head on, the hull hides both plume roots.
  assert(jets.headings[8]!.mouths.every((mouth) => mouth.occluders!.length > 0));
});

test("the start screen's plumes run 1.3 times as long from the bottom of each lit mouth", () => {
  const title = JSON.parse(readFileSync(new URL("title-screen.json", assets), "utf8")) as {
    ship: { frame: number; jetLengthScale: number; jetMouths: Mouth[] };
  };
  const flight = JSON.parse(readFileSync(new URL("ship-jets.json", assets), "utf8")) as Jets;
  assert.equal(title.ship.jetLengthScale, 1.3);
  assert.deepEqual(
    title.ship.jetMouths,
    mouthEdgeJetMouths(
      FRAME / 2,
      { yaw: title.ship.frame },
      plumeReach((JET_LENGTH.base + JET_LENGTH.scale) * 1.3),
    ),
  );
  // The flight's angle and on-screen width; only the start line moves.
  title.ship.jetMouths.forEach((mouth, index) => {
    const own = flight.headings[title.ship.frame]!.mouths[index]!;
    assert.deepEqual(mouth.axis, own.axis);
    const [ax, ay] = mouth.axis as [number, number];
    const across = Math.abs(mouth.half[0]! * ay - mouth.half[1]! * ax) / Math.hypot(ax, ay);
    assert(Math.abs(across - Math.hypot(own.half[0]!, own.half[1]!)) < 0.002);
  });
});

test("only the halo draws under the hull and on the 42 px flight sprite alone", () => {
  for (const file of ["ship-jets.json", "ship-retro-jets.json"]) {
    const jets = JSON.parse(readFileSync(new URL(file, assets), "utf8")) as {
      engineLevels: { layers: (PlumeLayer & { name: string })[] }[];
    };
    for (const { layers } of jets.engineLevels) {
      for (const layer of layers) {
        const halo = layer.name === "halo";
        assert.equal(layer.underHull, halo ? true : undefined, `${file} ${layer.name}`);
        assert.equal(layer.maxDisplay, halo ? DISPLAY : undefined, `${file} ${layer.name}`);
      }
      assert.deepEqual(
        layersAt(layers, 280).map(({ name }) => name),
        ["outer", "core"],
      );
      assert.equal(layersAt(layers, DISPLAY).length, 3);
    }
  }
});

// Whether a point lies in a simple polygon, by crossings to its right.
function inside([x, y]: readonly number[], polygon: readonly (readonly number[])[]): boolean {
  let crossings = 0;
  for (const [i, a] of polygon.entries()) {
    const b = polygon[(i + 1) % polygon.length]!;
    if (a[1]! <= y !== b[1]! <= y) {
      if (a[0]! + ((y - a[1]!) * (b[0]! - a[0]!)) / (b[1]! - a[1]!) > x) crossings++;
    }
  }
  return crossings % 2 === 1;
}

test("the start screen's lower plume draws over the tail and the upper one under it", () => {
  const jets = JSON.parse(readFileSync(new URL("ship-jets.json", assets), "utf8")) as Jets;
  const title = JSON.parse(readFileSync(new URL("title-screen.json", assets), "utf8")) as {
    ship: { frame: number; jetSpeed: number };
  };
  const length = jetLength(jets.length, title.ship.jetSpeed);
  const mouths = jets.headings[title.ship.frame]!.mouths;
  const covered = (mouth: Mouth) =>
    plumePolygon(JET_PROFILE, mouth as PlumeMouth, { length: 1.1, width: 5.8 }, length)
      .slice(2, 2 * JET_PROFILE.length - 3)
      .filter((point) => mouth.occluders!.some((polygon) => inside(point, polygon))).length;
  const lower = mouths.reduce((a, b) => (a.anchor[1]! > b.anchor[1]! ? a : b));
  const upper = mouths.find((mouth) => mouth !== lower)!;
  assert.equal(covered(lower), 0);
  assert(upper.occluders!.length > 0);
});

test("the forward mouth geometry is the published mouths without their occluders", () => {
  const reach = plumeReach(JET_LENGTH.base + JET_LENGTH.scale);
  for (const yaw of ALL) {
    assert.deepEqual(
      forwardJetMouthGeometry(FRAME / 2, { yaw }),
      forwardJetMouths(FRAME / 2, { yaw }, reach).map(({ anchor, axis, half }) => ({
        anchor,
        axis,
        half,
      })),
    );
  }
});

test("a plume layer is a closed teardrop from its root to a point", () => {
  const mouth = { anchor: [10, 20], axis: [0, 1], half: [1, 0] } as const;
  const points = plumePolygon(JET_PROFILE, mouth, { length: 1, width: 5.8 }, 30);
  assert.equal(points.length, 2 * JET_PROFILE.length - 1);
  const root = JET_PROFILE[0][1];
  assert.deepEqual(points[0], [10 + root * 5.8, 20]);
  assert.deepEqual(points[JET_PROFILE.length - 1], [10, 50]);
  assert.deepEqual(points.at(-1), [10 - root * 5.8, 20]);
  assert(Math.abs(Math.max(...points.map(([x]) => Math.abs(x - 10))) - 5.8) < 1e-12);
});

test("reverse plumes leave the wing tips ahead of the trailing edge and outreach the forward plumes", () => {
  const jets = JSON.parse(readFileSync(new URL("ship-retro-jets.json", assets), "utf8")) as Jets;
  assert.deepEqual(jets.length, { base: 14.85, scale: 23.1, exponent: 1 });
  assert.equal(RETRO_JET.reach, 1);
  assert(jetLength(jets.length, 1) > jetLength(JET_LENGTH, 1));
  assert.deepEqual(jets.profile, JET_PROFILE);
  assert.deepEqual(
    jets.engineLevels.map(({ layers }) => layers.map(({ length, width }) => [length, width])),
    [1, 2, 3].map(() => [
      [1.1, 2.9],
      [1, 2.1],
      [0.55, 0.8],
    ]),
  );
  assert(!("reverseStyle" in jets));
  const plume = { halfWidth: 2.9, rootShare: JET_PROFILE[0][1] };
  for (const heading of jets.headings) {
    const roots = [-1, 1].map((sign) => retroRoot({ yaw: heading.index }, plume, sign));
    // One wing's plume at the skirt bottom, the other's at its top, unless both wings are level.
    assert(roots.some(([, , z]) => z === 0));
    for (const [index, mouth] of heading.mouths.entries()) {
      const sign = index === 0 ? -1 : 1;
      const model = retroMouthAxis(sign);
      const root = roots[index]!;
      assert.deepEqual(mouth.anchor, anchor(SHIP_HEADINGS, FRAME / 2, heading.index, root));
      assert.deepEqual(mouth.axis, vector(SHIP_HEADINGS, heading.index, model.axis));
      assert.deepEqual(mouth.half, plumeSide({ yaw: heading.index }, model.axis, model.side));
      assert.deepEqual(Object.keys(mouth).sort(), ["anchor", "axis", "half"]);
      // The widest outboard flank passes the wing tip, and the inboard root corner sits on the
      // trailing edge from the notch (5.44, 15.68) to the tip (21.44, 20.48).
      const [tipX, tipY] = model.corner;
      assert.equal(Math.abs(tipX), 21.44);
      const flank = root[0] + model.side[0] * plume.halfWidth;
      assert(sign * flank > 21.44 - 1e-9);
      const inboard = plume.halfWidth * plume.rootShare;
      const corner = [root[0] - model.side[0] * inboard, root[1] - model.side[1] * inboard];
      const edge = tipY - 0.3 * (21.44 - sign * corner[0]!);
      assert(Math.abs(corner[1]! - edge) < 1e-9);
    }
  }
});

test("light fields carry the same three layers in their own colours", () => {
  const galaxies = JSON.parse(readFileSync(new URL("galaxies.json", assets), "utf8")) as {
    lightField: { jets: { shipLevels: unknown } };
  };
  assert.deepEqual(
    galaxies.lightField.jets.shipLevels,
    LIGHT_FIELD_JET_LEVELS.map((entry) => ({ level: entry.level, layers: jetLayers(entry) })),
  );
});

test("warp poses publish projected plume roots without scaling authored thrust twice", () => {
  const { warp } = JSON.parse(readFileSync(new URL("quantum-jump.json", assets), "utf8")) as {
    warp: {
      frame: number;
      heading: number;
      displayScale: number;
      poses: {
        roll: number;
        squash: number;
        stretch: number;
        thrust: boolean;
        paths: Record<string, string>;
        jets?: {
          frame: number;
          length: typeof AUTHORED_JET_CURVE;
          headings: { index: number; mouths: ReturnType<typeof forwardJetMouths> }[];
        };
      }[];
    };
  };
  assert.equal(warp.frame, 256);
  assert.equal(warp.heading, 48);
  assert.equal(warp.displayScale, DISPLAY / FRAME);
  assert.equal(warp.poses.length, 9);
  assert.equal(warp.poses.filter((pose) => pose.jets).length, 7);
  assert.equal(AUTHORED_JET_LENGTH, 16);
  for (const pose of warp.poses) {
    assert.deepEqual(
      Object.keys(pose.paths),
      SCHEMES.map(({ id }) => id),
    );
    if (!pose.thrust) {
      assert.equal(pose.jets, undefined, "idle poses must not acquire exhaust");
      continue;
    }
    assert.equal(pose.jets!.frame, warp.frame);
    assert.deepEqual(pose.jets!.length, AUTHORED_JET_CURVE);
    assert.deepEqual(pose.jets!.headings, [
      {
        index: 0,
        mouths: forwardJetMouths(
          warp.frame / 2,
          { roll: pose.roll, squash: pose.squash, stretch: pose.stretch, yaw: warp.heading },
          plumeReach(AUTHORED_JET_LENGTH),
        ),
      },
    ]);
  }
});

test("the active player package publishes one complete 64-heading contract without changing enemy or archive counts", () => {
  assert.equal(SHIP_HEADINGS, 64);
  assert.equal(ENEMY_HEADINGS, 16);
  assert.equal(SHIP_HEADINGS / ENEMY_HEADINGS, 4);
  for (const file of [
    "manifest.json",
    "ship-nose.json",
    "ship-jets.json",
    "ship-retro-jets.json",
    "title-screen.json",
    "quantum-jump.json",
  ]) {
    const data = JSON.parse(readFileSync(new URL(file, assets), "utf8"));
    assert.equal(data.version, 1);
    assert.deepEqual(data.shipHeadings, SHIP_HEADING_CONTRACT);
    if (file === "ship-nose.json") {
      assert.equal(data.noses.length, SHIP_HEADINGS);
      assert.equal(data.collision.length, SHIP_HEADINGS);
    }
    if (["ship-jets.json", "ship-retro-jets.json"].includes(file))
      assert.deepEqual(
        data.headings.map((h: { index: number }) => h.index),
        Array.from({ length: SHIP_HEADINGS }, (_, index) => index),
      );
  }
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", assets), "utf8")) as {
    assets: { id: string; paint?: string; directionIndex?: number }[];
  };
  for (const scheme of SCHEMES) {
    const frames = manifest.assets.filter((a) =>
      scheme.id === "classic" ? /^ship-\d+$/.test(a.id) && !a.paint : a.paint === scheme.id,
    );
    assert.deepEqual(
      frames.map((a) => a.directionIndex),
      Array.from({ length: SHIP_HEADINGS }, (_, index) => index),
    );
  }
  const archive = JSON.parse(
    readFileSync(new URL("../sources/ship-retro-jets-yellow.json", import.meta.url), "utf8"),
  );
  assert.equal(archive.version, 1);
  assert.equal(archive.headings.length, 32);
});
