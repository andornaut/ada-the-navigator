import { densityTexels } from "@andornaut/game-kit/view/renderScale";

// How textures sample and at what density (art/layout.md "Coordinates and scale"). The game's
// config leaves every texture nearest unless the scene sets it linear.

export type TextureFilter = "linear" | "nearest";

// The filter of each kind of texture file the scene loads, by Phaser loader file type. SVGs are
// vector art rasterised at r texels per logical px (vectorRaster), so they sample linear; sheets
// are authored pixel art, so they sample nearest at their fractional scale.
export const FILE_FILTERS = { spritesheet: "nearest", svg: "linear" } as const satisfies Record<
  string,
  TextureFilter
>;

// The filter of a loaded file of type, or undefined for a file that is not a texture.
export function fileFilter(type: string): TextureFilter | undefined {
  return Object.hasOwn(FILE_FILTERS, type)
    ? FILE_FILTERS[type as keyof typeof FILE_FILTERS]
    : undefined;
}

// An SVG's raster size: its display size at r texels per logical px, whole and at least 1.
export function vectorRaster(
  r: number,
  display: { readonly displayHeight: number; readonly displayWidth: number },
): { height: number; width: number } {
  return {
    height: densityTexels(r, display.displayHeight),
    width: densityTexels(r, display.displayWidth),
  };
}
