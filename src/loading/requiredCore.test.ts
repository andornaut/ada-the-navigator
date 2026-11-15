import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { validateBootCore } from "./requiredCore.ts";

function fixture() {
  const files: Record<string, string> = {
    "art-manifest": "manifest.json",
    "quantum-jump": "quantum-jump.json",
    "ship-material-palettes": "ship-paint.json",
    "ship-materials": "ship-materials.json",
  };
  const data = new Map(
    Object.entries(files).map(([key, path]) => [
      key,
      JSON.parse(readFileSync(`public/art/${path}`, "utf8")) as unknown,
    ]),
  );
  return { cache: { get: (key: string) => data.get(key) }, data };
}
it("validates the shipped logical headings, semantic geometry, palettes and actual native texture", () => {
  const f = fixture();
  expect(() => validateBootCore(f.cache, true)).not.toThrow();
  expect(() => validateBootCore(f.cache, false)).toThrow("texture");
});
it("rejects missing logical headings even when a native texture exists", () => {
  const f = fixture();
  f.data.set("art-manifest", { assets: [], version: 1 });
  expect(() => validateBootCore(f.cache, true)).toThrow("heading");
});
it.each(["ship-materials", "ship-material-palettes", "quantum-jump"])(
  "rejects malformed cached %s rather than accepting a fallback ship",
  (key) => {
    const f = fixture();
    f.data.set(key, { version: 1 });
    expect(() => validateBootCore(f.cache, true)).toThrow("materials");
  },
);
