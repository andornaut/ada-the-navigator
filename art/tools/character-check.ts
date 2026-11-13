import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { decodePng } from "@andornaut/art-kit/png";

import { gadget } from "./core-busts.ts";
import { catSitting } from "./family-sprites.ts";

const file = (path: string) => readFileSync(new URL(path, import.meta.url));
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("the named officer retains the approved neutral source and animates only his mouth", () => {
  assert.equal(
    hash(file("../sources/admiral-archie-neutral.png")),
    "cccdc6efeeeb954c57958eaf4856dc7c187ba0b0317abc0aa84f18275d6b70d1",
  );
  const idle = gadget(true, null, false);
  for (const step of [0, 1, 2, 3]) {
    const frame = gadget(true, step, false);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        if (x < 13 || x > 18 || y < 19 || y > 23) assert.equal(frame[y]![x], idle[y]![x]);
      }
  }
});

test("all ten officer frames retain the 32px and 22px reveal ordering", () => {
  for (const named of [false, true])
    for (const step of [null, 0, 1, 2, 3]) {
      const full = gadget(named, step, false),
        compact = gadget(named, step, true);
      assert.equal(full.length, 32);
      assert(full.every((row) => row.length === 32));
      assert.equal(compact.length, 22);
      assert(compact.every((row) => row.length === 22));
      if (named)
        for (let y = 0; y < 22; y++)
          for (let x = 0; x < 22; x++) assert.equal(compact[y]![x], full[y + 1]![x + 5]);
    }
  for (const key of ["gadget", "gadget-compact"]) {
    const data = JSON.parse(file(`../../public/art/portraits/${key}.json`).toString());
    assert.equal(Object.keys(data.frames).length, 10);
    assert.deepEqual(
      data.meta.frameTags.map(({ name, from, to }: { name: string; from: number; to: number }) => [
        name,
        from,
        to,
      ]),
      [
        ["unknown-idle", 0, 0],
        ["unknown-speaking", 1, 4],
        ["named-idle", 5, 5],
        ["named-speaking", 6, 9],
      ],
    );
  }
});

test("household sitting sprites retain the approved pixel drawings and compatibility alias", () => {
  assert.equal(
    hash(file("../../public/art/characters/gadget-sitting.png")),
    "c7bd2e61c2539114a7730b2329013e07626ede7633c56b787f3353fbbce0cab8",
  );
  assert.equal(
    hash(file("../../public/art/characters/kiwi-sitting.png")),
    "a7f88e9e1a0820b33799f0f85417a6e8b6e60aaa70d2473cee54a2e4fd1491e5",
  );
  assert.deepEqual(catSitting("archie"), catSitting("gadget"));
});

test("portrait manifest paths and display size retain the existing consumer contract", () => {
  const { assets } = JSON.parse(file("../../public/art/manifest.json").toString());
  for (const [id, key, size] of [
    ["gadget-portrait", "gadget", 32],
    ["gadget-portrait-compact", "gadget-compact", 22],
  ] as const) {
    const entry = assets.find((asset: { id: string }) => asset.id === id);
    assert.equal(entry.path, `/art/portraits/${key}.png`);
    assert.equal(entry.width, size * 10);
    assert.equal(entry.height, size);
    assert.equal(entry.frames["unknown-idle"], 0);
    assert.equal(entry.frames["named-idle"], 5);
    if (size === 22) assert.equal(entry.displayWidth, 44);
  }
  for (const name of ["gadget", "kiwi"])
    for (const pose of ["sitting", "curled"]) {
      const entry = assets.find(
        (asset: { id: string }) => asset.id === `household-${name}-${pose}`,
      );
      const image = decodePng(file(`../../public/art/characters/${name}-${pose}.png`));
      assert.equal(entry.width, image.width);
      assert.equal(entry.height, image.height);
    }
});
