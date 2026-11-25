import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { readManifest } from "./manifest.ts";
import { ORE_PICKUP, PICKUP_SIZE, STARDUST_REST } from "./resource-glyphs.ts";
import { strictlyConvex } from "./silhouette.ts";

type Row = {
  id: string;
  path: string;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  frameWidth: number;
  frameHeight: number;
  frames: Record<string, number>;
  loop?: { frame: number; name: string; ms: number }[];
};
type Sheet = {
  frames: Record<string, { frame: { w: number; h: number }; collision: number[][][] }>;
  pullStreak?: {
    wedges: { color: string; points: number[][]; keyline?: boolean }[];
    reducedMotion: boolean;
  };
};

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const rows = (readManifest("core").assets as unknown as Row[]).filter(
  ({ id }) => id === "stardust" || id === "ore-nugget",
);
const data = (id: string) => JSON.parse(read(`../../public/art/${id}.json`)) as Sheet;

test("Stardust and ore have one 9 px core row each, on sheets that exist", () => {
  assert.deepEqual(
    rows.map(({ id }) => id),
    ["stardust", "ore-nugget"],
  );
  for (const row of rows) {
    assert.equal(row.path, `/art/${row.id}.png`, row.id);
    assert.ok(existsSync(new URL(`../../public${row.path}`, import.meta.url)), row.id);
    assert.equal(row.frameWidth, PICKUP_SIZE, row.id);
    assert.equal(row.frameHeight, PICKUP_SIZE, row.id);
    assert.equal(row.displayWidth, PICKUP_SIZE, row.id);
    assert.equal(row.displayHeight, PICKUP_SIZE, row.id);
    assert.equal(row.frames.rest, 0, row.id);
    assert.equal(row.width / row.frameWidth, Object.keys(data(row.id).frames).length, row.id);
  }
  assert.equal(PICKUP_SIZE, 9);
  assert.equal(STARDUST_REST.length, PICKUP_SIZE);
  assert.equal(ORE_PICKUP.length, PICKUP_SIZE);
});

test("Stardust twinkles 420, 60, 80 and 60 ms through rest, glint1, glint2, glint1", () => {
  const stardust = rows.find(({ id }) => id === "stardust")!;
  assert.deepEqual(
    stardust.loop?.map(({ frame, name, ms }) => [frame, name, ms]),
    [
      [0, "rest", 420],
      [1, "glint1", 60],
      [2, "glint2", 80],
      [3, "glint1", 60],
    ],
  );
  assert.deepEqual(stardust.frames, { rest: 0, glint1: 1, glint2: 2 });
});

test("every frame ships strictly convex collision parts inside its 9 px frame", () => {
  for (const { id } of rows) {
    for (const [name, { frame, collision }] of Object.entries(data(id).frames)) {
      assert.deepEqual([frame.w, frame.h], [PICKUP_SIZE, PICKUP_SIZE], name);
      assert.ok(collision.length > 0, name);
      for (const part of collision) {
        assert.ok(strictlyConvex(part as [number, number][]), name);
        for (const [x, y] of part) {
          assert.ok(x! >= 0 && y! >= 0 && x! <= PICKUP_SIZE && y! <= PICKUP_SIZE, name);
        }
      }
    }
  }
});

test("Stardust's pull streak trails two opaque wedges, the first keylined", () => {
  const streak = data("stardust").pullStreak!;
  assert.equal(streak.reducedMotion, false);
  assert.deepEqual(
    streak.wedges.map(({ color, keyline = false }) => [color, keyline]),
    [
      ["#c9a86a", true],
      ["#f6e4b8", false],
    ],
  );
  for (const { points } of streak.wedges) {
    assert.equal(points.length, 3);
    // Behind the pickup, from inside the star to past its 4.5 px tips.
    assert.ok(points.every(([u]) => u! < 0));
    assert.ok(Math.min(...points.map(([u]) => u!)) < -PICKUP_SIZE / 2);
  }
});
