import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { ENEMY_HEADINGS } from "../art/index.ts";
import {
  hasShipHeadings,
  paintFrames,
  selectPaintedShipAsset,
  selectShipAsset,
  type ShipAsset,
  shipDirection,
  skipShipPreload,
} from "../art/shipArt.ts";
import { SHIP_HEADINGS } from "../model/nose.ts";

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
  it("gives Ada's ship 64 headings while enemy craft keep 16", () => {
    expect(SHIP_HEADINGS).toBe(64);
    expect(ENEMY_HEADINGS).toBe(16);
  });

  it("needs every idle heading, ignoring thrust frames, painted entries and legacy aliases", () => {
    expect(hasShipHeadings([asset("ship", 40), ...headings(64)])).toBe(true);
    expect(hasShipHeadings(headings(64, true))).toBe(true);
    expect(hasShipHeadings(headings(16, true))).toBe(false);
    expect(hasShipHeadings(headings(64).filter((frame) => frame.directionIndex !== 63))).toBe(
      false,
    );
    const thrustOnly = headings(64, true).filter((frame) => frame.id.startsWith("ship-thrust"));
    expect(hasShipHeadings(thrustOnly)).toBe(false);
    const painted = headings(64).map((frame) => ({ ...frame, paint: "iris" }));
    expect(hasShipHeadings(painted)).toBe(false);
    expect(hasShipHeadings([asset("ship", 40), asset("ship-thrust", 40)])).toBe(false);
  });

  it.each(Array.from({ length: 64 }, (_, index) => index))(
    "maps world angle %s * 5.625 degrees to direction %s of 64",
    (index) => {
      expect(shipDirection(64, at(index * 5.625))).toBe(index);
    },
  );

  it.each([
    [1, 0, 0],
    [1, 1, 8],
    [0, 1, 16],
    [-1, 1, 24],
    [-1, 0, 32],
    [-1, -1, 40],
    [0, -1, 48],
    [1, -1, 56],
  ])("maps world facing (%s, %s) to direction %s of 64", (x, y, index) => {
    expect(shipDirection(64, { x: x!, y: y! })).toBe(index);
  });

  it("places ship heading 4k on enemy heading k, with up at 40 of 64 and 10 of 16", () => {
    expect(shipDirection(64, { x: -1, y: -1 })).toBe(40);
    expect(shipDirection(16, { x: -1, y: -1 })).toBe(10);
    for (let index = 0; index < 16; index++) {
      expect(shipDirection(64, at(index * 22.5))).toBe(4 * index);
    }
  });

  it.each([
    [64, 2.8125],
    [16, 11.25],
  ])("changes frames of %s at the nearest heading boundary, including the wrap", (count, half) => {
    expect(shipDirection(count, at(half - 0.01))).toBe(0);
    expect(shipDirection(count, at(half + 0.01))).toBe(1);
    expect(shipDirection(count, at(-half + 0.01))).toBe(0);
    expect(shipDirection(count, at(-half - 0.01))).toBe(count - 1);
  });

  it("snaps the sprite to the nearest of 64 headings for a continuous facing", () => {
    const assets = [asset("ship", 40), ...headings(64, true)];
    expect(selectShipAsset(assets, at(5.625))?.id).toBe("ship-1");
    expect(selectShipAsset(assets, at(8.4))?.id).toBe("ship-1");
    expect(selectShipAsset(assets, at(8.5))?.id).toBe("ship-2");
    expect(selectShipAsset(assets, { x: -1, y: -1 })?.id).toBe("ship-40");
  });

  it("selects the nearest heading from Art's manifest for all 64 headings, with up at 40", () => {
    const assets = manifest.assets as ShipAsset[];
    expect(hasShipHeadings(assets)).toBe(true);
    for (let index = 0; index < 64; index++) {
      const selected = selectShipAsset(assets, at(index * 5.625));
      expect(selected?.directionIndex).toBe(index);
      expect(selected?.id).toBe(`ship-${index}`);
    }
    expect(selectShipAsset(assets, { x: -1, y: -1 })?.id).toBe("ship-40");
    expect(assets.find((asset) => asset.id === "ship")?.directionIndex).toBe(40);
  });

  it("uses manifest direction metadata rather than array order or the legacy alias heading", () => {
    const up = asset("ship", 40);
    const frames = [...headings(64, true)].reverse();
    const right = frames.find((frame) => frame.id === "ship-56")!;
    const assets = [up, ...frames];
    expect(selectShipAsset(assets, { x: 1, y: -1 })).toBe(right);
    expect(selectShipAsset(assets, { x: -1, y: -1 })).toBe(
      frames.find((frame) => frame.id === "ship-40"),
    );
  });

  it("ignores a legacy thrust alias when selecting the matching hull", () => {
    const assets = [asset("ship-thrust", 40), ...headings(64)];
    const idle = assets.find((frame) => frame.id === "ship-24");
    expect(selectShipAsset(assets, { x: -1, y: 1 })).toBe(idle);
  });

  it("rejects legacy incomplete or absent heading sets without alias fallback", () => {
    const idle = asset("ship", 40);
    const thrust = asset("ship-thrust", 40);
    expect(selectShipAsset([idle, thrust, ...headings(16, true)], at(22.5))).toBeUndefined();
    expect(selectShipAsset([idle, thrust], { x: 1, y: 0 })).toBeUndefined();
    expect(selectShipAsset([idle], { x: 1, y: 0 })).toBeUndefined();
    expect(selectShipAsset([], { x: 1, y: 0 })).toBeUndefined();
  });
});

describe("ship frames loaded on demand", () => {
  const shipped = manifest.assets as ShipAsset[];

  it("excludes every legacy thrust ID from preload while retaining Classic", () => {
    const legacy = [asset("ship-thrust", 40), ...headings(64, true)];
    for (const frame of legacy) {
      expect(skipShipPreload(frame)).toBe(frame.id.startsWith("ship-thrust"));
    }
  });

  it("preloads the idle headings and their alias, and leaves painted frames for their scheme", () => {
    const preloaded = shipped.filter((frame) => !skipShipPreload(frame));
    expect(hasShipHeadings(preloaded)).toBe(true);
    expect(preloaded.some((frame) => frame.id === "ship")).toBe(true);
    expect(preloaded.some((frame) => frame.paint !== undefined)).toBe(false);
    expect(preloaded.some((frame) => frame.id.startsWith("ship-thrust"))).toBe(false);
    expect(paintFrames(shipped, "iris").every(skipShipPreload)).toBe(true);
  });
});

describe("ship paint schemes", () => {
  const shipped = manifest.assets as ShipAsset[];

  it("keeps Classic on the unpainted frames, skipping painted entries", () => {
    const classic = selectPaintedShipAsset(shipped, null, at(5.625));
    expect(classic?.id).toBe("ship-1");
    expect(classic?.paint).toBeUndefined();
  });

  it.each(["cobalt", "seafoam", "graphite", "iris"])(
    "selects %s hull frames by heading",
    (paint) => {
      expect(paintFrames(shipped, paint)).toHaveLength(64);
      for (let index = 0; index < 64; index++) {
        const frame = selectPaintedShipAsset(shipped, paint, at(index * 5.625));
        expect(frame?.id).toBe(`ship-${paint}-${index}`);
        expect(frame?.paint).toBe(paint);
      }
    },
  );

  it("falls back to Classic while a scheme's frames are not loaded", () => {
    const loaded = shipped.filter((asset) => asset.paint === undefined);
    expect(selectPaintedShipAsset(loaded, "iris", at(5.625))?.id).toBe("ship-1");
  });
});
