import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Silhouettes } from "./silhouettes.ts";

class ImageSource {}

function frame(name: string, width: number, height = width, image = new ImageSource()) {
  return {
    cutHeight: height,
    cutWidth: width,
    cutX: 0,
    cutY: 0,
    name,
    source: { image, scaleMode: 0 },
    texture: { key: "atlas" },
  };
}

function world() {
  const silhouettes = new Silhouettes();
  const textures = new Set<string>();
  const copies = new Set<string>();
  const remove = (key: string) => textures.delete(key);
  const store = { exists: (key: string) => textures.has(key), remove };
  const teardown = silhouettes.bindTextureStore(store)!;
  const draw = (value: ReturnType<typeof frame>, scale = 1) => {
    const key = silhouettes.use(value, scale)!;
    textures.add(key);
    return key;
  };
  const sweep = (scale = 1) => silhouettes.sweep(scale, (key) => copies.has(key), remove);
  return { copies, draw, silhouettes, store, sweep, teardown, textures };
}

beforeEach(() => vi.stubGlobal("HTMLImageElement", ImageSource));
afterEach(() => vi.unstubAllGlobals());

describe("keyline silhouettes", () => {
  it("reuses recurring paused-flight stardust crops and both Growers outpost frames", () => {
    const { draw, sweep, textures } = world();
    const source = new ImageSource();
    const stardust = ["1", "2", "3"].map((name, index) => ({
      ...frame(name, 9, 9, source),
      cutX: (index + 1) * 9,
    }));
    const growers = [frame("growers-a", 235, 196), frame("growers-b", 235, 196)];
    const keys = new Set([...stardust, ...growers].map((sprite) => draw(sprite)));
    for (let index = 0; index < 120; index++) {
      sweep();
      const cached = new Set(textures);
      expect(cached.has(draw(stardust[index % 3]!))).toBe(true);
      expect(cached.has(draw(growers[Math.floor(index / 9) % 2]!))).toBe(true);
    }
    expect(textures).toEqual(keys);
  });

  it("retires idle scales and replaces source images, crops and sampling independently", () => {
    const { draw, sweep, textures } = world();
    const sprite = frame("station", 96);
    const replace = (change: () => void, scale = 1) => {
      const old = draw(sprite);
      sweep();
      change();
      const next = draw(sprite, scale);
      sweep(scale);
      expect(next).not.toBe(old);
      expect(textures).toEqual(new Set([next]));
      return next;
    };
    replace(() => (sprite.source.image = new ImageSource() as HTMLImageElement));
    replace(() => (sprite.cutHeight = 128));
    replace(() => (sprite.cutX = 16));
    replace(() => (sprite.source.scaleMode = 1));
    const stationary = frame("idle", 32);
    const idle = draw(stationary);
    sweep();
    sweep();
    expect(textures.has(idle)).toBe(true);
    replace(() => (sprite.cutWidth = 192), 2);
    expect(textures.has(idle)).toBe(false);
  });

  it("caps idle keys and bytes, spending spare capacity on the most recent frames", () => {
    const { draw, sweep, textures } = world();
    const small = Array.from({ length: 18 }, (_, index) => frame(String(index), 9));
    const keys = small.map((sprite) => draw(sprite));
    sweep();
    draw(small[0]!);
    sweep();
    expect(textures.has(keys[1]!)).toBe(false);
    expect(textures.has(keys[0]!)).toBe(true);
    expect(textures.size).toBe(17);

    const large = Array.from({ length: 3 }, (_, index) => draw(frame(`large-${index}`, 384)));
    sweep();
    sweep();
    expect(textures).toEqual(new Set([large[2]!]));
  });

  it("keeps a referenced texture and frees it as soon as its invalid frame is unreferenced", () => {
    const { copies, draw, sweep, textures } = world();
    const sprite = frame("ship", 42);
    const key = draw(sprite);
    copies.add(key);
    sweep();
    sprite.source.image = new ImageSource() as HTMLImageElement;
    const replacement = draw(sprite);
    sweep();
    expect(textures).toEqual(new Set([key, replacement]));
    copies.clear();
    sweep();
    expect(textures).toEqual(new Set([replacement]));
  });

  it("retires an idle mutable source and clears the store on teardown", () => {
    const { draw, silhouettes, store, sweep, teardown, textures } = world();
    const during = draw(frame("canvas", 32, 32, {}));
    const cached = draw(frame("ship", 32));
    sweep();
    sweep();
    expect(textures.has(during)).toBe(false);
    expect(textures.has(cached)).toBe(true);
    expect(silhouettes.bindTextureStore(store)).toBeUndefined();
    teardown();
    expect(textures.size).toBe(0);
    const release = silhouettes.bindTextureStore(store)!;
    const restarted = draw(frame("after-restart", 32));
    teardown();
    expect(textures).toEqual(new Set([restarted]));
    release();
    expect(textures.size).toBe(0);
  });
});
