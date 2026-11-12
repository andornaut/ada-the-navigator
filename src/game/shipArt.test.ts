import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { SHIP_HEADINGS } from "../model/nose.ts";
import { ENEMY_HEADINGS } from "./enemyArt.ts";
import {
  hasShipHeadings,
  loadsOnDemand,
  paintFrames,
  selectPaintedShipAsset,
  selectShipAsset,
  type ShipAsset,
  shipDirection,
  thrustFrames,
} from "./shipArt.ts";

const asset = (id: string, directionIndex: number): ShipAsset => ({
  directionIndex,
  displayHeight: 42,
  displayWidth: 42,
  id,
  pivot: { x: 0.5, y: 0.5 },
});
const at = (degrees: number) => ({
  x: Math.cos((degrees * Math.PI) / 180),
  y: Math.sin((degrees * Math.PI) / 180),
});
const headings = (count: number, thrust = false) =>
  Array.from({ length: count }, (_, index) => asset(`ship-${index}`, index)).concat(
    thrust ? Array.from({ length: count }, (_, index) => asset(`ship-thrust-${index}`, index)) : [],
  );

describe("authored ship headings", () => {
  it("gives Ada's ship 32 headings while enemy craft keep 16", () => {
    expect(SHIP_HEADINGS).toBe(32);
    expect(ENEMY_HEADINGS).toBe(16);
  });

  it("needs every idle heading, ignoring thrust frames, painted entries and legacy aliases", () => {
    expect(hasShipHeadings([asset("ship", 20), ...headings(32)])).toBe(true);
    expect(hasShipHeadings(headings(32, true))).toBe(true);
    expect(hasShipHeadings(headings(16, true))).toBe(false);
    expect(hasShipHeadings(headings(32).filter((frame) => frame.directionIndex !== 31))).toBe(
      false,
    );
    const thrustOnly = headings(32, true).filter((frame) => frame.id.startsWith("ship-thrust"));
    expect(hasShipHeadings(thrustOnly)).toBe(false);
    const painted = headings(32).map((frame) => ({ ...frame, paint: "iris" }));
    expect(hasShipHeadings(painted)).toBe(false);
    expect(hasShipHeadings([asset("ship", 20), asset("ship-thrust", 20)])).toBe(false);
  });

  it.each(Array.from({ length: 32 }, (_, index) => index))(
    "maps world angle %s * 11.25 degrees to direction %s of 32",
    (index) => {
      expect(shipDirection(32, at(index * 11.25))).toBe(index);
    },
  );

  it.each([
    [1, 0, 0],
    [1, 1, 4],
    [0, 1, 8],
    [-1, 1, 12],
    [-1, 0, 16],
    [-1, -1, 20],
    [0, -1, 24],
    [1, -1, 28],
  ])("maps world facing (%s, %s) to direction %s of 32", (x, y, index) => {
    expect(shipDirection(32, { x: x!, y: y! })).toBe(index);
  });

  it("places ship heading 2k on enemy heading k, with up at 20 of 32 and 10 of 16", () => {
    expect(shipDirection(32, { x: -1, y: -1 })).toBe(20);
    expect(shipDirection(16, { x: -1, y: -1 })).toBe(10);
    for (let index = 0; index < 16; index++) {
      expect(shipDirection(32, at(index * 22.5))).toBe(2 * index);
    }
  });

  it.each([
    [32, 5.625],
    [16, 11.25],
  ])("changes frames of %s at the nearest heading boundary, including the wrap", (count, half) => {
    expect(shipDirection(count, at(half - 0.01))).toBe(0);
    expect(shipDirection(count, at(half + 0.01))).toBe(1);
    expect(shipDirection(count, at(-half + 0.01))).toBe(0);
    expect(shipDirection(count, at(-half - 0.01))).toBe(count - 1);
  });

  it("snaps the sprite to the nearest of 32 headings for a continuous facing", () => {
    const assets = [asset("ship", 20), ...headings(32, true)];
    expect(selectShipAsset(assets, false, at(11.25))?.id).toBe("ship-1");
    expect(selectShipAsset(assets, true, at(11.25))?.id).toBe("ship-thrust-1");
    expect(selectShipAsset(assets, false, at(16.8))?.id).toBe("ship-1");
    expect(selectShipAsset(assets, false, at(17))?.id).toBe("ship-2");
    expect(selectShipAsset(assets, false, { x: -1, y: -1 })?.id).toBe("ship-20");
  });

  it("selects the nearest heading from Art's manifest for all 32 headings, with up at 20", () => {
    const assets = manifest.assets as ShipAsset[];
    expect(hasShipHeadings(assets)).toBe(true);
    for (let index = 0; index < 32; index++) {
      for (const thrust of [false, true]) {
        const selected = selectShipAsset(assets, thrust, at(index * 11.25));
        expect(selected?.directionIndex).toBe(index);
        expect(selected?.id).toBe(thrust ? `ship-thrust-${index}` : `ship-${index}`);
      }
    }
    expect(selectShipAsset(assets, false, { x: -1, y: -1 })?.id).toBe("ship-20");
    expect(assets.find((asset) => asset.id === "ship")?.directionIndex).toBe(20);
    expect(assets.find((asset) => asset.id === "ship-thrust")?.directionIndex).toBe(20);
  });

  it("uses manifest direction metadata rather than array order or the legacy alias heading", () => {
    const up = asset("ship", 20);
    const frames = [...headings(32, true)].reverse();
    const right = frames.find((frame) => frame.id === "ship-28")!;
    const thrust = frames.find((frame) => frame.id === "ship-thrust-28")!;
    const assets = [up, ...frames];
    expect(selectShipAsset(assets, false, { x: 1, y: -1 })).toBe(right);
    expect(selectShipAsset(assets, true, { x: 1, y: -1 })).toBe(thrust);
    expect(selectShipAsset(assets, false, { x: -1, y: -1 })).toBe(
      frames.find((frame) => frame.id === "ship-20"),
    );
  });

  it("preserves the matching idle perspective when a thrust frame is unavailable", () => {
    const assets = [asset("ship-thrust", 20), ...headings(32)];
    const idle = assets.find((frame) => frame.id === "ship-12");
    expect(selectShipAsset(assets, true, { x: -1, y: 1 })).toBe(idle);
  });

  it("keeps the legacy aliases when the heading set is incomplete or absent", () => {
    const idle = asset("ship", 20);
    const thrust = asset("ship-thrust", 20);
    expect(selectShipAsset([idle, thrust, ...headings(16, true)], false, at(22.5))).toBe(idle);
    expect(selectShipAsset([idle, thrust], true, { x: 1, y: 0 })).toBe(thrust);
    expect(selectShipAsset([idle], true, { x: 1, y: 0 })).toBe(idle);
    expect(selectShipAsset([], false, { x: 1, y: 0 })).toBeUndefined();
  });
});

