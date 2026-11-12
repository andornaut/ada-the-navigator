import { describe, expect, it } from "vitest";

import { GALAXY_MANIFESTS, publicJson } from "../testing/publicArt.ts";
import { readBackdropHaze } from "./backdropHaze.ts";

const andromeda = GALAXY_MANIFESTS.get(5)!;
const file = publicJson(andromeda.links.backdropHaze!);

describe("backdrop haze", () => {
  it("reads Andromeda's haze: its texture shown 960 by 480 from its manifest entry", () => {
    expect(readBackdropHaze(andromeda.assets, file)).toEqual({
      asset: "andromeda-haze",
      height: 480,
      path: "/art/andromeda/haze.png",
      width: 960,
    });
  });

  it("draws no haze in a galaxy without the link", () => {
    for (const [galaxy, manifest] of GALAXY_MANIFESTS) {
      expect(Boolean(manifest.links.backdropHaze), String(galaxy)).toBe(galaxy === 5);
    }
  });

  it("reads no haze from another placement or a missing entry", () => {
    const valid = file as Record<string, unknown>;
    for (const change of [
      { version: 2 },
      { layer: "front" },
      { anchor: "world" },
      { parallax: 0.5 },
      { filter: "nearest" },
      { asset: "missing" },
    ]) {
      expect(readBackdropHaze(andromeda.assets, { ...valid, ...change })).toBeUndefined();
    }
    expect(readBackdropHaze([], file)).toBeUndefined();
    expect(readBackdropHaze(andromeda.assets, null)).toBeUndefined();
  });
});
