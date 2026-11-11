import { describe, expect, it } from "vitest";

import { ART_MANIFEST } from "./test-art-manifest.ts";
import { fileFilter, vectorRaster } from "./textures.ts";

describe("texture filters", () => {
  it("samples SVGs linear and sheets nearest, and leaves other files alone", () => {
    expect(fileFilter("svg")).toBe("linear");
    expect(fileFilter("spritesheet")).toBe("nearest");
    expect(fileFilter("json")).toBeUndefined();
    expect(fileFilter("toString")).toBeUndefined();
  });
});

describe("vector raster size", () => {
  const frigate = { displayHeight: 168, displayWidth: 168 };

  it("rasterises at the display size times r, whole", () => {
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
