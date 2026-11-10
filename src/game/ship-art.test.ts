import { describe, expect, it } from "vitest";

import { selectShipAsset, type ShipAsset, shipDirection } from "./ship-art.ts";

const asset = (id: string, directionIndex: number): ShipAsset => ({
  directionIndex,
  displayHeight: 42,
  displayWidth: 42,
  id,
  pivot: { x: 0.5, y: 0.5 },
});

describe("authored ship headings", () => {
  it.each([
    [1, 0, 0],
    [1, 1, 1],
    [0, 1, 2],
    [-1, 1, 3],
    [-1, 0, 4],
    [-1, -1, 5],
    [0, -1, 6],
    [1, -1, 7],
  ])("maps world facing (%s, %s) to direction %s", (x, y, index) => {
    expect(shipDirection({ x: x!, y: y! })).toBe(index);
  });

  it("changes frames at the nearest world heading boundary, including the wrap to zero", () => {
    const at = (angle: number) => ({ x: Math.cos(angle), y: Math.sin(angle) });
    expect(shipDirection(at(Math.PI / 8 - 0.001))).toBe(0);
    expect(shipDirection(at(Math.PI / 8 + 0.001))).toBe(1);
    expect(shipDirection(at(-Math.PI / 8 + 0.001))).toBe(0);
    expect(shipDirection(at(-Math.PI / 8 - 0.001))).toBe(7);
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
    expect(selectShipAsset([asset("ship-thrust", 5), idle], true, { x: -1, y: 1 })).toBe(idle);
  });

  it("supports legacy-only manifests without inventing a directional texture", () => {
    const idle = asset("ship", 5);
    const thrust = asset("ship-thrust", 5);
    expect(selectShipAsset([idle, thrust], true, { x: 1, y: 0 })).toBe(thrust);
    expect(selectShipAsset([idle], true, { x: 1, y: 0 })).toBe(idle);
    expect(selectShipAsset([], false, { x: 1, y: 0 })).toBeUndefined();
  });
});
