import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PROJECTS } from "../data/projects.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { SCREEN } from "../data/screen.ts";
import {
  CARTWHEEL_STORY_SHIPS,
  MOORING_BUOY,
  STORY_SHIP_CRAFT,
  STORY_VIEW,
} from "../data/story-ships.ts";
import { storyNoses } from "../game/cartwheel-art.ts";
import { shipDirection } from "../game/ship-art.ts";
import { ART_MANIFEST } from "../testing/public-art.ts";
import { dockedSpot, drawnHeading, hubBay, hubWorn, storyShips } from "./story-ships.ts";
import type { Vec } from "./types.ts";

// Each craft's nose by heading, from Art's jets files.
const NOSES = storyNoses((craft) =>
  JSON.parse(
    readFileSync(new URL(`../../public/art/cartwheel/${craft}-jets.json`, import.meta.url), "utf8"),
  ),
);
// No bay and no nose data: each pivot on its dock point.
const UNDOCKED = { bay: false, noses: {} };

const manifest = ART_MANIFEST as unknown as {
  assets: {
    craft?: string;
    displayHeight?: number;
    displayWidth?: number;
    height: number;
    id: string;
    moorings?: unknown;
    pivot: Vec;
    width: number;
  }[];
};
const STORY_CRAFT = /^craft-([a-z][a-z0-9]*)-(\d+)$/;
const hub = { x: 1000, y: -500 };
const gap = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const ship = (ships: ReturnType<typeof storyShips>, id: string) =>
  ships.find((entry) => entry.id === id);

