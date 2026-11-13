import { describe, expect, it } from "vitest";

import rearArt from "../../public/art/ship-jets.json";
import retroArt from "../../public/art/ship-retro-jets.json";
import { CONTENT } from "../data/content.ts";
import { createFlight, stepFlight } from "../model/flight.ts";
import { SHIP_HEADINGS } from "../model/nose.ts";
import { engineJets, jetTriangles, readEngineJets, shipJetDirection } from "./shipJets.ts";

const rear = readEngineJets(rearArt)!;
const retro = readEngineJets(retroArt)!;

describe("velocity-directed ship jets", () => {
  it.each(Array.from({ length: SHIP_HEADINGS }, (_, index) => index))(
    "selects front jets only for actual backward velocity at heading %s",
    (heading) => {
      const angle = (heading * 2 * Math.PI) / SHIP_HEADINGS;
      const facing = { x: Math.cos(angle), y: Math.sin(angle) };
      expect(shipJetDirection(facing, { x: facing.x * 20, y: facing.y * 20 })).toBe("forward");
      expect(shipJetDirection(facing, { x: -facing.x * 20, y: -facing.y * 20 })).toBe("reverse");
    },
  );

  it("keeps rear jets while real opposite-throttle braking still moves forward, then switches after reversal", () => {
    const flight = createFlight(CONTENT, 1, 77, { known: [] });
    flight.objects = [];
    flight.shots = [];
    flight.facing = { x: 1, y: 0 };
    flight.velocity = { x: 80, y: 0 };
    const input = {
      aim: { x: 0, y: 0 },
      fire: false,
      move: { x: -1, y: 0 },
      turn: 0 as const,
      use: false,
    };
    stepFlight(CONTENT, 0.01, input, flight);
    expect(flight.velocity.x).toBeGreaterThan(1);
    expect(shipJetDirection(flight.facing, flight.velocity)).toBe("forward");
    for (let step = 0; step < 60 && flight.velocity.x >= -1; step++) {
      stepFlight(CONTENT, 1 / 60, input, flight);
    }
    expect(flight.facing).toEqual({ x: 1, y: 0 });
    expect(flight.velocity.x).toBeLessThan(-1);
    expect(shipJetDirection(flight.facing, flight.velocity)).toBe("reverse");
  });

  it("keeps rest and near-zero velocity noise below the existing one-unit thrust cutoff", () => {
    for (const x of [-1, -0.999, -Number.EPSILON, 0, Number.EPSILON, 0.999, 1]) {
      expect(shipJetDirection({ x: 1, y: 0 }, { x, y: 0 })).toBeUndefined();
    }
    expect(shipJetDirection({ x: 1, y: 0 }, { x: -1.001, y: 0 })).toBe("reverse");
    expect(shipJetDirection({ x: 1, y: 0 }, { x: 1.001, y: 0 })).toBe("forward");
  });

  it("uses velocity instead of a requested braking direction and leaves sideways travel on rear jets", () => {
    const facing = { x: 1, y: 0 };
    expect(shipJetDirection(facing, { x: 80, y: 0 })).toBe("forward");
    expect(shipJetDirection(facing, { x: -80, y: 0 })).toBe("reverse");
    expect(shipJetDirection(facing, { x: 0, y: 80 })).toBe("forward");
  });
});

describe("canonical reverse jet data", () => {
  it("reads every canonical heading with the existing engine schema and a fixed yellow style", () => {
    expect(retro).toBeDefined();
    expect(retro.headings).toHaveLength(SHIP_HEADINGS);
    expect(retro.headings.every((mouths) => mouths.length === 2)).toBe(true);
    expect(retro.frame).toBe(rear.frame);
    expect(retro.length).toEqual(rear.length);
    expect(retro.engineLevels).toHaveLength(1);
    for (const level of [1, 2, 3]) {
      expect(engineJets(retro, level).layers).toEqual(retro.engineLevels[0]);
    }
  });

  it("projects the opposite exhaust direction while retaining the existing speed and rest rules", () => {
    const display = { displayHeight: 42, displayWidth: 42, pivot: { x: 0.5, y: 0.5 } };
    for (let heading = 0; heading < SHIP_HEADINGS; heading++) {
      const axis = rear.headings[heading]![0]!.axis;
      for (const mouth of retro.headings[heading]!) {
        expect(mouth.axis.x * axis.x + mouth.axis.y * axis.y).toBeLessThan(0);
      }
      expect(jetTriangles(engineJets(retro, 1), display, heading, 0)).toEqual([]);
      const triangles = jetTriangles(engineJets(retro, 1), display, heading, 1);
      expect(triangles).toHaveLength(
        retro.headings[heading]!.length * retro.engineLevels[0]!.length,
      );
      expect(
        triangles.every(({ points }) =>
          points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)),
        ),
      ).toBe(true);
    }
  });
});
