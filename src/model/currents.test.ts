import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog } from "../data/enemy-catalog.ts";
import { CURRENTS } from "../data/galaxy-features.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import {
  type Current,
  currentInCell,
  currentsNear,
  flowAt,
  inCurrent,
  nearestOnCurrent,
  pointOnCurrent,
} from "./currents.ts";
import { createEnemy } from "./enemy-ai.ts";
import { createFlight, ensureDestination, stepFlight } from "./flight.ts";
import { stationsNear } from "./stations.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const grid = (sector: 1 | 2 | 3, span: number): Current[] => {
  const found: Current[] = [];
  for (let x = -span; x <= span; x++) {
    for (let y = -span; y <= span; y++) {
      const current = currentInCell(sector, { x, y });
      if (current) {
        found.push(current);
      }
    }
  }
  return found;
};
const speed = (vector: Vec) => Math.hypot(vector.x, vector.y);
/** The middle of a current's centre line, where the flow peaks. */
const middle = (current: Current) => pointOnCurrent(current, current.length / 2);
/** A Whirlpool flight with nothing in it but Ada, placed at `at`. */
const emptyFlight = (at: Vec): FlightState => {
  const flight = createFlight(PROTOTYPE, 3, 11, { known: [] });
  flight.player = { ...at };
  stepFlight(PROTOTYPE, 0.001, idle, flight);
  flight.objects = [];
  flight.shots = [];
  flight.velocity = { x: 0, y: 0 };
  return flight;
};

