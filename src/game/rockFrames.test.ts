import { expect, it } from "vitest";

import { ASTEROID_ART } from "../data/asteroidCatalog.ts";
import { rockFrame } from "../model/asteroids.ts";
import { RockFrames } from "./rockFrames.ts";

const art = ASTEROID_ART.asteroids.find((rock) => rock.frames.length > 1)!;

it("queues every frame of a visible variant and never substitutes frame zero while loading", () => {
  const frames = new RockFrames();
  const loaded = new Set([art.frames[0]!.file]);
  const requests = new Set<string>();
  const available = (file: string) => {
    requests.add(file);
    return loaded.has(file);
  };
  expect(frames.frame(available, art, 7)).toBeUndefined();
  expect(requests).toEqual(new Set(art.frames.map((frame) => frame.file)));
  loaded.add(art.frames[7]!.file);
  expect(frames.frame(available, art, 7)).toBeUndefined();
  art.frames.forEach((frame) => loaded.add(frame.file));
  expect(frames.frame(available, art, 7)).toBe(art.frames[7]!.file);
  loaded.delete(art.frames[8]!.file);
  expect(frames.frame(available, art, 8)).toBeUndefined();
  loaded.add(art.frames[8]!.file);
  expect(frames.frame(available, art, 8)).toBe(art.frames[8]!.file);
});

it("draws the exact model spin phase through signed wraps once the complete set is ready", () => {
  const frames = new RockFrames();
  const loaded = new Set(art.frames.map((frame) => frame.file));
  for (const seed of [1, 2, 17, 173]) {
    let previous: number | undefined;
    for (let step = 0; step < 7200; step++) {
      const frame = rockFrame(art, seed, false, "cold-cache-rock", step / 60);
      const file = frames.frame((file) => loaded.has(file), art, frame);
      expect(file).toBe(art.frames[frame]!.file);
      if (previous !== undefined && previous !== frame) {
        expect([1, art.frames.length - 1]).toContain(
          (frame - previous + art.frames.length) % art.frames.length,
        );
      }
      previous = frame;
    }
  }
});

it("checks a loaded spin set in constant work and keeps stationary variants on their only frame", () => {
  const frames = new RockFrames();
  frames.frame(() => true, art, 7);
  const calls: string[] = [];
  expect(
    frames.frame(
      (file) => {
        calls.push(file);
        return true;
      },
      art,
      8,
    ),
  ).toBe(art.frames[8]!.file);
  expect(calls).toEqual([art.frames[8]!.file]);
  const still = ASTEROID_ART.asteroids.find((rock) => rock.frames.length === 1)!;
  expect(frames.frame(() => true, still, 0)).toBe(still.frames[0]!.file);
});
