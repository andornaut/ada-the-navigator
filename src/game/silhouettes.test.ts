import { describe, expect, it } from "vitest";

import { Silhouettes } from "./silhouettes.ts";

// A texture store and the keyline copies drawing from it, as the scene keeps them: each frame's
// copies switch to its current silhouette when keylines draw, then stale ones are swept.
function world() {
  const textures = new Set<string>();
  const copies = new Map<string, string>();
  const silhouettes = new Silhouettes();
  const draw = (frames: Readonly<Record<string, number>>): void => {
    for (const [frame, width] of Object.entries(frames)) {
      const key = `keyline:${frame}@${width}`;
      textures.add(key);
      silhouettes.use(frame, key);
      copies.set(frame, key);
    }
    silhouettes.sweep(
      (key) => [...copies.values()].includes(key),
      (key) => textures.delete(key),
    );
  };
  return { copies, draw, silhouettes, textures };
}

describe("keyline silhouettes", () => {
  it("keeps only the current silhouette set after two re-rasters", () => {
    const { draw, textures } = world();
    draw({ "ship#0": 42, "station#0": 96 });
    // Two re-rasters, each giving every frame a new raster width.
    draw({ "ship#0": 84, "station#0": 192 });
    draw({ "ship#0": 168, "station#0": 384 });
    expect([...textures].sort()).toEqual(["keyline:ship#0@168", "keyline:station#0@384"]);
  });

  it("keeps a replaced silhouette while something still draws it", () => {
    const { copies, silhouettes, textures } = world();
    textures.add("keyline:ship#0@42").add("keyline:ship#0@84");
    silhouettes.use("ship#0", "keyline:ship#0@42");
    copies.set("ship#0", "keyline:ship#0@42");
    silhouettes.use("ship#0", "keyline:ship#0@84");
    const remove = (key: string) => textures.delete(key);
    silhouettes.sweep((key) => [...copies.values()].includes(key), remove);
    expect(textures.has("keyline:ship#0@42")).toBe(true);
    copies.set("ship#0", "keyline:ship#0@84");
    silhouettes.sweep((key) => [...copies.values()].includes(key), remove);
    expect([...textures]).toEqual(["keyline:ship#0@84"]);
  });

  it("keeps a frame's silhouette that is used again", () => {
    const { draw, textures } = world();
    draw({ "ship#0": 42 });
    draw({ "ship#0": 42 });
    expect([...textures]).toEqual(["keyline:ship#0@42"]);
  });
});
