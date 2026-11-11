import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { selectShipAsset, type ShipAsset, shipDirection, shipDirectionCount } from "./ship-art.ts";

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
  it("counts headings from directional idle and thrust frames, ignoring legacy aliases", () => {
    expect(shipDirectionCount([asset("ship", 10), ...headings(16, true)])).toBe(16);
    expect(shipDirectionCount([asset("ship", 5), ...headings(8)])).toBe(8);
    expect(shipDirectionCount([asset("ship-0", 0), asset("ship-thrust-7", 7)])).toBe(8);
    expect(shipDirectionCount([asset("ship", 5), asset("ship-thrust", 5)])).toBe(0);
  });

  it.each(Array.from({ length: 16 }, (_, index) => index))(
    "maps world angle %s * 22.5 degrees to direction %s of 16",
    (index) => {
      expect(shipDirection(16, at(index * 22.5))).toBe(index);
    },
  );

  it("places up (world -135 degrees) at index 10 of 16 and 5 of 8", () => {
    expect(shipDirection(16, { x: -1, y: -1 })).toBe(10);
    expect(shipDirection(8, { x: -1, y: -1 })).toBe(5);
  });

  it.each([
    [1, 0, 0],
    [1, 1, 1],
    [0, 1, 2],
    [-1, 1, 3],
    [-1, 0, 4],
    [-1, -1, 5],
    [0, -1, 6],
    [1, -1, 7],
  ])("maps world facing (%s, %s) to direction %s of 8", (x, y, index) => {
    expect(shipDirection(8, { x: x!, y: y! })).toBe(index);
  });

  it.each([
    [16, 11.25],
    [8, 22.5],
  ])("changes frames of %s at the nearest heading boundary, including the wrap", (count, half) => {
    expect(shipDirection(count, at(half - 0.01))).toBe(0);
    expect(shipDirection(count, at(half + 0.01))).toBe(1);
    expect(shipDirection(count, at(-half + 0.01))).toBe(0);
    expect(shipDirection(count, at(-half - 0.01))).toBe(count - 1);
  });

  it("selects among 16 headings by the manifest's directional frames", () => {
    const assets = [asset("ship", 10), ...headings(16, true)];
    expect(selectShipAsset(assets, false, at(22.5))?.id).toBe("ship-1");
    expect(selectShipAsset(assets, true, at(22.5))?.id).toBe("ship-thrust-1");
    expect(selectShipAsset(assets, false, { x: -1, y: -1 })?.id).toBe("ship-10");
  });

  it("selects the quantized heading from Art's manifest for all 16 headings, with up at 10", () => {
    const assets = manifest.assets as ShipAsset[];
    expect(shipDirectionCount(assets)).toBe(16);
    for (let index = 0; index < 16; index++) {
      for (const thrust of [false, true]) {
        const selected = selectShipAsset(assets, thrust, at(index * 22.5));
        expect(selected?.directionIndex).toBe(index);
        expect(selected?.id).toBe(thrust ? `ship-thrust-${index}` : `ship-${index}`);
      }
    }
    expect(selectShipAsset(assets, false, { x: -1, y: -1 })?.id).toBe("ship-10");
    expect(assets.find((asset) => asset.id === "ship")?.directionIndex).toBe(10);
  });

  it("uses manifest direction metadata rather than array order or the legacy alias heading", () => {
    const up = asset("ship", 5);
    const right = asset("ship-7", 7);
    const thrust = asset("ship-thrust-7", 7);
    const assets = [up, thrust, asset("ship-0", 0), right];
    expect(selectShipAsset(assets, false, { x: 1, y: -1 })).toBe(right);
    expect(selectShipAsset(assets, true, { x: 1, y: -1 })).toBe(thrust);
    expect(selectShipAsset(assets, false, { x: -1, y: -1 })).toBe(up);
  });

  it("preserves the matching idle perspective when a thrust frame is unavailable", () => {
    const idle = asset("ship-3", 3);
    expect(
      selectShipAsset([asset("ship-thrust", 5), asset("ship-7", 7), idle], true, { x: -1, y: 1 }),
    ).toBe(idle);
  });

  it("supports legacy-only manifests without inventing a directional texture", () => {
    const idle = asset("ship", 5);
    const thrust = asset("ship-thrust", 5);
    expect(selectShipAsset([idle, thrust], true, { x: 1, y: 0 })).toBe(thrust);
    expect(selectShipAsset([idle], true, { x: 1, y: 0 })).toBe(idle);
    expect(selectShipAsset([], false, { x: 1, y: 0 })).toBeUndefined();
  });
});
