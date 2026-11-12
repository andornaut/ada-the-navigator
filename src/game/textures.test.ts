import { describe, expect, it } from "vitest";

import { ART_MANIFEST } from "../testing/publicArt.ts";
import { parentFit } from "./playCamera.ts";
import { fileFilter, needsRaster, RASTER_CAP, rasterScale, vectorRaster } from "./textures.ts";

describe("texture filters", () => {
  it("samples SVGs linear and sheets nearest, and leaves other files alone", () => {
    expect(fileFilter("svg")).toBe("linear");
    expect(fileFilter("spritesheet")).toBe("nearest");
    expect(fileFilter("json")).toBeUndefined();
    expect(fileFilter("toString")).toBeUndefined();
  });
});

describe("raster drift", () => {
  it("rasterises again past 1.25 times either way, and not within it", () => {
    expect(needsRaster(2, 2.5)).toBe(false);
    expect(needsRaster(2, 2.51)).toBe(true);
    expect(needsRaster(2, 1.6)).toBe(false);
    expect(needsRaster(2, 1.59)).toBe(true);
  });
});

describe("vector raster size", () => {
  const frigate = { displayHeight: 168, displayWidth: 168 };

  it.each([
    // CSS size, DPR, raster scale: logical x fit x min(DPR, 2), at most 4.
    [{ height: 720, width: 1280 }, 1, 1.7778],
    [{ height: 390, width: 844 }, 2, 2.1667],
    [{ height: 390, width: 844 }, 3, 2.1667],
    [{ height: 720, width: 1280 }, 2, 3.5556],
    [{ height: 1080, width: 1920 }, 2, 4],
    [{ height: 360, width: 720 }, 1, 1],
  ])("rasterises a %o canvas at DPR %s at %s texels per logical px", (css, dpr, scale) => {
    const zoom = parentFit(dpr, { offsetHeight: css.height, offsetWidth: css.width }).zoom;
    expect(rasterScale(zoom)).toBeCloseTo(scale, 4);
    const size = vectorRaster(rasterScale(zoom), frigate);
    expect(size.width).toBe(Math.round(168 * Math.min(4, zoom)));
    expect(size.width).toBeLessThanOrEqual(168 * RASTER_CAP);
  });

  it("treats a zoom that is not positive as 1", () => {
    expect(rasterScale(0)).toBe(1);
    expect(rasterScale(Number.NaN)).toBe(1);
  });

  it("rasterises at the display size times the scale, whole", () => {
    expect(vectorRaster(1, frigate)).toEqual({ height: 168, width: 168 });
    expect(vectorRaster(1.5, frigate)).toEqual({ height: 252, width: 252 });
    expect(vectorRaster(2, frigate)).toEqual({ height: 336, width: 336 });
    expect(vectorRaster(1.3, { displayHeight: 10.5, displayWidth: 33.6 })).toEqual({
      height: 14,
      width: 44,
    });
    expect(vectorRaster(2, { displayHeight: 0.2, displayWidth: 0.2 })).toEqual({
      height: 1,
      width: 1,
    });
  });

  it("covers every SVG in Art's manifests: each declares its display size", () => {
    const svgs = ART_MANIFEST.assets.filter(({ path }) => path.endsWith(".svg"));
    expect(svgs.length).toBeGreaterThan(1000);
    for (const asset of svgs) {
      expect([asset.displayWidth, asset.displayHeight], asset.id).toEqual([
        expect.any(Number),
        expect.any(Number),
      ]);
    }
  });
});