describe("space currents", () => {
  const currents = grid(3, 8);

  it("are seeded in Whirlpool only, the same on every call", () => {
    expect(currents.length).toBeGreaterThan(150);
    expect(grid(1, 4)).toEqual([]);
    expect(grid(2, 4)).toEqual([]);
    expect(grid(3, 8)).toEqual(currents);
  });

  it("are 3000 to 8000 long and 300 to 500 wide, and about a third carry debris", () => {
    for (const current of currents) {
      expect(current.length).toBeGreaterThanOrEqual(CURRENTS.length[0]);
      expect(current.length).toBeLessThanOrEqual(CURRENTS.length[1]);
      expect(current.width).toBeGreaterThanOrEqual(CURRENTS.width[0]);
      expect(current.width).toBeLessThanOrEqual(CURRENTS.width[1]);
    }
    const share = currents.filter((current) => current.debris).length / currents.length;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.42);
  });

  it("never overlap: each stays inside its own cell's inner band", () => {
    for (const current of currents) {
      const match = /^current:(-?\d+),(-?\d+)$/.exec(current.id)!;
      const cell = { x: Number(match[1]), y: Number(match[2]) };
      const low = (value: number) =>
        value * CURRENTS.cellSize + CURRENTS.margin - current.width / 2;
      const high = (value: number) =>
        (value + 1) * CURRENTS.cellSize - CURRENTS.margin + current.width / 2;
      for (const point of current.points) {
        expect(point.x).toBeGreaterThanOrEqual(low(cell.x) - 1e-6);
        expect(point.x).toBeLessThanOrEqual(high(cell.x) + 1e-6);
        expect(point.y).toBeGreaterThanOrEqual(low(cell.y) - 1e-6);
        expect(point.y).toBeLessThanOrEqual(high(cell.y) + 1e-6);
      }
    }
  });

  it("keep 800 clear of the flight start and stations", () => {
    for (const current of currents) {
      const keep = CURRENTS.clearance + current.width / 2;
      for (const point of current.points) {
        expect(Math.hypot(point.x, point.y)).toBeGreaterThanOrEqual(keep);
        expect(stationsNear(ECONOMY, 3, keep, point)).toEqual([]);
      }
    }
  });

  it("flow 70 at the centre line, fade to zero at the edges and over each end", () => {
    const current = currents.find((entry) => entry.length > 3500)!;
    const { point, tangent } = middle(current);
    const flow = flowAt(3, point);
    expect(speed(flow)).toBeCloseTo(CURRENTS.peakFlow, 6);
    // The flow runs along its segment; the drawn tangent turns smoothly between segment midpoints.
    expect(flow.x * tangent.x + flow.y * tangent.y).toBeCloseTo(CURRENTS.peakFlow, 2);
    const edge = {
      x: point.x - tangent.y * (current.width / 2 + 1),
      y: point.y + tangent.x * (current.width / 2 + 1),
    };
    expect(speed(flowAt(3, edge))).toBe(0);
    const halfway = {
      x: point.x - tangent.y * (current.width / 4),
      y: point.y + tangent.x * (current.width / 4),
    };
    expect(speed(flowAt(3, halfway))).toBeLessThan(CURRENTS.peakFlow);
    expect(speed(flowAt(3, current.points[0]!))).toBeCloseTo(0, 6);
    expect(speed(flowAt(3, pointOnCurrent(current, CURRENTS.fade / 2).point))).toBeCloseTo(
      CURRENTS.peakFlow / 2,
      0,
    );
  });

  it("drift Ada with the flow outside her own velocity and speed cap", () => {
    // A current without a river, so no river rock on the centre line meets the ship.
    const current = currents.find((entry) => entry.length > 3500 && !entry.debris)!;
    const { point, tangent } = middle(current);
    const top = PROTOTYPE.tuning.maxSpeed;
    for (const sense of [0, 1, -1]) {
      const flight = emptyFlight(point);
      flight.velocity = { x: tangent.x * top * sense, y: tangent.y * top * sense };
      const before = { ...flight.player };
      stepFlight(PROTOTYPE, 1 / 600, idle, flight);
      // Riding the centre line makes top + 70, pushing against it top - 70.
      const along =
        ((flight.player.x - before.x) * tangent.x + (flight.player.y - before.y) * tangent.y) * 600;
      expect(along).toBeCloseTo(top * sense + CURRENTS.peakFlow, -1);
      expect(Math.hypot(flight.velocity.x, flight.velocity.y)).toBeLessThanOrEqual(top + 1e-9);
    }
  });

  it("drift small craft and pickups but not frigates, capitals or platforms", () => {
    // A current without a river, so no river rock on the centre line meets the ship.
    const current = currents.find((entry) => entry.length > 3500 && !entry.debris)!;
    const { point } = middle(current);
    const flight = emptyFlight({ x: point.x + 600, y: point.y + 600 });
    // Each sits on the centre line, far enough apart that no ship blocks another.
    const along = (arc: number) => pointOnCurrent(current, current.length / 2 + arc).point;
    const ship = (archetype: "frigate" | "swarm", at: Vec): SpaceObject => ({
      ...at,
      enemy: {
        ...createEnemy(
          enemyCatalog[archetype],
          { archetype, id: archetype, packId: null, phase: 0 },
          at,
        ),
        returning: true,
      },
      hp: enemyCatalog[archetype].hp,
      id: archetype,
      kind: "enemy",
      radius: 10,
    });
    const swarmStart = along(-300);
    const frigateStart = along(300);
    const pickupStart = along(0);
    const swarm = ship("swarm", swarmStart);
    const frigate = ship("frigate", frigateStart);
    const pickup: SpaceObject = {
      ...pickupStart,
      amount: 1,
      hp: 1,
      id: "dust",
      kind: "pickup",
      radius: 5,
    };
    flight.objects.push(swarm, frigate, pickup);
    stepFlight(PROTOTYPE, 0.5, idle, flight);
    const flow = speed(flowAt(3, point));
    expect(Math.hypot(swarm.x - swarmStart.x, swarm.y - swarmStart.y)).toBeGreaterThan(flow * 0.3);
    expect(Math.hypot(pickup.x - pickupStart.x, pickup.y - pickupStart.y)).toBeCloseTo(
      flow * 0.5,
      -1,
    );
    expect(Math.hypot(frigate.x - frigateStart.x, frigate.y - frigateStart.y)).toBeLessThan(1);
  });

  it("keep asteroids and resource rocks out of their bands", () => {
    const current = currents.find((entry) => entry.length > 3500)!;
    const { point } = middle(current);
    const flight = createFlight(PROTOTYPE, 3, 5, { known: [] });
    flight.player = { x: point.x + 600, y: point.y + 600 };
    stepFlight(PROTOTYPE, 0.001, idle, flight);
    const rocks = flight.objects.filter(
      (object) =>
        (object.kind === "rock" || object.kind === "resource") && !object.id.startsWith("river:"),
    );
    expect(rocks.length).toBeGreaterThan(0);
    for (const rock of rocks) {
      expect(inCurrent(3, rock.radius + (rock.orbit?.radius ?? 0), rock)).toBe(false);
    }
  });

  it("carry debris rivers along their centre line at the peak flow, re-entering at the start", () => {
    const current = currents.find((entry) => entry.debris)!;
    const flight = emptyFlight({ x: current.points[0]!.x + 900, y: current.points[0]!.y + 900 });
    stepFlight(PROTOTYPE, 0.001, idle, flight);
    const rock = flight.objects.find((object) => object.river?.current === current.id)!;
    expect(rock.kind).toBe("debris");
    const start = nearestOnCurrent(current, rock).arc;
    expect(nearestOnCurrent(current, rock).distance).toBeLessThan(1e-6);
    expect(Math.hypot(rock.velocity!.x, rock.velocity!.y)).toBeCloseTo(CURRENTS.peakFlow, 9);
    for (let step = 0; step < 60; step++) {
      stepFlight(PROTOTYPE, 1 / 60, idle, flight);
    }
    const travelled = nearestOnCurrent(current, rock).arc - start;
    const wrapped = travelled < 0 ? travelled + current.length : travelled;
    expect(wrapped).toBeCloseTo(CURRENTS.peakFlow, -1);
  });

  it("keep story destinations clear", () => {
    const current = currents.find((entry) => entry.length > 3500)!;
    const { point } = middle(current);
    const flight = emptyFlight({ x: point.x - 1024, y: point.y });
    flight.velocity = { x: 1, y: 0 };
    const destination = ensureDestination(PROTOTYPE, "whale", flight);
    expect(inCurrent(3, CURRENTS.clearance, destination)).toBe(false);
    expect(currentsNear(3, 0, destination).length).toBeGreaterThanOrEqual(0);
  });
});
