import type { AsteroidArt } from "../data/asteroidCatalog.ts";

/** Complete spin sets prevent pending textures from replacing the current pose with frame 0. */
export class RockFrames {
  private readonly complete = new WeakSet<AsteroidArt>();

  frame(available: (file: string) => boolean, art: AsteroidArt, frame: number): string | undefined {
    const wanted = art.frames[frame]!.file;
    if (this.complete.has(art) && available(wanted)) {
      return wanted;
    }
    this.complete.delete(art);
    // Visit every frame so the caller can queue the complete visible variant at once.
    const ready = art.frames.map((entry) => available(entry.file));
    if (!ready.every(Boolean)) {
      return undefined;
    }
    this.complete.add(art);
    return wanted;
  }
}
