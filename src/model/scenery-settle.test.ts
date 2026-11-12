import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { ASTEROID_SHAPES, sceneryBodyContact } from "./asteroids.ts";
import { type Parts, unionContact } from "./convex.ts";
import { createFlight, resolveScenery, type SceneryContactOf } from "./flight.ts";
import { shipBody } from "./ship-body.ts";
import type { FlightState, SectorProgress, SpaceObject, Vec } from "./types.ts";

const progress: SectorProgress = {
  charted: [],
  deposited: 0,
  destroyedEnemies: 0,
  discoveries: 0,
  donated: {},
  explored: [],
  greetings: {},
  holodisk: false,
  introduced: false,
  known: [],
  opened: false,
  questComplete: false,
  questItem: null,
  resolved: false,
  revealed: [],
  stage: 0,
  stations: [],
};
const RADIUS = 2;

const flightWith = (wall: SpaceObject): FlightState => {
  const flight = createFlight(PROTOTYPE, 1, 1234, progress);
  flight.objects = [wall];
  return flight;
};

// A flight holding one scenery object whose outline is parts, met by a circle of RADIUS.
function notched(parts: Parts): { contactOf: SceneryContactOf; flight: FlightState } {
  const wall: SpaceObject = { hp: 99, id: "notch", kind: "rock", radius: 40, x: 0, y: 0 };
  return {
    contactOf: (_, position) => unionContact(parts, position, RADIUS),
    flight: flightWith(wall),
  };
}

// Ada's drawn ship heading east into the first large rock's west face, 60 past its radius from
// the origin: at x 54.92 her nose meets a notch between two of the rock's silhouette parts.
const LARGE = [...ASTEROID_SHAPES.values()].find((shape) => shape.size === "large")!;
const NOTCH_ROCK: SpaceObject = {
  asteroid: LARGE.id,
  hp: 99,
  id: "notch-rock",
  kind: "rock",
  radius: LARGE.radius,
  x: LARGE.radius + 60,
  y: 0,
};
const EAST = shipBody({ x: 1, y: 0 });
const intoNotch = () => ({ x: 52.31021240409024 + 156.59652145198987 / 60, y: 0 });
const rockContact: SceneryContactOf = (object, position, frame, drawn) =>
  sceneryBodyContact(object, position, EAST, frame, 0, drawn);
const notchOverlap = (position: Vec) => sceneryBodyContact(NOTCH_ROCK, position, EAST);

// A V-groove of two half-planes opening upward, 0.05 off vertical, each 0.5 from the origin:
// a circle at the origin overlaps both walls, and only far up the groove clears them.
const WALLS = [
  { normal: { x: Math.cos(0.05), y: Math.sin(0.05) }, offset: -0.5 },
  { normal: { x: -Math.cos(0.05), y: Math.sin(0.05) }, offset: -0.5 },
];
const grooveContact = (position: Vec) => {
  let deepest: { depth: number; normal: Vec } | null = null;
  for (const { normal, offset } of WALLS) {
    const depth = RADIUS - (normal.x * position.x + normal.y * position.y - offset);
    if (depth > 0 && (!deepest || depth > deepest.depth)) {
      deepest = { depth, normal };
    }
  }
  return deepest;
};

// The push-out before notches combined their normals: each pass along the deepest contact's own.
function alternating(
  contactAt: (position: Vec) => { depth: number; normal: Vec } | null,
  position: Vec,
  passes: number,
): Vec {
  const at = { ...position };
  for (let pass = 0; pass < passes; pass++) {
    const contact = contactAt(at);
    if (!contact) {
      break;
    }
    at.x += contact.normal.x * (contact.depth + 0.01);
    at.y += contact.normal.y * (contact.depth + 0.01);
  }
  return at;
}
// Two parallel walls: a slot whose escape normals cancel exactly.
const SLOT: Parts = [
  [
    { x: -20, y: -50 },
    { x: -1, y: -50 },
    { x: -1, y: 50 },
    { x: -20, y: 50 },
  ],
  [
    { x: 1, y: -50 },
    { x: 20, y: -50 },
    { x: 20, y: 50 },
    { x: 1, y: 50 },
  ],
];

describe("scenery push-out in a notch", () => {
  it("escapes a groove along both walls' normals, where single pushes alternate between them", () => {
    // Each push along one wall's normal lands deeper in the other, gaining little height.
    expect(grooveContact(alternating(grooveContact, { x: 0, y: 0 }, 16))).not.toBeNull();
    const flight = flightWith({ hp: 99, id: "groove", kind: "rock", radius: 40, x: 0, y: 0 });
    const normals: Vec[] = [];
    const position = { x: 0, y: 0 };
    resolveScenery(
      flight,
      (_, at) => grooveContact(at),
      (normal) => normals.push(normal),
      position,
    );
    expect(grooveContact(position)).toBeNull();
    // Up the groove's opening, the only way clear of both walls.
    expect(position.y).toBeGreaterThan(29);
    expect(Math.abs(position.x)).toBeLessThan(2);
    expect(normals).toHaveLength(1);
  });

  it("pushes Ada's ship out of a rock's seam where a thin part abuts an edge, without returning her", () => {
    // The edge the thin part abuts is a seam, so single pushes leave through the outline.
    expect(notchOverlap(alternating(notchOverlap, intoNotch(), 64))).toBeNull();
    const normals: Vec[] = [];
    const position = intoNotch();
    let returned = false;
    resolveScenery(
      flightWith(NOTCH_ROCK),
      rockContact,
      (normal) => normals.push(normal),
      position,
      () => {
        returned = true;
      },
    );
    expect(returned).toBe(false);
    expect(notchOverlap(position)).toBeNull();
    // One contact, back west along the way the ship came.
    expect(normals).toHaveLength(1);
    expect(normals[0]!.x).toBeLessThan(0);
  });

  it("returns a body stuck where the normals cancel to its move's start and bounces it back", () => {
    const { contactOf, flight } = notched(SLOT);
    const normals: Vec[] = [];
    const position = { x: 0, y: 0 };
    resolveScenery(
      flight,
      contactOf,
      (normal) => normals.push(normal),
      position,
      () => {
        position.x = 0;
        position.y = 60;
      },
    );
    expect(position).toEqual({ x: 0, y: 60 });
    expect(unionContact(SLOT, position, RADIUS)).toBeNull();
    // The first wall's contact, then the bounce back along the way the body came.
    expect(normals).toHaveLength(2);
    expect(Math.abs(normals[1]!.x)).toBeLessThan(0.05);
    expect(normals[1]!.y).toBeGreaterThan(0.99);
  });

  it("leaves a stuck body where the passes end when no move start is given", () => {
    const { contactOf, flight } = notched(SLOT);
    const position = { x: 0, y: 0 };
    resolveScenery(flight, contactOf, () => undefined, position);
    expect(position.y).toBe(0);
    expect(unionContact(SLOT, position, RADIUS)).not.toBeNull();
  });
});
