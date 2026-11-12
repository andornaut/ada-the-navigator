import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { createFlight, ensureDestination, stepFlight, teleport } from "./flight.ts";
import type { SectorProgress } from "./types.ts";
import { markVisited, validVisitedPages, visitedChunk } from "./visited.ts";

const progress: SectorProgress = {
  charted: [],
  deposited: 0,
  disabledEnemies: 0,
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
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

describe("exact compact visited chunks", () => {
  it("encodes a full 16 by 16 chunk page in 32 bytes with stable signed coordinates", () => {
    const pages: Record<string, string> = {};
    for (let x = -16; x < 0; x++) {
      for (let y = 16; y < 32; y++) {
        markVisited(pages, `${x},${y}`);
      }
    }
    expect(Object.keys(pages)).toEqual(["-1,1"]);
    expect(pages["-1,1"]!.length).toBe(44);
    expect([...atob(pages["-1,1"]!)].every((byte) => byte.charCodeAt(0) === 255)).toBe(true);
    expect(visitedChunk(pages, "-16,16")).toBe(true);
    expect(visitedChunk(pages, "-1,31")).toBe(true);
    expect(visitedChunk(pages, "0,16")).toBe(false);
    expect(visitedChunk(pages, "-16,32")).toBe(false);
    expect(validVisitedPages(pages)).toBe(true);
    const original = JSON.stringify(pages);
    markVisited(pages, "-1,31");
    expect(JSON.stringify(pages)).toBe(original);
  });

  it("rejects noncanonical or unsafe coordinates and noncanonical page payloads", () => {
    for (const key of ["-0,0", "01,0", "0.5,0", "9007199254740992,0"]) {
      expect(validVisitedPages({ [key]: btoa("x".repeat(32)) })).toBe(false);
    }
    expect(validVisitedPages({ "0,0": btoa("\0".repeat(32)) })).toBe(false);
    expect(validVisitedPages({ "0,0": btoa("x".repeat(31)) })).toBe(false);
  });

  it("keeps visited metadata compact during travel and never credits standing, teleports or old chunks", () => {
    const content = structuredClone(PROTOTYPE);
    content.tuning.maxSpeed = 1024;
    content.tuning.safeRadius = 1e9;
    const flight = createFlight(content, 1, 1234, progress);
    stepFlight(content, 1, idle, flight);
    expect(flight.freshDistance).toBe(0);
    const right = { ...idle, move: { x: 1, y: 0 } };
    stepFlight(content, 20, right, flight);
    const before = flight.freshDistance;
    expect(before).toBeGreaterThan(content.tuning.chunkSize * 30);
    expect(Object.keys(flight.visited).length).toBeLessThanOrEqual(3);
    expect(Object.values(flight.visited).every((page) => page.length === 44)).toBe(true);
    expect(JSON.stringify(flight.visited).length).toBeLessThan(180);
    expect(flight.chunks.length).toBeLessThanOrEqual(49);
    const destination = ensureDestination(content, "growers", flight);
    destination.x = 0;
    destination.y = 0;
    flight.dangerFor = 0;
    expect(teleport(content, destination.id, flight)).toBe(true);
    expect(flight.freshDistance).toBe(before);
    stepFlight(content, 1, idle, flight);
    expect(flight.freshDistance).toBe(before);
    stepFlight(content, 20, right, flight);
    expect(flight.freshDistance).toBe(before);
    expect(visitedChunk(flight.visited, "0,0")).toBe(true);
    expect(visitedChunk(flight.visited, "30,0")).toBe(true);
  });
});
