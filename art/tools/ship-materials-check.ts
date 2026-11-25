import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SHIP_HEADINGS, SHIP_HEADING_CONTRACT } from "./projection.ts";
import {
  shipMaterialGeometry,
  SHIP_MATERIAL_SLOTS,
  type ShipMaterialDraw,
} from "./ship-material-geometry.ts";
import { drawn, FRAME, PAINT_SLOTS, SCHEMES } from "./ship-model.ts";
import { svgPaths } from "./ship-paths.ts";
import { WARP_FRAME, WARP_HEADING, WARP_POSES } from "./ship-poses.ts";

const contract = shipMaterialGeometry();
const art = new URL("../../public/art/", import.meta.url);
const palette = JSON.parse(readFileSync(new URL("ship-paint.json", art), "utf8")) as {
  schemes: { id: string; [key: string]: string }[];
};

const resolved = (draws: readonly ShipMaterialDraw[], paint: (typeof palette.schemes)[number]) =>
  draws.map((draw) => ({ fill: paint[draw.slot], path: contract.paths[draw.path] }));

test("the published file is the producer's current output", () => {
  assert.deepEqual(
    JSON.parse(readFileSync(new URL("ship-materials.json", art), "utf8")),
    JSON.parse(JSON.stringify(contract)),
  );
});

test("slot draws reproduce the in-memory heading and warp drawings under every paint", () => {
  for (const paint of palette.schemes) {
    const scheme = SCHEMES.find(({ id }) => id === paint.id)!;
    for (const heading of contract.ship.headings) {
      const reference = svgPaths(drawn(FRAME / 2, scheme.paint, { yaw: heading.index })).map(
        ({ color, path }) => ({ fill: color, path }),
      );
      assert.deepEqual(resolved(heading.draws, paint), reference, `${paint.id} ${heading.index}`);
    }
    for (const pose of contract.warp.poses) {
      const authored = WARP_POSES.find(({ id }) => id === pose.id)!;
      const reference = svgPaths(
        drawn(WARP_FRAME / 2, scheme.paint, { ...authored, thrust: false, yaw: WARP_HEADING }),
      ).map(({ color, path }) => ({ fill: color, path }));
      assert.deepEqual(resolved(pose.draws, paint), reference, `${paint.id} ${pose.id}`);
    }
  }
});

test("shared geometry retains canonical headings, pivots and all authored warp poses", () => {
  assert.equal(contract.version, 2);
  assert.deepEqual(contract.shipHeadings, SHIP_HEADING_CONTRACT);
  assert.deepEqual(contract.slots, SHIP_MATERIAL_SLOTS);
  assert.deepEqual(contract.slots, PAINT_SLOTS);
  assert.equal(contract.palettePath, "/art/ship-paint.json");
  assert.equal(contract.ship.frame, 96);
  assert.equal(contract.ship.displayScale, 42 / 96);
  assert.deepEqual(contract.ship.pivot, [0.5, 0.5]);
  assert.deepEqual(
    contract.ship.headings.map(({ index }) => index),
    Array.from({ length: SHIP_HEADINGS }, (_, index) => index),
  );
  assert.equal(contract.warp.heading, WARP_HEADING);
  assert.equal(contract.warp.frame, WARP_FRAME);
  assert.equal(contract.warp.displayScale, 42 / 96);
  assert.deepEqual(contract.warp.pivot, [0.5, 0.5]);
  assert.deepEqual(
    contract.warp.poses.map(({ id }) => id),
    WARP_POSES.map(({ id }) => id),
  );
  const current = JSON.parse(readFileSync(new URL("quantum-jump.json", art), "utf8")) as {
    warp: {
      poses: { id: string; roll: number; stretch: number; squash: number; thrust: boolean }[];
    };
  };
  assert.deepEqual(
    current.warp.poses.map(({ id, roll, stretch, squash, thrust }) => ({
      id,
      roll,
      stretch,
      squash,
      thrust,
    })),
    WARP_POSES.map(({ id, roll = 0, stretch = 1, squash = 1, thrust = false }) => ({
      id,
      roll,
      stretch,
      squash,
      thrust,
    })),
  );
});

test("path references are opaque, valid and deduplicated, one path per slot", () => {
  assert.equal(new Set(contract.paths).size, contract.paths.length);
  for (const entry of [...contract.ship.headings, ...contract.warp.poses]) {
    for (const draw of entry.draws) {
      assert.equal(draw.alpha, 1);
      assert.ok(Number.isInteger(draw.path) && draw.path >= 0 && draw.path < contract.paths.length);
      assert.ok(SHIP_MATERIAL_SLOTS.includes(draw.slot));
    }
    assert.equal(new Set(entry.draws.map(({ slot }) => slot)).size, entry.draws.length);
  }
});

test("no paint gives two slots one colour, so a path per slot leaves no shared-colour seam", () => {
  for (const { id, paint } of SCHEMES) {
    const colours = PAINT_SLOTS.map((slot) => paint[slot].toLowerCase());
    assert.equal(new Set(colours).size, colours.length, id);
  }
});
