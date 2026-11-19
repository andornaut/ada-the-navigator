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
// of the camera zoom) more than RASTER_STEP from the current one leaves every loaded SVG stale; a
// smaller drift keeps the current rasters. Only a stale SVG the scene draws rasterises again at
// the current scale (due), so a resize rasterises what is on screen and the rest wait for their
// first draw. An SVG still loading when the scale changes rasterises again once it has loaded.
export class SvgRasters {
  private readonly entries = new Map<string, Entry>();
  private readonly marked = new Set<string>();
  private readonly stale = new Set<string>();
  private current: number;

  constructor(zoom: number) {
    this.current = rasterScale(zoom);
  }

  // The raster scale new loads use.
  get scale(): number {
    return this.current;
  }

  // Whether a loaded SVG waits to rasterise again at the current scale.
  get pending(): boolean {
    return this.stale.size > 0;
  }

  // Records request at the current scale and returns its load size.
  request(request: SvgRequest): SvgSize {
    this.entries.set(request.key, { loaded: false, request, scale: this.current });
    this.stale.delete(request.key);
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

  // Follows a camera now at zoom: once the wanted scale moves more than RASTER_STEP from the
  // current one, every loaded SVG is stale. Returns whether the scale changed.
  resize(zoom: number): boolean {
    const wanted = rasterScale(zoom);
    if (!needsRaster(this.current, wanted)) {
      return false;
    }
    this.current = wanted;
    for (const [key, entry] of this.entries) {
      if (entry.loaded) {
        this.stale.add(key);
      }
    }
    return true;
  }

  // Records that key was drawn this frame other than as a displayed texture, such as stamped
  // into a group.
  mark(key: string): void {
    if (this.stale.has(key)) {
      this.marked.add(key);
    }
  }

  // The stale SVGs drawn this frame (displayed, as drawn reports, or marked), now due at the
  // current scale: each is current from here.
  due(drawn: (key: string) => boolean): SvgRequest[] {
    const requests: SvgRequest[] = [];
    for (const key of this.stale) {
      const entry = this.entries.get(key)!;
      if (entry.scale === this.current) {
        this.stale.delete(key);
      } else if (this.marked.has(key) || drawn(key)) {
        entry.scale = this.current;
        this.stale.delete(key);
        requests.push(entry.request);
      }
    }
    this.marked.clear();
    return requests;
  }
}
