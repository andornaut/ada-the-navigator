import { densityTexels } from "@andornaut/game-kit/view/renderScale";

// How textures sample and at what density (art/layout.md "Coordinates and scale"). The game's
// config leaves every texture nearest unless the scene sets it linear.

export type TextureFilter = "linear" | "nearest";

// The filter of each kind of texture file the scene loads, by Phaser loader file type. SVGs are
// vector art rasterised at their on-screen device size (rasterScale), so they sample linear;
// sheets are authored pixel art, so they sample nearest at their fractional scale.
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

// SVG texels per logical px at most, per axis.
export const RASTER_CAP = 4;
// How far the wanted raster scale may drift from the one SVGs were rasterised at, either way,
// before they rasterise again.
export const RASTER_STEP = 1.25;

// The SVG raster scale for a camera at zoom device px per logical px (r times the fit): the
// on-screen device size, at most RASTER_CAP. A zoom that is not positive gives 1.
export function rasterScale(zoom: number): number {
  return Number.isFinite(zoom) && zoom > 0 ? Math.min(zoom, RASTER_CAP) : 1;
}

// Whether SVGs rasterised at scale must rasterise again for wanted: when either is more than
// RASTER_STEP times the other.
export function needsRaster(scale: number, wanted: number): boolean {
  return Math.max(wanted / scale, scale / wanted) > RASTER_STEP;
}

// An SVG's raster size: its display size at scale texels per logical px, whole and at least 1.
export function vectorRaster(
  scale: number,
  display: { readonly displayHeight: number; readonly displayWidth: number },
): { height: number; width: number } {
  return {
    height: densityTexels(scale, display.displayHeight),
    width: densityTexels(scale, display.displayWidth),
  };
}
