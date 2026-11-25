import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { DISPLAY_SCALE } from "./crafts.ts";
import { drawGates, drawnObjects } from "./friendly.ts";
import { GATE_AXES, GATE_RIM, WORLD_UNIT } from "./friendly-models.ts";
import { readManifest } from "./manifest.ts";
import { strictlyConvex } from "./silhouette.ts";

type Row = {
  id: string;
  path: string;
  width: number;
  height: number;
  pivot: { x: number; y: number };
  moorings?: { x: number; y: number; outward: [number, number] }[];
};
type Staged = Record<string, { assets: Row[]; data?: Record<string, string> }>;

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const staged = JSON.parse(read("../friendly-rows.json")) as Staged;
const objects = drawnObjects();
const gates = drawGates();
const isGate = (id: string) => id.startsWith("needle-gate-");

// Shipped rows whose frames the redesign splits into one row per frame.
const SPLIT: Readonly<Record<string, readonly string[]>> = {
  "holodisk-beacon": ["holodisk-beacon-a", "holodisk-beacon-b"],
  "discovery-cache": ["discovery-cache-lit-a", "discovery-cache-lit-b", "discovery-cache-hidden"],
};

test("every frame fits its frame with a margin, on a grid of 8", () => {
  for (const { name, width, height, drawn } of objects) {
    assert.equal(width % 8, 0, name);
    assert.equal(height % 8, 0, name);
    for (const { id, drawn: box } of drawn) {
      assert.ok(box[0] >= 1 && box[1] >= 1, `${id} starts inside its frame`);
      assert.ok(box[2] <= width - 1 && box[3] <= height - 1, `${id} ends inside its frame`);
    }
  }
});

test("Stardust and ore draw 14 display px tall", () => {
  for (const key of ["stardust", "oreNugget"]) {
    const [, top, , bottom] = objects.find((object) => object.key === key)!.drawn[0]!.drawn;
    assert.ok(Math.abs((bottom - top) * DISPLAY_SCALE - 14) < 0.01, key);
  }
});

test("an object's frames share one outline unless its shape changes", () => {
  for (const { key, drawn } of objects) {
    if (key === "guideBeacon") continue;
    assert.equal(new Set(drawn.map(({ silhouette }) => silhouette)).size, 1, key);
  }
});

test("each staged row replaces a shipped row or one frame of a split row", () => {
  for (const [manifest, { assets }] of Object.entries(staged)) {
    const shipped = new Set(
      readManifest(manifest as Parameters<typeof readManifest>[0]).assets.map(({ id }) => id),
    );
    const split = new Set(Object.values(SPLIT).flat());
    for (const { id } of assets) {
      assert.ok(shipped.has(id) || split.has(id), `${manifest} ${id}`);
    }
    for (const id of Object.keys(SPLIT)) {
      assert.ok(manifest !== "core" || shipped.has(id), id);
    }
  }
  assert.deepEqual(
    Object.values(staged)
      .flatMap(({ assets }) => assets.map(({ id }) => id))
      .toSorted(),
    [
      ...objects.flatMap(({ drawn }) => drawn.map(({ id }) => id)),
      ...gates.frames.map(({ id }) => id),
    ].toSorted(),
  );
});

test("every staged row names one nested root of its sheet with the row's frame", () => {
  for (const { assets } of Object.values(staged)) {
    for (const { id, path, width, height, pivot } of assets) {
      const sheet = read(`../../public${path}`);
      const roots = sheet.split(`<svg id="${id}" `).length - 1;
      assert.equal(roots, 1, id);
      assert.ok(
        sheet.includes(`width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`),
        id,
      );
      assert.ok(pivot.x > 0 && pivot.x < 1 && pivot.y > 0 && pivot.y < 1, id);
    }
  }
});

test("the sheets carry flat fills only", () => {
  for (const path of new Set(
    Object.values(staged).flatMap(({ assets }) => assets.map((row) => row.path)),
  )) {
    const sheet = read(`../../public${path}`);
    assert.doesNotMatch(sheet, /gradient|filter|opacity|stroke|<image/u, path);
  }
});

