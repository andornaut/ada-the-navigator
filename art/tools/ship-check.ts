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
  JET_SHAPE,
  jetLayers,
  LIGHT_FIELD_JET_LEVELS,
  RETRO_JET,
} from "./ship-jet-layers.ts";
import { AUTHORED_JET_CURVE, AUTHORED_JET_LENGTH } from "./ship-jet-svg.ts";
import {
  classic,
  DISPLAY,
  drawn,
  ENGINE_MATERIAL_RELATIONSHIPS,
  forwardJetMouths,
  FRAME,
  PAINT_SLOTS,
  plumeRoot,
  retroMouthAxis,
  SCHEMES,
  TIP_CAP_X,
  TONE_STEPS,
  UP,
} from "./ship-model.ts";
import { svgPaths } from "./ship-paths.ts";
import { plumePolygon } from "./ship-plume.ts";
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
      "#7890ad",
      "#4d6584",
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
    ["#2456b8", "#16245c", "#f07a5a", "#f6efe6", "#e0489f", "#12233a"],
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

test("the tip caps are the outer 28 percent of each half span", () => {
  const span = retroMouthAxis(1).corner[0];
  assert.equal(span, 21.44);
  assert.equal(TIP_CAP_X, 15.4);
  assert.equal(Math.round(((span - TIP_CAP_X) / span) * 100), 28);
});

test("the canopy is three flat bands with a soft shade step under every paint", () => {
  for (const { id, paint } of SCHEMES) {
    const [highlightL, roofL, shadeL] = [
      paint.canopyHighlight,
      paint.canopyRoof,
      paint.canopyShade,
    ].map((colour) => toOklab(rgb(colour))[0]);
    assert(highlightL! > roofL!, `${id} highlight is lighter than its roof`);
    assert(shadeL! < roofL! && roofL! - shadeL! < 0.08, `${id} shade is a soft step`);
  }
});

test("engine openings keep Classic's luminous brightness and paint-derived hues", () => {
  assert.equal(classic.canopySides, ENGINE_MATERIAL_RELATIONSHIPS.referenceWall);
  assert.deepEqual(
    SCHEMES.map(({ paint }) => paint.engineOpening),
    ["#86deff", "#e4f6ff", "#80e5db", "#dac3ff", "#b0d3ff", "#82e0fa"],
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

test("forward plumes root at the mouth centres with two layers and the hull regions over them", () => {
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
        { length: 1, name: "outer", width: 5.8 },
        { length: 0.5, name: "core", width: 1.6 },
      ],
    );
  }
  for (const sign of [-1, 1]) {
    const root = plumeRoot(sign);
    assert.equal(root[0], sign * 12.25);
    assert.equal(root[2], 2.2);
  }
  const reach = { halfWidth: JET_SHAPE.outer.width, length: JET_LENGTH.base + JET_LENGTH.scale };
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

test("a plume layer is a closed teardrop from its root to a point", () => {
  const mouth = { anchor: [10, 20], axis: [0, 1], half: [1, 0] } as const;
  const points = plumePolygon(JET_PROFILE, mouth, { length: 1, width: 5.8 }, 30);
  assert.equal(points.length, 2 * JET_PROFILE.length - 1);
  assert.deepEqual(points[0], [10 + 0.8 * 5.8, 20]);
  assert.deepEqual(points[JET_PROFILE.length - 1], [10, 50]);
  assert.deepEqual(points.at(-1), [10 - 0.8 * 5.8, 20]);
  assert.equal(Math.max(...points.map(([x]) => Math.abs(x - 10))), 5.8);
});

test("reverse plumes root under the wing tips at half the earlier reach", () => {
  const jets = JSON.parse(readFileSync(new URL("ship-retro-jets.json", assets), "utf8")) as Jets;
  assert.deepEqual(jets.length, { base: 7.425, scale: 11.55, exponent: 1 });
  assert.equal(RETRO_JET.reach, 0.5);
  assert.deepEqual(jets.profile, JET_PROFILE);
  assert.deepEqual(
    jets.engineLevels.map(({ layers }) => layers.map(({ width }) => width)),
    [1, 2, 3].map(() => [4.93, 1.36]),
  );
  assert(!("reverseStyle" in jets));
  for (const heading of jets.headings) {
    for (const [index, mouth] of heading.mouths.entries()) {
      const model = retroMouthAxis(index === 0 ? -1 : 1);
      assert.deepEqual(model.root, [(index === 0 ? -1 : 1) * 19.6, 17, 0.5]);
      assert.deepEqual(mouth.anchor, anchor(SHIP_HEADINGS, FRAME / 2, heading.index, model.root));
      assert.deepEqual(mouth.axis, vector(SHIP_HEADINGS, heading.index, model.axis));
      assert.deepEqual(Object.keys(mouth).sort(), ["anchor", "axis", "half"]);
    }
  }
});

test("light fields carry the same two layers in their own colours", () => {
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
          { halfWidth: JET_SHAPE.outer.width, length: AUTHORED_JET_LENGTH },
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
