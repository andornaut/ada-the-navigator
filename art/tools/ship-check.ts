import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { blankImage } from "@andornaut/art-kit/rgbaImage";

import { classic, DISPLAY, drawn, FRAME, SCHEMES, UP } from "./ship-model.ts";
import { paintShip } from "./ship-raster.ts";

const assets = new URL("../../public/art/", import.meta.url);
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
  assert.deepEqual([FRAME, DISPLAY, UP], [96, 42, 20]);
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
  for (const yaw of [2, 3, 10, 15, 18, 26]) {
    const a = mask(yaw),
      b = mask((8 - yaw + 32) % 32);
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
  for (const yaw of [2, 3, 10, 15, 18, 26]) {
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
  assert.equal(jets.headings.length, 32);
  const mouths = drawn(48, classic.paint, { yaw: 26 }).filter(({ color }) => color === "#64caff");
  for (const mouth of jets.headings.find(({ index }) => index === 26)!.mouths) {
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
