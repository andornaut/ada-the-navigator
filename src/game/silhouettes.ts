type Frame = {
  readonly cutHeight: number;
  readonly cutWidth: number;
  readonly cutX: number;
  readonly cutY: number;
  readonly name: string | number;
  readonly source: { readonly image: object | null; readonly scaleMode: number };
  readonly texture: { readonly key: string };
};

type Entry = {
  readonly bytes: number;
  readonly frame: Frame;
  readonly ink: number;
  readonly reusable: boolean;
  scale: number;
};

const MAX_IDLE_KEYS = 16;
// RGBA texels per copy. The canvas and WebGL copies together can use twice this allowance.
const MAX_IDLE_BYTES = 1024 * 1024;

/** Owns visible silhouettes and a bounded cache of recently drawn image frames. */
export class Silhouettes {
  private readonly held = new Map<string, Entry>();
  private readonly marked = new Set<string>();
  private readonly sourceIds = new WeakMap<object, number>();
  private nextSource = 0;
  private release: (() => void) | undefined;

  bindTextureStore(textures: {
    exists(key: string): boolean;
    remove(key: string): unknown;
  }): (() => void) | undefined {
    if (this.release) {
      return undefined;
    }
    const release = () => {
      if (this.release !== release) {
        return;
      }
      this.release = undefined;
      for (const key of this.held.keys()) {
        if (textures.exists(key)) {
          textures.remove(key);
        }
      }
      this.held.clear();
      this.marked.clear();
    };
    this.release = release;
    return release;
  }

  use(frame: Frame, ink: number, scale: number): string | undefined {
    const key = this.key(frame, ink);
    if (!key) {
      return undefined;
    }
    const entry = this.held.get(key) ?? {
      bytes: Math.max(1, frame.cutWidth) * Math.max(1, frame.cutHeight) * 4,
      frame,
      ink,
      reusable: frame.source.image instanceof HTMLImageElement,
      scale,
    };
    entry.scale = scale;
    if (!this.marked.has(key)) {
      this.held.delete(key);
      this.held.set(key, entry);
      this.marked.add(key);
    }
    return key;
  }

  sweep(
    scale: number,
    ink: number,
    inUse: (key: string) => boolean,
    remove: (key: string) => void,
  ): void {
    const idle: [string, number][] = [];
    let bytes = 0;
    for (const [key, entry] of this.held) {
      if (this.marked.has(key) || inUse(key)) {
        continue;
      }
      if (
        !entry.reusable ||
        entry.scale !== scale ||
        entry.ink !== ink ||
        this.key(entry.frame, entry.ink) !== key
      ) {
        this.held.delete(key);
        remove(key);
        continue;
      }
      idle.push([key, entry.bytes]);
      bytes += entry.bytes;
    }
    for (const [index, [key, size]] of idle.entries()) {
      if (idle.length - index <= MAX_IDLE_KEYS && bytes <= MAX_IDLE_BYTES) {
        break;
      }
      bytes -= size;
      this.held.delete(key);
      remove(key);
    }
    this.marked.clear();
  }

  private key(frame: Frame, ink: number): string | undefined {
    const image = frame.source?.image;
    if (!image || !frame.texture) {
      return undefined;
    }
    let id = this.sourceIds.get(image);
    if (id === undefined) {
      id = ++this.nextSource;
      this.sourceIds.set(image, id);
    }
    const { cutHeight, cutWidth, cutX, cutY } = frame;
    const traced = `${frame.texture.key}#${String(frame.name)}`;
    const region = `${cutWidth}x${cutHeight}:${cutX},${cutY}`;
    return `keyline:${traced}@${region}:${ink.toString(16)}:${id}:${frame.source.scaleMode}`;
  }
}
