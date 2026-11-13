import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BACKGROUNDS } from "./storybook.ts";

test("every bedroom variant shares the neutral room camera", () => {
  const neutral = BACKGROUNDS.find(({ id }) => id === "story-ada-room")!;
  const reference = neutral.build(neutral.palette);
  const bedrooms = BACKGROUNDS.filter(({ id }) => id.startsWith("story-ada-room"));
  assert.equal(bedrooms.length, 15);
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

test("invitations add two blank desk cards without changing the room camera or lights", () => {
  for (const suffix of ["", "-glow-1", "-glow-2", "-glow-3"]) {
    const base = BACKGROUNDS.find(({ id }) => id === `story-ada-room${suffix}`)!;
    const cards = BACKGROUNDS.find(({ id }) => id === `story-ada-room-invitations${suffix}`)!;
    const original = base.build(base.palette);
    const scene = cards.build(cards.palette);
    assert.deepEqual(cards.palette, base.palette);
    assert.deepEqual(cards.subject, base.subject);
    assert.deepEqual([scene.k, scene.pivot], [original.k, original.pivot]);
    assert.deepEqual(scene.glows, original.glows);
    assert.deepEqual(scene.lights, original.lights);
    const geometry = scene.layers.flatMap((layer) => layer.flatMap(([, faces]) => faces));
    const existing = original.layers.flatMap((layer) => layer.flatMap(([, faces]) => faces));
    const papers = geometry.filter(
      (face) => !existing.some((other) => JSON.stringify(face) === JSON.stringify(other)),
    );
    assert.equal(papers.length, 2);
    assert(
      papers.every(([face]) => face.length === 4 && face.every((point) => point[2] === 2.601)),
    );
    assert(
      existing.every((face) =>
        geometry.some((other) => JSON.stringify(face) === JSON.stringify(other)),
      ),
    );
  }
});
