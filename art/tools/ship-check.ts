import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { blankImage } from "@andornaut/art-kit/build/rgbaImage";

import {
  classic,
  DISPLAY,
  drawn,
  ENGINE_MATERIAL_RELATIONSHIPS,
  engineOpeningGeometry,
  ENGINE_OPENING_SCALE,
  FRAME,
  forwardJetMouths,
  jetAttachment,
  normalJetStation,
  SCHEMES,
  UP,
} from "./ship-model.ts";
import { AUTHORED_JET_CURVE, AUTHORED_JET_LENGTH } from "./ship-jet-svg.ts";
import { paintShip } from "./ship-raster.ts";
import { svgPaths } from "./ship-paths.ts";
import { rgb, toOklab } from "./oklab.ts";
import {
  ENEMY_HEADINGS,
  projectAt,
  rotate,
  SHIP_HEADINGS,
  SHIP_HEADING_CONTRACT,
} from "./projection.ts";

const assets = new URL("../../public/art/", import.meta.url);
const worldView = (degrees: number) => (degrees * SHIP_HEADINGS) / 360;

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

test("exported Classic materials and purchased paint ratios match their contracts", () => {
  const metadata = JSON.parse(readFileSync(new URL("ship-paint.json", assets), "utf8")) as {
    schemes: { id: string; name: string; top: string; price?: number }[];
  };
  assert.deepEqual(
    metadata.schemes.map(({ id }) => id),
    ["classic", "cobalt", "seafoam", "graphite", "iris", "amber"],
  );
  assert.deepEqual(
    metadata.schemes.map(({ id, name, top }) => ({ id, name, top })),
    SCHEMES.map(({ id, name, paint }) => ({ id, name, top: paint.top })),
  );
  assert.equal(metadata.schemes.find(({ id }) => id === "amber")!.top, "#f4b665");
  assert(metadata.schemes.every((scheme) => scheme.price === undefined));
  assert.equal(classic.paint.frontSides, "#929ca3");
  assert.equal(classic.paint.rearSides, "#28558a");
  for (const { id, paint } of SCHEMES) {
    const exported = metadata.schemes.find((scheme) => scheme.id === id)!;
    for (const [material, color] of Object.entries(paint))
      assert.equal(exported[material as keyof typeof exported], color);
  }
  const purchasedRatios = { frontSides: "#b2bec6", rearSides: "#647d8d", skirt: "#abbfce" };
  for (const { paint } of SCHEMES.filter(({ id }) => id !== "classic"))
    for (const tier of ["frontSides", "rearSides", "skirt"] as const) {
      const expected = luminance(purchasedRatios[tier]);
      const actual = luminance(paint[tier]) / luminance(paint.top);
      assert(
        Math.abs(actual - expected) < 0.006,
        `${tier} must preserve the luminance ratio after byte rounding`,
      );
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

const contains = (points: readonly (readonly number[])[], [x, y]: readonly number[]) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!,
      b = points[j]!;
    if (
      a[1]! > y! !== b[1]! > y! &&
      x! < ((b[0]! - a[0]!) * (y! - a[1]!)) / (b[1]! - a[1]!) + a[0]!
    )
      inside = !inside;
  }
  return inside;
};

test("title jet anchors land inside the actual visible rear mouth regions", () => {
  const jets = JSON.parse(readFileSync(new URL("ship-jets.json", assets), "utf8")) as {
    frame: number;
    headings: { index: number; mouths: { anchor: number[]; occluders?: number[][][] }[] }[];
  };
  assert.equal(jets.frame, FRAME);
  assert.equal(jets.headings.length, SHIP_HEADINGS);
  const mouths = drawn(48, classic.paint, { yaw: worldView(292.5) }).filter(
    ({ color }) => color === classic.paint.engineOpening,
  );
  for (const mouth of jets.headings.find(({ index }) => index === worldView(292.5))!.mouths) {
    assert(
      mouths.some(({ outline }) => contains(outline, mouth.anchor)),
      "anchor must originate on an actual cyan engine opening",
    );
    assert(Array.isArray(mouth.occluders));
    for (const polygon of mouth.occluders!)
      assert(
        polygon.length >= 3 && polygon.every((p) => p.length === 2 && p.every(Number.isFinite)),
      );
  }
});

test("engine openings use Classic luminous brightness and paint-derived hues with unchanged glazing", () => {
  assert.equal(classic.paint.canopySides, "#1767b3");
  assert.equal(classic.paint.canopyRoof, "#2585d0");
  assert.equal(classic.paint.engineOpening, "#86deff");
  const measure = (color: string) => {
    const [L, a, b] = toOklab(rgb(color));
    return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) };
  };
  const reference = measure(ENGINE_MATERIAL_RELATIONSHIPS.referenceOpening);
  const glazingReference = measure(classic.paint.canopySides);
  const approved = ["#86deff", "#e4f6ff", "#80e5db", "#dac3ff", "#b0d3ff", "#82e0fa"];
  for (const [index, { paint }] of SCHEMES.entries()) {
    const glazingL = toOklab(rgb(paint.canopySides))[0];
    const housingL = toOklab(rgb(paint.engineHousing))[0];
    const openingL = toOklab(rgb(paint.engineOpening))[0];
    assert(housingL > glazingL, "housing must be lighter than its unchanged glazing reference");
    assert(openingL > housingL, "opening must remain lighter than its housing");
    assert.equal(
      paint.engineOpening,
      approved[index],
      "opening must match the approved shared-reference preview",
    );
    const opening = measure(paint.engineOpening);
    assert(opening.L >= reference.L - 0.002, "paint must not inherit a dim opening lightness");
    assert(opening.C <= reference.C + 0.001, "gamut mapping must not increase target chroma");
    const hue = reference.h + measure(paint.canopySides).h - glazingReference.h;
    const hueError = Math.abs(Math.atan2(Math.sin(opening.h - hue), Math.cos(opening.h - hue)));
    assert(
      hueError < (2 * Math.PI) / 180,
      "gamut mapping must preserve paint hue within byte quantization",
    );
  }
});

