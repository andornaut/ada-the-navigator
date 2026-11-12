import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { fromScreen } from "./convex.ts";
import { debrisFrameOf, debrisSilhouette } from "./debrisBody.ts";
import { createFlight, stepFlight } from "./flight.ts";
import type { SpaceObject, Vec } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, reducedMotion: true, use: false };
const debris = (id: string, extra: Partial<SpaceObject> = {}): SpaceObject => ({
  hp: 99,
  id,
  kind: "debris",
  radius: CONTENT.tuning.flight.rockRadius,
  velocity: { x: 0.001, y: 0 },
  x: 300,
  y: 300,
  ...extra,
});

describe("traveling debris as drawn", () => {
  it("draws Cartwheel's and Whirlpool's traveling debris with Art's piece silhouettes", () => {
    for (const galaxy of [2, 3] as GalaxyNumber[]) {
      const drawn = debrisSilhouette(galaxy, debris("river:a:1,2:0"))!;
      expect(drawn.frames).toHaveLength(8);
      expect(drawn.frames.every((parts) => parts.length >= 4)).toBe(true);
    }
    // Sunflower has no debris art, and resting or drifting debris is not traveling debris.
    expect(debrisSilhouette(1, debris("a"))).toBeNull();
    const resting = debris("a");
    delete resting.velocity;
    expect(debrisSilhouette(2, resting)).toBeNull();
    expect(debrisSilhouette(2, debris("a", { asteroid: "asteroid-m1" }))).toBeNull();
    expect(debrisFrameOf(2, debris("a"), true, 12)).toBe(0);
    const frames = new Set(
      Array.from({ length: 60 }, (_, i) => debrisFrameOf(2, debris("a"), false, i / 10)),
    );
    expect(frames.size).toBe(8);
  });

  it.each([2, 3] as GalaxyNumber[])(
    "takes a shot at its drawn edge in galaxy %i, not one just past it",
    (galaxy) => {
      const object = debris(`river:b:${galaxy}:0`);
      const parts = debrisSilhouette(galaxy, object)!.frames[0]!;
      const right = parts.flat().reduce((best, at) => (at.x > best.x ? at : best));
      const shot = (gap: number) => {
        const flight = createFlight(CONTENT, galaxy, 1234, { known: [] });
        flight.player = { x: 0, y: 0 };
        flight.objects = [{ ...object }];
        const offset: Vec = fromScreen({ x: right.x + gap, y: right.y });
        flight.shots = [
          {
            damage: 1,
            enemy: false,
            hitIds: [],
            id: "shot",
            life: 1,
            piercing: false,
            projectile: "bolt",
            velocity: { x: 0, y: 0 },
            x: object.x + offset.x,
            y: object.y + offset.y,
          },
        ];
        stepFlight(CONTENT, 1 / 120, idle, flight);
        return flight.objects.find((entry) => entry.id === object.id)?.hp;
      };
      // A shot's 3 px reach: 1 px inside the rightmost drawn point hits, 3.5 px past it misses.
      expect(shot(-1)).toBe(98);
      expect(shot(3.5)).toBe(99);
    },
  );
});
