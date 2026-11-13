import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BACKGROUNDS } from "./storybook.ts";

test("every bedroom variant shares the neutral room camera", () => {
  const neutral = BACKGROUNDS.find(({ id }) => id === "story-ada-room")!;
  const reference = neutral.build(neutral.palette);
  const bedrooms = BACKGROUNDS.filter(({ id }) => id.startsWith("story-ada-room"));
  assert.equal(bedrooms.length, 11);
  for (const { build, id, palette } of bedrooms) {
    const scene = build(palette);
    assert.deepEqual([scene.k, scene.pivot], [reference.k, reference.pivot], id);
  }
});

test("recorder entries and their alias publish the neutral room subject band", () => {
  const { assets } = JSON.parse(
    readFileSync(new URL("../../public/art/manifest.json", import.meta.url), "utf8"),
  ) as { assets: { id: string; subject?: { top: number; bottom: number } }[] };
  const recorder = assets.filter(({ id }) => id.startsWith("story-ada-room-recorder"));
  assert.equal(recorder.length, 5);
  for (const { id, subject } of recorder) assert.deepEqual(subject, { top: 255, bottom: 300 }, id);
});