describe("Cartwheel story ships", () => {
  it("wait at their holding points facing the hub between scenes, without the blocker", () => {
    for (const stage of [0, 2, 4]) {
      const ships = storyShips(hub, { stage }, UNDOCKED, undefined, 40);
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
      const ships = storyShips(
        hub,
        { stage: 2 },
        UNDOCKED,
        scene,
        scene.at + (index / 80) * duration,
      );
      return gap(ship(ships, "miner")!, ship(ships, "blocker")!);
    });
    expect(Math.min(...closest)).toBeLessThan(80);
    const middle = storyShips(hub, { stage: 2 }, UNDOCKED, scene, scene.at + 3);
    expect(ship(middle, "miner")!.thrust).toBe(true);
    expect(ship(middle, "blocker")!.thrust).toBe(true);
    expect(ship(middle, "visitor-1")!.thrust).toBe(false);
    const nearest = Math.min(
      ...Array.from({ length: 81 }, (_, index) =>
        gap(
          ship(storyShips(hub, { stage: 2 }, UNDOCKED, scene, scene.at + index / 10), "miner")!,
          hub,
        ),
      ),
    );
    // The miner never reaches the hub, and is back holding once the scene ends.
    expect(nearest).toBeGreaterThan(100);
    const after = storyShips(hub, { stage: 2 }, UNDOCKED, scene, scene.at + duration);
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
    const end = storyShips(hub, { stage: 5 }, UNDOCKED, scene, scene.at + duration - 0.01);
    for (const id of ["miner", "visitor-1", "visitor-2"]) {
      expect(gap(ship(end, id)!, hub)).toBeLessThan(80);
    }
    expect(gap(ship(end, "blocker")!, hub)).toBeGreaterThan(1200);
    // Once the scene ends the regulars stay where it docked them, and the blocker is gone.
    const docked = storyShips(hub, { stage: 5 }, UNDOCKED, scene, scene.at + duration);
    expect(docked.map(({ id }) => id)).toEqual(["miner", "visitor-1", "visitor-2"]);
    for (const id of ["miner", "visitor-1", "visitor-2"] as const) {
      expect(gap(ship(docked, id)!, ship(end, id)!)).toBeLessThan(1);
    }
    expect(storyShips(hub, { stage: 5 }, UNDOCKED, undefined, 0)).toEqual(docked);
  });

  it("dock the regulars with their noses at the dock faces, facing into their docks", () => {
    const { docked } = CARTWHEEL_STORY_SHIPS;
    expect(Object.keys(NOSES).sort()).toEqual(["blocker", "miner", "visitor-1", "visitor-2"]);
    for (const [bay, docks] of [
      [false, docked.hub],
      [true, docked.bay],
    ] as const) {
      const docking = { bay, noses: NOSES };
      const ships = storyShips(hub, { stage: 5 }, docking, undefined, 100);
      expect(ships.map(({ id }) => id)).toEqual(["miner", "visitor-1", "visitor-2"]);
      for (const entry of ships) {
        const id = entry.id as keyof typeof docks;
        const dock = docks[id];
        expect(entry).toMatchObject({ heading: dock.heading, thrust: false });
        expect(Math.hypot(entry.heading.x, entry.heading.y)).toBeCloseTo(1, 9);
        // The nose distance at the heading the scene draws, from the craft's jets file.
        const distance = NOSES[id]![shipDirection(16, dock.heading)]!;
        expect(distance).toBeGreaterThan(0);
        // The pivot stands that far outward of the dock point, so the nose meets the dock face.
        expect(gap(entry, { x: hub.x + dock.at.x, y: hub.y + dock.at.y })).toBeCloseTo(distance, 9);
        expect(entry.x + entry.heading.x * distance).toBeCloseTo(hub.x + dock.at.x, 9);
        expect(entry.y + entry.heading.y * distance).toBeCloseTo(hub.y + dock.at.y, 9);
        const spot = dockedSpot(docking, id).at;
        expect(spot.x).toBeCloseTo(entry.x - hub.x, 9);
        expect(spot.y).toBeCloseTo(entry.y - hub.y, 9);
      }
      // The docking scene's paths end at the docked spots, so nothing jumps when it ends.
      const scene = { at: 5, id: "docking" as const, lineDue: false };
      const { duration } = CARTWHEEL_STORY_SHIPS.scenes.docking;
      const ending = storyShips(hub, { stage: 5 }, docking, scene, scene.at + duration - 1e-9);
      for (const entry of ships) {
        expect(gap(ship(ending, entry.id)!, entry), `${entry.id} bay ${bay}`).toBeLessThan(1e-6);
      }
    }
    // The live dock draws heading 10; without nose data a pivot stays on its dock point.
    expect(shipDirection(16, docked.hub.miner.heading)).toBe(10);
    const bare = storyShips(hub, { stage: 5 }, UNDOCKED, undefined, 100);
    expect(ship(bare, "miner")).toMatchObject({
      x: hub.x + docked.hub.miner.at.x,
      y: hub.y + docked.hub.miner.at.y,
    });
    // The miner at the live dock faces screen-up into it: world (-1, -1) / sqrt 2.
    expect(docked.hub.miner.heading.x).toBeCloseTo(-Math.SQRT1_2, 9);
    expect(docked.hub.miner.heading.y).toBeCloseTo(-Math.SQRT1_2, 9);
    // The bay moves the first visitor to its berth; the miner and the second visitor stay.
    expect(docked.bay["visitor-1"]).not.toEqual(docked.hub["visitor-1"]);
    expect(docked.bay.miner).toEqual(docked.hub.miner);
    expect(docked.bay["visitor-2"]).toEqual(docked.hub["visitor-2"]);
  });

  it("moor inside the view centred on the docked hub, clear of the hub and each other", () => {
    const { buoys, destinations, hold } = CARTWHEEL_STORY_SHIPS;
    const assets = new Map(manifest.assets.map((asset) => [asset.id, asset]));
    const drawn = (point: Vec, width: number, height: number) => {
      // A hub-relative world offset draws at (x - y, (x + y) / 2) from the view's centre.
      expect(Math.abs(point.x - point.y) + width / 2).toBeLessThanOrEqual(
        SCREEN.width / 2 - STORY_VIEW.margin,
      );
      expect(Math.abs(point.x + point.y) / 2 + height / 2).toBeLessThanOrEqual(
        SCREEN.height / 2 - STORY_VIEW.margin,
      );
      expect(Math.hypot(point.x, point.y)).toBeGreaterThan(PROTOTYPE.tuning.safeRadius);
    };
    for (const [id, point] of Object.entries(hold)) {
      const frame = assets.get(`craft-${STORY_SHIP_CRAFT[id as keyof typeof hold]}-0`)!;
      drawn(point, frame.displayWidth!, frame.displayHeight!);
    }
    const buoy = assets.get("mooring-buoy-a")!;
    for (const point of Object.values(buoys)) {
      drawn(point, buoy.displayWidth!, buoy.displayHeight!);
    }
    expect(destinations).toEqual(buoys);
    expect(gap(destinations.miner, destinations.visitors)).toBeGreaterThanOrEqual(
      PROTOTYPE.tuning.safeRadius * 2,
    );
    // The visitors' frames do not overlap on screen.
    const [a, b] = [hold["visitor-1"], hold["visitor-2"]];
    expect(Math.hypot(a.x - a.y - (b.x - b.y), (a.x + a.y - b.x - b.y) / 2)).toBeGreaterThan(
      assets.get("craft-visitor1-0")!.displayWidth!,
    );
  });

  it("use Art's craft sizes, buoy moorings and 16 headings per story craft", () => {
    const craft = manifest.assets.filter((asset) => asset.craft && STORY_CRAFT.test(asset.id));
    expect(Math.max(...craft.map((asset) => asset.displayWidth! / 2))).toBe(STORY_VIEW.drawnHalf);
    for (const name of Object.values(STORY_SHIP_CRAFT)) {
      expect(craft.filter((asset) => asset.craft === name)).toHaveLength(16);
    }
    const buoy = manifest.assets.find((asset) => asset.id === "mooring-buoy-a")!;
    expect({ height: buoy.height, width: buoy.width }).toEqual(MOORING_BUOY.frame);
    expect(buoy.pivot).toEqual(MOORING_BUOY.pivot);
    expect(buoy.displayWidth! / buoy.width).toBe(MOORING_BUOY.displayScale);
    expect(buoy.moorings).toEqual(
      ["left", "right", "back"].map(
        (tip) => MOORING_BUOY.moorings[tip as keyof typeof MOORING_BUOY.moorings],
      ),
    );
  });

  it("snaps headings to 16 drawn directions", () => {
    const snapped = drawnHeading({ x: Math.cos(0.3), y: Math.sin(0.3) });
    expect(Math.atan2(snapped.y, snapped.x)).toBeCloseTo((Math.PI * 2) / 16, 12);
    expect(drawnHeading({ x: 0, y: -1 })).toMatchObject({ y: -1 });
  });

  it("keeps the hub worn until Hub repairs is funded, and adds the bay once it is funded", () => {
    const cost = (id: string) => PROJECTS[2]!.find((project) => project.id === id)!.cost;
    const progress = (donated: Record<string, number>) => ({
      donated,
      resolved: true,
      revealed: [],
    });
    expect(hubWorn(progress({}))).toBe(true);
    expect(hubWorn(progress({ dockingBay: cost("dockingBay") }))).toBe(true);
    expect(hubWorn(progress({ hubRepairs: cost("hubRepairs") - 1 }))).toBe(true);
    expect(hubWorn(progress({ hubRepairs: cost("hubRepairs") }))).toBe(false);
    expect(hubBay(progress({ dockingBay: cost("dockingBay") - 1 }))).toBe(false);
    expect(hubBay(progress({ dockingBay: cost("dockingBay") }))).toBe(true);
  });
});