describe("ship frames loaded on demand", () => {
  const shipped = manifest.assets as ShipAsset[];

  it("loads Art's 32 thrust frames and their alias only without valid jets", () => {
    const thrust = thrustFrames(shipped);
    expect(thrust.map((frame) => frame.id).sort()).toEqual(
      ["ship-thrust", ...Array.from({ length: 32 }, (_, index) => `ship-thrust-${index}`)].sort(),
    );
    expect(thrust.every(loadsOnDemand)).toBe(true);
  });

  it("preloads the idle headings and their alias, and leaves painted frames for their scheme", () => {
    const preloaded = shipped.filter((frame) => !loadsOnDemand(frame));
    expect(hasShipHeadings(preloaded)).toBe(true);
    expect(preloaded.some((frame) => frame.id === "ship")).toBe(true);
    expect(preloaded.some((frame) => frame.paint !== undefined)).toBe(false);
    expect(preloaded.some((frame) => frame.id.startsWith("ship-thrust"))).toBe(false);
    expect(paintFrames(shipped, "iris").every(loadsOnDemand)).toBe(true);
  });

  it("draws the idle heading while thrusting until the thrust frames load", () => {
    const preloaded = shipped.filter((frame) => !loadsOnDemand(frame));
    expect(selectShipAsset(preloaded, true, at(11.25))?.id).toBe("ship-1");
    expect(selectShipAsset(shipped, true, at(11.25))?.id).toBe("ship-thrust-1");
  });
});

describe("ship paint schemes", () => {
  const shipped = manifest.assets as ShipAsset[];

  it("keeps Classic on the unpainted frames, skipping painted entries", () => {
    const classic = selectPaintedShipAsset(shipped, null, false, at(11.25));
    expect(classic?.id).toBe("ship-1");
    expect(classic?.paint).toBeUndefined();
  });

  it.each(["cobalt", "seafoam", "graphite", "iris"])(
    "selects %s idle frames by heading and keeps them for thrust",
    (paint) => {
      expect(paintFrames(shipped, paint)).toHaveLength(32);
      for (let index = 0; index < 32; index++) {
        for (const thrust of [false, true]) {
          const frame = selectPaintedShipAsset(shipped, paint, thrust, at(index * 11.25));
          expect(frame?.id).toBe(`ship-${paint}-${index}`);
          expect(frame?.paint).toBe(paint);
        }
      }
    },
  );

  it("falls back to Classic while a scheme's frames are not loaded", () => {
    const loaded = shipped.filter((asset) => asset.paint === undefined);
    expect(selectPaintedShipAsset(loaded, "iris", false, at(11.25))?.id).toBe("ship-1");
  });
});
