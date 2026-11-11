// Keyline silhouette textures by the frame they trace. A frame rasterised again gets a new
// silhouette key (its raster size is part of it); the key it replaces is stale, and sweep removes
// a stale texture once nothing draws it, so repeated re-rasters keep one silhouette per frame.
export class Silhouettes {
  private readonly current = new Map<string, string>();
  private readonly stale = new Set<string>();

  // Records key as frame's silhouette; the key it replaces becomes stale.
  use(frame: string, key: string): void {
    const previous = this.current.get(frame);
    if (previous !== undefined && previous !== key) {
      this.stale.add(previous);
    }
    this.current.set(frame, key);
    this.stale.delete(key);
  }

  // Removes each stale key that inUse no longer reports, through remove.
  sweep(inUse: (key: string) => boolean, remove: (key: string) => void): void {
    for (const key of this.stale) {
      if (!inUse(key)) {
        remove(key);
        this.stale.delete(key);
      }
    }
  }
}
