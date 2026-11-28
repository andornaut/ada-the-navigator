import { describe, expect, it } from "vitest";

import {
  chromeAtlasGrid,
  decorationRasterSize,
  fileFilter,
  needsRaster,
  RASTER_CAP,
  rasterScale,
  readGalaxyBackdrop,
  vectorRaster,
} from "../art/index.ts";
import { ART_MANIFEST, GALAXY_MANIFESTS, publicJson } from "../testing/publicArt.ts";
import { TOUCH_CHROME_FRAME, USE_DISC_POSES, USE_SYMBOLS } from "../ui/touchChrome.ts";
import { parentFit } from "./camera/index.ts";

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

  it("covers every SVG through manifest display dimensions or canonical rare-decoration recipes", () => {
    // Sunflower and Andromeda keep three planet frames beside their three solid formations.
    const frameCounts: Record<string, number> = {
      andromeda: 6,
      cartwheel: 3,
      needle: 3,
      phantom: 3,
      sunflower: 6,
      whirlpool: 3,
    };
    const decorations = new Map(
      [...GALAXY_MANIFESTS.values()].flatMap(({ links }) => {
        const backdrop = readGalaxyBackdrop(publicJson(links.backdrop!))!;
        expect(backdrop.decorations?.sprites, backdrop.galaxy).toHaveLength(
          frameCounts[backdrop.galaxy]!,
        );
        return backdrop.decorations!.sprites.map((sprite, index) => {
          expect(sprite.asset).toBe(`backdrop-decoration-${backdrop.galaxy}-${index + 1}`);
          return [sprite.asset, sprite] as const;
        });
      }),
    );
    expect(decorations.size).toBe(24);
    const seen = new Set<string>();
    const svgs = ART_MANIFEST.assets.filter(({ path }) => path.endsWith(".svg"));
    expect(svgs.length).toBeGreaterThan(1000);
    for (const asset of svgs) {
      if (asset.kind === "backdrop-decoration") {
        const recipe = decorations.get(asset.id);
        expect(recipe, asset.id).toBeDefined();
        expect([asset.displayWidth, asset.displayHeight], asset.id).toEqual([undefined, undefined]);
        expect([asset.width, asset.height], asset.id).toEqual([1024, 768]);
        // The recipe's display size scales the whole frame, so it keeps the frame's 4:3 shape.
        expect(recipe!.width / recipe!.height, asset.id).toBeCloseTo(4 / 3, 3);
        expect(decorationRasterSize(asset.width, asset.height), asset.id).toEqual({
          height: 768,
          width: 1024,
        });
        seen.add(asset.id);
        continue;
      }
      expect([asset.displayWidth, asset.displayHeight], asset.id).toEqual([
        expect.any(Number),
        expect.any(Number),
      ]);
    }
    expect([...seen].sort()).toEqual([...decorations.keys()].sort());
  });
});

const frame = { height: TOUCH_CHROME_FRAME, width: TOUCH_CHROME_FRAME };
const columns = USE_DISC_POSES.length;
const frames = (Object.keys(USE_SYMBOLS).length + 1) * columns;

describe("Use disc atlas", () => {
  it("fits every action and pose at full density where the old strip exceeded the texture limit", () => {
    const grid = chromeAtlasGrid(frame, 2.5, frames, columns, 8192);
    expect(frames * grid.strideX).toBeGreaterThan(8192);
    expect(grid).toEqual({ height: 188, rows: 9, strideX: 190, strideY: 190, width: 188 });
    expect(grid.rows * columns).toBe(frames);
    expect([columns * grid.strideX, grid.rows * grid.strideY]).toEqual([1140, 1710]);
  });

  it("keeps every frame within a lower renderer limit at the highest raster scale", () => {
    const grid = chromeAtlasGrid(frame, 4, frames, columns, 2048);
    expect([columns * grid.strideX, grid.rows * grid.strideY]).toEqual([1362, 2043]);
    expect(grid.width).toBe(grid.height);
  });
});
