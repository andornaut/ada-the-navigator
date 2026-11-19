import { describe, expect, it } from "vitest";

import { Silhouettes } from "./silhouettes.ts";

// A texture store and what draws from it, as the scene keeps them: each frame, every caller marks
// the silhouettes it draws (keyline copies, stamped groups), then one sweep runs.
function world() {
  const textures = new Set<string>();
  const copies = new Map<string, string>();
  const silhouettes = new Silhouettes();
  const mark = (key: string): void => {
    textures.add(key);
    silhouettes.use(key);
  };
  const frame = (copied: Readonly<Record<string, number>>, stamped: readonly string[] = []) => {
    copies.clear();
    for (const [traced, width] of Object.entries(copied)) {
      const key = `keyline:${traced}@${width}`;
      mark(key);
      copies.set(traced, key);
    }
    for (const key of stamped) {
      mark(key);
    }
    silhouettes.sweep(
      (key) => [...copies.values()].includes(key),
      (key) => textures.delete(key),
    );
  };
  return { copies, frame, silhouettes, textures };
}

describe("keyline silhouettes", () => {
  it("keeps one silhouette per drawn frame across alternating re-rasters", () => {
    const { frame, silhouettes, textures } = world();
    // Ten resizes between two raster scales: each gives every frame a new raster width.
    for (let resize = 0; resize < 10; resize++) {
      const wide = resize % 2 === 0;
      frame({ "ship#0": wide ? 84 : 42, "station#0": wide ? 192 : 96 });
      frame({ "ship#0": wide ? 84 : 42, "station#0": wide ? 192 : 96 });
    }
    expect([...textures].sort()).toEqual(["keyline:ship#0@42", "keyline:station#0@96"]);
    expect(silhouettes.size).toBe(2);
  });

  it("frees a silhouette once its frame is no longer drawn, whoever drew it", () => {
    const { frame, textures } = world();
    frame({ "ship#0": 42 }, ["keyline:outpost#0@64"]);
    expect(textures.has("keyline:outpost#0@64")).toBe(true);
    // The rock leaves the view and the reveal group ends: nothing draws either any more.
    frame({});
    expect([...textures]).toEqual([]);
  });

  it("keeps a silhouette a copy still draws although no caller marked it", () => {
    const { copies, silhouettes, textures } = world();
    textures.add("keyline:ship#0@42");
    silhouettes.use("keyline:ship#0@42");
    copies.set("ship#0", "keyline:ship#0@42");
    const remove = (key: string) => textures.delete(key);
    silhouettes.sweep((key) => [...copies.values()].includes(key), remove);
    silhouettes.sweep((key) => [...copies.values()].includes(key), remove);
    expect([...textures]).toEqual(["keyline:ship#0@42"]);
    copies.clear();
    silhouettes.sweep((key) => [...copies.values()].includes(key), remove);
    expect([...textures]).toEqual([]);
  });

  it("keeps a silhouette marked after the sweep in its frame through the next sweep", () => {
    const { silhouettes, textures } = world();
    const remove = (key: string) => textures.delete(key);
    silhouettes.sweep(() => false, remove);
    // A stamped group drawn after the frame's sweep marks it; the next sweep keeps it.
    textures.add("keyline:hub#0@64");
    silhouettes.use("keyline:hub#0@64");
    silhouettes.sweep(() => false, remove);
    expect([...textures]).toEqual(["keyline:hub#0@64"]);
  });
});