test("every pickup frame ships strictly convex collision parts inside its frame", () => {
  const file = JSON.parse(read(`../../public${staged.core!.data!.pickups}`)) as {
    frames: Record<string, { frame: [number, number]; collision: [number, number][][] }>;
  };
  const collected = objects.filter(({ collision }) => collision);
  assert.deepEqual(
    Object.keys(file.frames),
    collected.flatMap(({ drawn }) => drawn.map(({ id }) => id)),
  );
  for (const [id, { frame, collision }] of Object.entries(file.frames)) {
    assert.ok(collision.length > 0, id);
    for (const part of collision) {
      assert.ok(strictlyConvex(part), id);
      for (const [x, y] of part) {
        assert.ok(x >= 0 && x <= frame[0] && y >= 0 && y <= frame[1], id);
      }
    }
  }
});

test("the mooring buoy's three arm tips lie on its frame and point away from its hub", () => {
  for (const { id, width, height, pivot, moorings } of staged.cartwheel!.assets) {
    assert.equal(moorings?.length, 3, id);
    for (const { x, y, outward } of moorings!) {
      assert.ok(x > 0 && x < width && y > 0 && y < height, id);
      assert.ok(Math.abs(Math.hypot(...outward) - 1) < 0.002, id);
      // The tip lies outward of the hub, which draws above the pivot by the cleat's height.
      const [dx, dy] = [x - pivot.x * width, y - pivot.y * height];
      assert.ok(dx * outward[0] + dy * outward[1] > 0, id);
    }
  }
});

test("the ring gate is true to Gameplay's rim across the screen at every axis", () => {
  const shipped = JSON.parse(read("../../public/art/needle/gates.json")) as {
    opening: number;
    rim: typeof GATE_RIM;
  };
  const data = JSON.parse(read(`../../public${staged.needle!.data!.needleGates}`)) as {
    frame: number;
    opening: number;
    rim: typeof GATE_RIM;
    orientations: { extent: [number, number]; files: Record<string, Record<string, string>> }[];
  };
  assert.equal(data.opening, shipped.opening);
  assert.deepEqual(data.rim, shipped.rim);
  assert.equal(data.rim.inner * 2, data.opening);
  assert.equal(data.orientations.length, GATE_AXES.length);
  const rows = new Set(staged.needle!.assets.filter(({ id }) => isGate(id)).map(({ id }) => id));
  assert.equal(rows.size, 20);
  for (const { extent, files } of data.orientations) {
    for (const id of Object.values(files).flatMap((layers) => Object.values(layers))) {
      assert.ok(rows.has(id), id);
    }
    assert.ok(extent[0] < data.frame * DISPLAY_SCALE && extent[1] < data.frame * DISPLAY_SCALE);
  }
  // Axis 2 runs straight down the screen, so the ring's plane lies across it: the rim's outer
  // diameter draws as wide as the game draws 80 world units across the screen, 80 * sqrt(2),
  // and the collars add their reach on each side.
  const across = data.orientations[2]!.extent[0];
  const screen = Math.sqrt(1.5);
  assert.ok(Math.abs(2 * GATE_RIM.outer * WORLD_UNIT * screen - 80 * Math.SQRT2) < 1e-9);
  assert.ok(Math.abs(across - 2 * (GATE_RIM.outer * WORLD_UNIT + 4.2) * screen) < 0.2);
});

test("each ring gate layer is one closed half: the layers' outlines differ and both draw", () => {
  for (const state of ["dark", "lit"]) {
    for (let orientation = 0; orientation < GATE_AXES.length; orientation++) {
      const [back, front] = ["back", "front"].map((layer) =>
        gates.frames.find(
          (f) => f.state === state && f.orientation === orientation && f.layer === layer,
        )!,
      );
      assert.ok(back!.silhouette.length > 0 && front!.silhouette.length > 0);
      assert.notEqual(back!.silhouette, front!.silhouette);
    }
  }
});
