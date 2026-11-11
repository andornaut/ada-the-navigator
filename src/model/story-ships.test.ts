import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { SCREEN } from "../data/screen.ts";
import { CARTWHEEL_STORY_SHIPS, STORY_VIEW } from "../data/story-ships.ts";
import { drawnHeading, hubWorn, storyShips } from "./story-ships.ts";
import type { Vec } from "./types.ts";

const hub = { x: 1000, y: -500 };
const gap = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const ship = (ships: ReturnType<typeof storyShips>, id: string) =>
  ships.find((entry) => entry.id === id);

describe("Cartwheel story ships", () => {
  it("wait at their holding points facing the hub between scenes, without the blocker", () => {
    for (const stage of [0, 2, 4]) {
      const ships = storyShips(hub, { stage }, undefined, 40);
      expect(ships.map((entry) => entry.id)).toEqual(["miner", "visitor-1", "visitor-2"]);
      for (const entry of ships) {
        expect(entry.thrust).toBe(false);
        const toHub = { x: hub.x - entry.x, y: hub.y - entry.y };
        expect(entry.heading.x * toHub.x + entry.heading.y * toHub.y).toBeCloseTo(
          gap(entry, hub),
          6,
        );
      }
    }
  });

  it("plays the blocked scene: the blocker cuts across and the miner turns away", () => {
    const scene = { at: 10, id: "blocked" as const, lineDue: true };
    const { duration } = CARTWHEEL_STORY_SHIPS.scenes.blocked;
    const closest = Array.from({ length: 80 }, (_, index) => {
      const ships = storyShips(hub, { stage: 2 }, scene, scene.at + (index / 80) * duration);
      return gap(ship(ships, "miner")!, ship(ships, "blocker")!);
    });
    expect(Math.min(...closest)).toBeLessThan(80);
    const middle = storyShips(hub, { stage: 2 }, scene, scene.at + 3);
    expect(ship(middle, "miner")!.thrust).toBe(true);
    expect(ship(middle, "blocker")!.thrust).toBe(true);
    expect(ship(middle, "visitor-1")!.thrust).toBe(false);
    const nearest = Math.min(
      ...Array.from({ length: 81 }, (_, index) =>
        gap(ship(storyShips(hub, { stage: 2 }, scene, scene.at + index / 10), "miner")!, hub),
      ),
    );
    // The miner never reaches the hub, and is back holding once the scene ends.
    expect(nearest).toBeGreaterThan(100);
    const after = storyShips(hub, { stage: 2 }, scene, scene.at + duration);
    expect(ship(after, "blocker")).toBeUndefined();
    expect(ship(after, "miner")).toMatchObject({
      thrust: false,
      x: hub.x + CARTWHEEL_STORY_SHIPS.hold.miner.x,
      y: hub.y + CARTWHEEL_STORY_SHIPS.hold.miner.y,
    });
  });

  it("plays the docking scene: the regulars dock together, the blocker flies off", () => {
    const scene = { at: 5, id: "docking" as const, lineDue: true };
    const { duration } = CARTWHEEL_STORY_SHIPS.scenes.docking;
    const end = storyShips(hub, { stage: 5 }, scene, scene.at + duration - 0.01);
    for (const id of ["miner", "visitor-1", "visitor-2"]) {
      expect(gap(ship(end, id)!, hub)).toBeLessThan(80);
    }
    expect(gap(ship(end, "blocker")!, hub)).toBeGreaterThan(1200);
    expect(storyShips(hub, { stage: 5 }, scene, scene.at + duration)).toEqual([]);
    expect(storyShips(hub, { stage: 5 }, undefined, 0)).toEqual([]);
  });

  it("hold inside the view centred on the docked hub, clear of the hub and each other", () => {
    const { destinations, hold } = CARTWHEEL_STORY_SHIPS;
    const reach = STORY_VIEW.shipReach;
    for (const point of [...Object.values(hold), ...Object.values(destinations)]) {
      // A hub-relative world offset draws at (x - y, (x + y) / 2) from the view's centre.
      const across = Math.abs(point.x - point.y) + reach * Math.SQRT2;
      const down = Math.abs(point.x + point.y) / 2 + reach * Math.SQRT1_2;
      expect(across).toBeLessThanOrEqual(SCREEN.width / 2 - STORY_VIEW.margin);
      expect(down).toBeLessThanOrEqual(SCREEN.height / 2 - STORY_VIEW.margin);
      expect(Math.hypot(point.x, point.y)).toBeGreaterThan(PROTOTYPE.tuning.safeRadius);
    }
    expect(gap(destinations.miner, destinations.visitors)).toBeGreaterThanOrEqual(
      PROTOTYPE.tuning.safeRadius * 2,
    );
    expect(gap(hold["visitor-1"], hold["visitor-2"])).toBeGreaterThan(reach * 2);
  });

  it("snaps headings to 16 drawn directions", () => {
    const snapped = drawnHeading({ x: Math.cos(0.3), y: Math.sin(0.3) });
    expect(Math.atan2(snapped.y, snapped.x)).toBeCloseTo((Math.PI * 2) / 16, 12);
    expect(drawnHeading({ x: 0, y: -1 })).toMatchObject({ y: -1 });
  });

  it("keeps the hub worn until Hub repairs is funded", () => {
    expect(hubWorn({})).toBe(true);
    expect(hubWorn({ funded: ["dockingBay"] })).toBe(true);
    expect(hubWorn({ funded: ["hubRepairs"] })).toBe(false);
  });
});
