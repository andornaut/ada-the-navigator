// Keyline silhouette textures, freed by what is drawn. Every caller that draws a silhouette marks
// it through use, whichever caller it is: keyline copies, groups stamped from it and any later
// keyline. Each sweep removes every silhouette nothing marked since the sweep before and nothing
// still draws, so a frame rasterised again, or one no longer on screen, leaves no texture behind.
export class Silhouettes {
  private readonly held = new Set<string>();
  private readonly marked = new Set<string>();

  // Records that key is drawn in this frame.
  use(key: string): void {
    this.held.add(key);
    this.marked.add(key);
  }

  // Removes each held key not marked since the last sweep that inUse no longer reports, through
  // remove; called once a frame, so a key marked anywhere in a frame survives that frame's sweep.
  sweep(inUse: (key: string) => boolean, remove: (key: string) => void): void {
    for (const key of this.held) {
      if (!this.marked.has(key) && !inUse(key)) {
        remove(key);
        this.held.delete(key);
      }
    }
    this.marked.clear();
  }

  // The silhouettes held now.
  get size(): number {
    return this.held.size;
  }
}