test("normal apertures share flush opening centres and contained physical widths", () => {
  const jets = JSON.parse(readFileSync(new URL("ship-jets.json", assets), "utf8")) as {
    headings: {
      index: number;
      mouths: {
        anchor: number[];
        half: number[];
        axis: number[];
        normalAperture: { coreWidth: number };
        occluders: unknown[];
        outerCorner?: unknown;
        coreOutboard?: unknown;
        rearClip?: unknown;
      }[];
    }[];
  };
  assert.equal(jetAttachment(worldView(135), -1).corner[2], 0);
  assert.equal(jetAttachment(worldView(135), 1).corner[2], 1.2);
  for (const heading of jets.headings) {
    for (const [index, mouth] of heading.mouths.entries()) {
      const sign = index === 0 ? -1 : 1;
      const station = normalJetStation({ yaw: heading.index }, sign);
      assert.deepEqual(station.middle, engineOpeningGeometry(sign).centre);
      assert(Math.abs(station.width - 18.72) < 1e-12);
      assert(Math.abs(station.coreWidth * station.width - 6.875) < 1e-12);
      assert(Math.abs(Math.abs(station.middle[0]) - 12.25) < 1e-12);
      assert(Math.abs(mouth.normalAperture.coreWidth - 6.875 / 18.72) < 1e-12);
      assert.deepEqual(mouth.occluders, [], "normal triangles must have no visible mask kink");
      assert.equal(mouth.outerCorner, undefined);
      assert.equal(mouth.coreOutboard, undefined);
      assert.equal(mouth.rearClip, undefined);
    }
  }
});

