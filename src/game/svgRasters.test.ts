import { describe, expect, it } from "vitest";

import { SvgRasters, type SvgRequest, vectorRaster } from "../art/index.ts";

const ship: SvgRequest = {
  key: "ship",
  path: "/art/ship.svg",
  size: (scale) => vectorRaster(scale, { displayHeight: 42, displayWidth: 42 }),
};
const rock: SvgRequest = { key: "rock", path: "/art/rock.svg", size: (scale) => ({ scale }) };

describe("SVG rasters", () => {
  it("loads each SVG at the camera's on-screen scale, capped at 4", () => {
    expect(new SvgRasters(2.1667).request(ship)).toEqual({ height: 91, width: 91 });
    expect(new SvgRasters(7.1).request(rock)).toEqual({ scale: 4 });
  });

  it("leaves loaded SVGs stale after a resize past 1.25 times, and not before", () => {
    const rasters = new SvgRasters(2);
    rasters.request(ship);
    rasters.request(rock);
    rasters.loaded("ship");
    rasters.loaded("rock");
    // 2 to 2.4 and back is within 1.25 times: the rasters stay.
    expect(rasters.resize(2.4)).toBe(false);
    expect(rasters.resize(1.7)).toBe(false);
    expect(rasters.scale).toBe(2);
    expect(rasters.pending).toBe(false);
    // The drift counts from the last raster, not the last resize.
    expect(rasters.resize(2.4)).toBe(false);
    expect(rasters.resize(2.6)).toBe(true);
    expect(rasters.scale).toBe(2.6);
    expect(rasters.pending).toBe(true);
    expect(ship.size(rasters.scale)).toEqual({ height: 109, width: 109 });
  });

  it("rasterises again only the stale SVGs drawn, each once, the rest on their first draw", () => {
    const rasters = new SvgRasters(2);
    for (const request of [ship, rock]) {
      rasters.request(request);
      rasters.loaded(request.key);
    }
    rasters.resize(4);
    expect(rasters.due((key) => key === "ship")).toEqual([ship]);
    expect(rasters.due((key) => key === "ship")).toEqual([]);
    expect(rasters.pending).toBe(true);
    // The rock is first drawn frames later, stamped into a group.
    expect(rasters.due(() => false)).toEqual([]);
    rasters.mark("rock");
    expect(rasters.due(() => false)).toEqual([rock]);
    expect(rasters.pending).toBe(false);
    // After the next resize, being drawn again is what makes it due.
    rasters.resize(2);
    rasters.mark("rock");
    expect(rasters.due(() => false)).toEqual([rock]);
    expect(rasters.due(() => false)).toEqual([]);
  });

  it("drops a stale SVG the scale has come back to without rasterising it", () => {
    const rasters = new SvgRasters(2);
    rasters.request(rock);
    rasters.loaded("rock");
    rasters.resize(4);
    rasters.resize(2);
    expect(rasters.due(() => true)).toEqual([]);
    expect(rasters.pending).toBe(false);
  });

  it("rasterises an SVG still loading at a replaced scale once it loads", () => {
    const rasters = new SvgRasters(1);
    rasters.request(ship);
    expect(rasters.resize(2)).toBe(true);
    expect(rasters.pending).toBe(false);
    expect(rasters.loaded("ship")).toBe(ship);
    // Loaded and current now: nothing more to do, and later loads report nothing.
    expect(rasters.loaded("ship")).toBeUndefined();
    expect(rasters.loaded("unknown")).toBeUndefined();
  });

  it("keeps an SVG loaded at the current scale", () => {
    const rasters = new SvgRasters(2);
    rasters.request(ship);
    expect(rasters.loaded("ship")).toBeUndefined();
  });
});
