import { describe, expect, it } from "vitest";

import { rowAction, stationBack } from "./station.ts";

describe("station card back steps", () => {
  it("returns from the shop to the station card and undocks only from the card", () => {
    expect(stationBack("shop", false)).toBe("card");
    expect(stationBack("card", false)).toBe("undock");
  });

  it("cancels an open confirm back to the shop", () => {
    expect(stationBack("shop", true)).toBe("shop");
  });
});

describe("shop row taps", () => {
  it("keeps unaffordable rows tappable so they refuse", () => {
    expect(rowAction("unaffordable")).toBe("request");
    expect(rowAction("forSale")).toBe("request");
  });

  it("applies an owned paint at once and ignores owned and in-use rows", () => {
    expect(rowAction("selectable")).toBe("select");
    expect(rowAction("owned")).toBe("none");
    expect(rowAction("inUse")).toBe("none");
  });
});