test("the luminous aperture grows 25 percent about its centre and stays inside its housing", () => {
  const dot = (a: readonly number[], b: readonly number[]) =>
    a.reduce((sum, value, index) => sum + value * b[index]!, 0);
  const minus = (a: readonly number[], b: readonly number[]) =>
    a.map((value, index) => value - b[index]!);
  const area = (points: readonly (readonly number[])[]) => {
    const normal = [0, 0, 0];
    for (const [i, a] of points.entries()) {
      const b = points[(i + 1) % points.length]!;
      normal[0]! += (a[1]! - b[1]!) * (a[2]! + b[2]!);
      normal[1]! += (a[2]! - b[2]!) * (a[0]! + b[0]!);
      normal[2]! += (a[0]! - b[0]!) * (a[1]! + b[1]!);
    }
    return Math.hypot(...normal) / 2;
  };
  assert.equal(ENGINE_OPENING_SCALE, 1.25);
  for (const sign of [-1, 1]) {
    const { original, points, centre, housing } = engineOpeningGeometry(sign);
    for (let k = 0; k < 3; k++) {
      assert(
        Math.abs(points.reduce((sum, p) => sum + p[k]! / points.length, 0) - centre[k]!) < 1e-12,
      );
      for (let i = 0; i < points.length; i++)
        assert(
          Math.abs(points[i]![k]! - centre[k]! - 1.25 * (original[i]![k]! - centre[k]!)) < 1e-12,
        );
    }
    assert(Math.abs(area(points) / area(original) - 1.5625) < 1e-12);
    const a = housing[0]!,
      u = minus(housing[1]!, a),
      v = minus(housing[2]!, a);
    const uu = dot(u, u),
      uv = dot(u, v),
      vv = dot(v, v),
      denominator = uu * vv - uv * uv;
    for (const p of points) {
      const w = minus(p, a),
        wu = dot(w, u),
        wv = dot(w, v);
      const b = (vv * wu - uv * wv) / denominator,
        c = (uu * wv - uv * wu) / denominator;
      assert(Math.min(1 - b - c, b, c) > 0, "enlarged aperture must retain housing margins");
    }
  }
});

test("warp poses publish projected uncut groups without scaling authored thrust twice", () => {
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
        mouths: forwardJetMouths(warp.frame / 2, { ...pose, yaw: warp.heading }),
      },
    ]);
    for (const mouth of pose.jets!.headings[0]!.mouths) {
      assert(Math.abs(mouth.normalAperture.coreWidth - 6.875 / 18.72) < 1e-12);
      assert.deepEqual(mouth.occluders, []);
      assert(!("rearClip" in mouth), "forward warp groups must remain uncut");
    }
  }
});

test("enlarged luminous openings stay within the housing at grazing views", () => {
  const inside = (polygon: readonly (readonly number[])[], p: readonly number[]) => {
    const distances = polygon.map((a, i) => {
      const b = polygon[(i + 1) % polygon.length]!;
      return (b[0]! - a[0]!) * (p[1]! - a[1]!) - (b[1]! - a[1]!) * (p[0]! - a[0]!);
    });
    return distances.every((d) => d >= -1e-7) || distances.every((d) => d <= 1e-7);
  };
  for (let yaw = 0; yaw < SHIP_HEADINGS; yaw++) {
    const housings = [-1, 1].map((sign) =>
      engineOpeningGeometry(sign).housing.map((p) =>
        projectAt(48, 48, rotate(SHIP_HEADINGS, yaw, p)),
      ),
    );
    for (const opening of drawn(48, classic.paint, { yaw }).filter(
      (f) => f.color === classic.paint.engineOpening,
    ))
      assert(housings.some((housing) => opening.outline.every((p) => inside(housing, p))));
  }
  const image = blankImage(96, 96);
  paintShip(image, drawn(48, classic.paint, { yaw: worldView(146.25) }));
  assert.equal(
    image.data[(58 * 96 + 66) * 4 + 3],
    0,
    "raised aperture must not add an exterior hull pixel",
  );
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
  const archive = JSON.parse(readFileSync(new URL("ship-retro-jets-yellow.json", assets), "utf8"));
  assert.equal(archive.version, 1);
  assert.equal(archive.headings.length, 32);
});
