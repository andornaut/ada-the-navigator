import { describe, expect, it } from "vitest";

import art from "../../public/art/ship-nose.json";
import { PROTOTYPE } from "../data/prototype.ts";
import { worldParts } from "./convex.ts";
import { createFlight, stepFlight } from "./flight.ts";
import { readShipNose, SHIP_HEADINGS, shipSilhouette } from "./nose.ts";
import { SHIP_REACH, shipBody, shipTouches } from "./ship-body.ts";
import type { FlightState, Vec } from "./types.ts";

const facingOf = (heading: number): Vec => ({
  x: Math.cos((heading * Math.PI * 2) / SHIP_HEADINGS),
  y: Math.sin((heading * Math.PI * 2) / SHIP_HEADINGS),
});
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

describe("Ada's drawn ship", () => {
  it("reads one silhouette per heading inside her 42 px sprite, centred on her position", () => {
    expect(art.collision).toHaveLength(SHIP_HEADINGS);
    for (let heading = 0; heading < SHIP_HEADINGS; heading++) {
      const parts = shipSilhouette(heading);
      expect(parts.length, `heading ${heading}`).toBeGreaterThan(0);
      for (const at of parts.flat()) {
        expect(Math.abs(at.x)).toBeLessThanOrEqual(21);
        expect(Math.abs(at.y)).toBeLessThanOrEqual(21);
      }
      expect(shipBody(facingOf(heading))).toBe(parts);
    }
    expect(shipSilhouette(0)).not.toEqual(shipSilhouette(8));
    // The farthest silhouette point over every heading, on the world plane.
    const farthest = Math.max(
      ...Array.from({ length: SHIP_HEADINGS }, (_, heading) =>
        Math.max(
          ...worldParts(shipSilhouette(heading))
            .flat()
            .map((at) => Math.hypot(at.x, at.y)),
        ),
      ),
    );
    expect(SHIP_REACH).toBe(farthest);
  });

  it.each([
    ["31 silhouettes", { ...art, collision: art.collision.slice(1) }],
    ["no silhouettes", { ...art, collision: undefined }],
    [
      "a two-point part",
      {
        ...art,
        collision: [
          [
            [
              [1, 1],
              [2, 2],
            ],
          ],
          ...art.collision.slice(1),
        ],
      },
    ],
    [
      "a point outside the frame",
      {
        ...art,
        collision: [
          [
            [
              [1, 1],
              [2, 2],
              [97, 3],
            ],
          ],
          ...art.collision.slice(1),
        ],
      },
    ],
  ])("rejects a nose file with %s", (_, value) => {
    expect(readShipNose(value)).toBeUndefined();
  });

  it.each(Array.from({ length: SHIP_HEADINGS }, (_, heading) => heading))(
    "takes an enemy shot through her drawn wing at heading %i, not one just past the wingtip",
    (heading) => {
      const facing = facingOf(heading);
      // The wing reaches out across her facing; its tip is the farthest drawn point that way.
      const across = { x: -facing.y, y: facing.x };
      const points = worldParts(shipSilhouette(heading)).flat();
      const tip = points.reduce((best, at) =>
        at.x * across.x + at.y * across.y > best.x * across.x + best.y * across.y ? at : best,
      );
      const shield = (offset: number) => {
        const flight: FlightState = createFlight(PROTOTYPE, 1, 1234, { known: [] });
        flight.objects = [];
        flight.facing = facing;
        flight.player = { x: 100, y: 100 };
        flight.shots = [
          {
            enemy: true,
            hitIds: [],
            id: "shot",
            life: 1,
            piercing: false,
            velocity: { x: 0, y: 0 },
            x: 100 + tip.x + across.x * offset,
            y: 100 + tip.y + across.y * offset,
          },
        ];
        stepFlight(PROTOTYPE, 0.01, idle, flight);
        return flight.shield;
      };
      // A shot's 3-unit reach: 1 unit inside the tip hits, 3.5 past it misses.
      expect(shield(-1)).toBe(PROTOTYPE.tuning.shieldMax - PROTOTYPE.tuning.enemyDamage);
      expect(shield(3.5)).toBe(PROTOTYPE.tuning.shieldMax);
      expect(
        shipTouches(
          facing,
          { x: 0, y: 0 },
          { x: tip.x + across.x * 2.9, y: tip.y + across.y * 2.9 },
          3,
        ),
      ).toBe(true);
    },
  );
});
