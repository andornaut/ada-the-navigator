import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { DISPLAY_SCALE } from "./crafts.ts";
import { drawnCrafts } from "./friendly-craft.ts";
import { WHALE_KINDS, WHALE_LOOP_FRAMES } from "./friendly-whale-models.ts";
import { drawWhale, whaleFootprint, whaleFrame } from "./friendly-whales.ts";
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
type Staged = Record<
  string,
  { assets: Row[]; data?: Record<string, string>; sidecars?: Record<string, { jets: string }> }
>;

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const staged = JSON.parse(read("../friendly-rows.json")) as Staged;
const objects = drawnObjects();
const gates = drawGates();
const crafts = drawnCrafts();
const isGate = (id: string) => id.startsWith("needle-gate-");
const json = (path: string) => JSON.parse(read(`../../public${path}`)) as unknown;

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
    if (key === "guideBeacon" || key === "stardust" || key === "huntGlint" || key === "holodisk") {
      continue;
    }
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
      ...objects.flatMap(({ drawn, strip }) =>
        (strip ? drawn.slice(0, 1) : drawn).map(({ id }) => id),
      ),
      ...WHALE_KINDS.flatMap((kind) =>
        Array.from({ length: 16 * WHALE_LOOP_FRAMES }, (_, index) => {
          const [yaw, loop] = [Math.floor(index / WHALE_LOOP_FRAMES), index % WHALE_LOOP_FRAMES];
          return `whale-${kind}-${yaw}-${loop}`;
        }),
      ),
      ...gates.frames.map(({ id }) => id),
      ...crafts.flatMap(({ frames }) => frames.map(({ id }) => id)),
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
    collected.flatMap(({ drawn, strip }) =>
      (strip ? drawn.slice(0, 1) : drawn).map(({ id }) => id),
    ),
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
  const buoys = staged.cartwheel!.assets.filter(({ id }) => id.startsWith("mooring-buoy-"));
  assert.equal(buoys.length, 2);
  for (const { id, width, height, pivot, moorings } of buoys) {
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

type Heading = {
  mouths?: { anchor: [number, number]; axis: [number, number]; half: [number, number] }[];
  tow?: [number, number];
  collision: [number, number][][];
};
type Jets = { frame: number; headings: Heading[]; nose: { distance: number; tip: number[] }[] };
type Tow = { craft: { id: string; frame: number; blink?: string[]; headings: Heading[] }[] };

const inside = (frame: number, [x, y]: readonly number[]) =>
  x! > 0 && x! < frame && y! > 0 && y! < frame;
const convexParts = (id: string, frame: number, { collision }: Heading) => {
  assert.ok(collision.length > 0, id);
  for (const part of collision) {
    assert.ok(strictlyConvex(part), id);
    for (const point of part) assert.ok(inside(frame + 1e-9, point) || point.includes(0), id);
  }
};

test("the 32 craft each draw 16 headings inside a square frame, with blink frames for the lifeboats", () => {
  assert.equal(crafts.length, 32);
  assert.equal(new Set(crafts.map(({ name }) => name)).size, 32);
  for (const { name, frame, frames, blink } of crafts) {
    assert.equal(frame % 8, 0, name);
    assert.equal(frames.length, blink ? 32 : 16, name);
    for (const { id, drawn } of frames) {
      assert.ok(drawn[0] >= 1 && drawn[1] >= 1, id);
      assert.ok(drawn[2] <= frame - 1 && drawn[3] <= frame - 1, id);
    }
    if (!blink) continue;
    for (let yaw = 0; yaw < 16; yaw++) {
      const [a, b] = frames.filter((frame) => frame.yaw === yaw);
      assert.deepEqual([a!.blink, b!.blink], ["a", "b"], name);
      assert.equal(a!.silhouette, b!.silhouette, name);
      assert.notEqual(a!.svg, b!.svg, name);
    }
  }
});

test("every craft carries Ada's canopy blue and jet blue, and none carries red", () => {
  const red = (colour: string) => {
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16));
    return r! > 150 && g! < 80 && b! < 100;
  };
  for (const { name, frames, fixed } of crafts) {
    const colours = new Set(frames.flatMap(({ svg }) => svg.match(/#[0-9a-f]{6}/gu) ?? []));
    assert.deepEqual([...colours].filter(red), [], name);
    if (fixed) continue;
    assert.ok(colours.has("#2585d0"), `${name} canopy`);
    assert.ok(colours.has("#86deff"), `${name} jets`);
  }
});

test("the lamp buoy draws the same at every heading", () => {
  const buoy = crafts.find(({ name }) => name === "stranded-lamp-buoy")!;
  for (const blink of ["a", "b"]) {
    const art = buoy.frames
      .filter((frame) => frame.blink === blink)
      .map(({ svg }) => svg.replace(/<title>.*?<\/title>/u, ""));
    assert.equal(new Set(art).size, 1);
  }
});

test("each flying craft stages a jets file with its ports, nose and collision per heading", () => {
  const flying = crafts.filter(({ stranded }) => !stranded);
  assert.equal(flying.length, 21);
  for (const { name, manifest, frame } of flying) {
    const path = staged[manifest]!.sidecars![name]!.jets;
    const file = json(path) as Jets | Record<string, Jets>;
    const jets = (manifest === "phantom" ? (file as Record<string, Jets>)[name] : file) as Jets;
    assert.equal(jets.frame, frame, name);
    assert.equal(jets.headings.length, 16, name);
    assert.equal(jets.nose.length, 16, name);
    for (const [yaw, heading] of jets.headings.entries()) {
      assert.ok(heading.mouths!.length >= 1, name);
      for (const { anchor, axis, half } of heading.mouths!) {
        assert.ok(inside(frame, anchor), name);
        // The jet leaves aft, opposite the nose, and its base lies across it.
        const [nx, ny] = [jets.nose[yaw]!.tip[0]! - frame / 2, jets.nose[yaw]!.tip[1]! - frame / 2];
        assert.ok(axis[0] * nx + axis[1] * ny < 0, `${name} ${yaw}`);
        assert.ok(Math.hypot(...half) > 0.5, name);
      }
      convexParts(`${name} ${yaw}`, frame, heading);
      assert.ok(inside(frame, jets.nose[yaw]!.tip), name);
      assert.ok(jets.nose[yaw]!.distance > 0, name);
    }
  }
});

test("each stranded craft stages a tow point and collision per heading in its galaxy's tow file", () => {
  const towed = crafts.filter(({ stranded }) => stranded);
  assert.equal(towed.length, 11);
  for (const { name, folder, frame, blink } of towed) {
    const file = json(staged[folder]!.data!.tow!) as Tow;
    const entry = file.craft.find(({ id }) => id === name)!;
    assert.equal(entry.frame, frame, name);
    assert.deepEqual(entry.blink, blink ? ["a", "b"] : undefined, name);
    assert.equal(entry.headings.length, 16, name);
    for (const [yaw, heading] of entry.headings.entries()) {
      assert.ok(inside(frame, heading.tow!), name);
      convexParts(`${name} ${yaw}`, frame, heading);
    }
  }
  const shipped = json("/art/cartwheel/tow.json") as { line: unknown };
  assert.deepEqual((json(staged.core!.data!.tow!) as { line: unknown }).line, shipped.line);
});

type StripRow = Row & {
  frameWidth?: number;
  frameHeight?: number;
  displayWidth: number;
  frames?: Record<string, number>;
  loop?: { frame: number; name: string; ms: number }[];
  climb?: { ms: number; lit?: string }[];
};
type ShippedRow = StripRow & { displayHeight: number };

test("each animated pickup stages the shipped frame names and loop timings on one strip row", () => {
  const shipped = readManifest("core").assets as ShippedRow[];
  const rows = staged.core!.assets as StripRow[];
  const sheet = read(`../../public${rows[0]!.path}`);
  for (const id of ["stardust", "hunt-glint", "ammo-pack", "holodisk", "upgrade-chevron"]) {
    const was = shipped.find((row) => row.id === id)!;
    const now = rows.find((row) => row.id === id)!;
    const object = objects.find(({ drawn }) => drawn[0]!.id === id)!;
    assert.deepEqual(now.loop, was.loop, id);
    assert.deepEqual(now.climb, was.climb, id);
    if (was.frames) assert.deepEqual(now.frames, was.frames, id);
    // The strip holds every frame the loop names, each one frame wide.
    const count = now.width / now.frameWidth!;
    assert.equal(count, object.drawn.length, id);
    assert.equal(now.frameHeight, now.height, id);
    assert.ok(Math.abs(now.displayWidth - now.frameWidth! * DISPLAY_SCALE) < 1e-9, id);
    for (const { frame } of now.loop ?? []) assert.ok(frame < count, id);
    for (const { lit } of now.climb ?? []) assert.ok(now.frames![lit ?? "rest"]! < count, id);
    const root = sheet.split(`<svg id="${id}" `)[1]!.split(/<svg id="/u)[0]!;
    assert.equal(root.split("<svg x=").length - 1, count, id);
    // Every frame differs from the rest frame.
    const [rest, ...others] = object.drawn.map(({ svg }) =>
      svg.replace(/<title>.*?<\/title>/u, ""),
    );
    for (const other of others) assert.notEqual(other, rest, id);
  }
  assert.deepEqual(rows.find(({ id }) => id === "ore-nugget")!.frames, { rest: 0 });
});

type WhaleData = {
  headings: number;
  family: unknown;
  reducedMotion: unknown;
  kinds: {
    kind: string;
    loop: unknown;
    stationaryHeading: number;
    headings: {
      index: number;
      frame: { width: number; height: number };
      display: { width: number; height: number };
      pivot: [number, number];
      footprintRadius: number;
    }[];
  }[];
};

test("each whale kind stages 16 headings of 8 loop frames in one square frame", () => {
  for (const kind of WHALE_KINDS) {
    const frame = whaleFrame(kind);
    assert.equal(frame % 8, 0, kind);
    const manifest = kind === "whale" || kind === "adult" ? "core" : "whirlpool";
    const rows = staged[manifest]!.assets.filter(({ id }) => id.startsWith(`whale-${kind}-`));
    assert.equal(rows.length, 16 * WHALE_LOOP_FRAMES, kind);
    for (const { id, width, height, pivot } of rows) {
      assert.deepEqual([width, height, pivot.x, pivot.y], [frame, frame, 0.5, 0.5], id);
    }
    // The loop moves: the tail's frames differ, and the drawn whale stays inside its frame.
    for (const yaw of [0, 2, 10, 14]) {
      const loop = Array.from({ length: WHALE_LOOP_FRAMES }, (_, index) =>
        drawWhale(kind, frame, yaw, index),
      );
      assert.equal(new Set(loop.map(({ silhouette }) => silhouette)).size, WHALE_LOOP_FRAMES);
      for (const { id, drawn } of loop) {
        assert.ok(drawn[0] >= 1 && drawn[1] >= 1, id);
        assert.ok(drawn[2] <= frame - 1 && drawn[3] <= frame - 1, id);
      }
    }
  }
});

test("the whale data keeps the shipped loop, family and still headings, with a footprint per heading", () => {
  const shipped = json("/art/whales.json") as WhaleData;
  for (const manifest of ["whirlpool", "phantom"]) {
    const data = json(staged[manifest]!.data!.whales!) as WhaleData;
    assert.equal(data.headings, 16);
    assert.deepEqual(data.family, shipped.family);
    assert.deepEqual(data.reducedMotion, shipped.reducedMotion);
    assert.deepEqual(
      data.kinds.map(({ kind }) => kind),
      [...WHALE_KINDS],
    );
    for (const [index, entry] of data.kinds.entries()) {
      const was = shipped.kinds[index]!;
      assert.deepEqual([entry.loop, entry.stationaryHeading], [was.loop, was.stationaryHeading]);
      const frame = whaleFrame(WHALE_KINDS[index]!);
      assert.equal(entry.headings.length, 16);
      for (const heading of entry.headings) {
        assert.deepEqual(heading.frame, { width: frame, height: frame });
        assert.equal(heading.display.width, frame * DISPLAY_SCALE);
        assert.deepEqual(heading.pivot, [0.5, 0.5]);
      }
      // The footprint holds the whale's plan: at least half its length, inside its frame.
      const radius = entry.headings[0]!.footprintRadius;
      assert.equal(radius, whaleFootprint(WHALE_KINDS[index]!, 0));
      assert.ok(radius > 0 && radius < frame * DISPLAY_SCALE);
    }
  }
});
