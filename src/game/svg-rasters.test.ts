import { describe, expect, it } from "vitest";

import { SvgRasters, type SvgRequest } from "./svg-rasters.ts";
import { vectorRaster } from "./textures.ts";

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

  it("rasterises loaded SVGs again after a resize past 1.25 times, and not before", () => {
    const rasters = new SvgRasters(2);
    rasters.request(ship);
    rasters.request(rock);
    rasters.loaded("ship");
    rasters.loaded("rock");
    // 2 to 2.4 and back is within 1.25 times: the rasters stay.
    expect(rasters.resize(2.4)).toEqual([]);
    expect(rasters.resize(1.7)).toEqual([]);
    expect(rasters.scale).toBe(2);
    // The drift counts from the last raster, not the last resize.
    expect(rasters.resize(2.4)).toEqual([]);
    expect(rasters.resize(2.6)).toEqual([ship, rock]);
    expect(rasters.scale).toBe(2.6);
    expect(ship.size(rasters.scale)).toEqual({ height: 109, width: 109 });
    expect(rasters.resize(1.2)).toEqual([ship, rock]);
    expect(rasters.scale).toBe(1.2);
  });

  it("rasterises an SVG still loading at a replaced scale once it loads", () => {
    const rasters = new SvgRasters(1);
    rasters.request(ship);
    expect(rasters.resize(2)).toEqual([]);
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
