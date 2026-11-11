import { needsRaster, rasterScale } from "./textures.ts";

// The scene event that carries each new raster scale, for vector textures the scene does not
// load as SVGs (the touch chrome).
export const RASTER_SCALE_EVENT = "raster-scale";

// What a Phaser SVG load is given: a raster size in texels, or a multiple of the SVG's own size.
export type SvgSize =
  { readonly height: number; readonly width: number } | { readonly scale: number };

// An SVG the scene loads: its texture key, its file and its raster size at a raster scale.
export interface SvgRequest {
  readonly key: string;
  readonly path: string;
  readonly size: (scale: number) => SvgSize;
}

interface Entry {
  loaded: boolean;
  readonly request: SvgRequest;
  scale: number;
}

// Every SVG the scene has asked for, the raster scale each was asked at, and the scale new loads
// use (art/layout.md "Coordinates and scale"). A resize that moves the wanted scale (rasterScale
// of the camera zoom) more than RASTER_STEP from the current one makes every SVG rasterise again
// at the wanted scale; a smaller drift keeps the current rasters. An SVG still loading when the
// scale changes rasterises again once it has loaded.
export class SvgRasters {
  private readonly entries = new Map<string, Entry>();
  private current: number;

  constructor(zoom: number) {
    this.current = rasterScale(zoom);
  }

  // The raster scale new loads use.
  get scale(): number {
    return this.current;
  }

  // Records request at the current scale and returns its load size.
  request(request: SvgRequest): SvgSize {
    this.entries.set(request.key, { loaded: false, request, scale: this.current });
    return request.size(this.current);
  }

  // Marks key's first raster loaded. Returns its request when it was asked for at a scale since
  // replaced, so it rasterises again at the current one; undefined otherwise, or for a key never
  // requested.
  loaded(key: string): SvgRequest | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.loaded) {
      return undefined;
    }
    entry.loaded = true;
    if (entry.scale === this.current) {
      return undefined;
    }
    entry.scale = this.current;
    return entry.request;
  }

  // Follows a camera now at zoom. Returns the loaded SVGs to rasterise again at the new current
  // scale, or none while the wanted scale stays within RASTER_STEP of the current one.
  resize(zoom: number): SvgRequest[] {
    const wanted = rasterScale(zoom);
    if (!needsRaster(this.current, wanted)) {
      return [];
    }
    this.current = wanted;
    return [...this.entries.values()]
      .filter((entry) => entry.loaded)
      .map((entry) => {
        entry.scale = wanted;
        return entry.request;
      });
  }
}
