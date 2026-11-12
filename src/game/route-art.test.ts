import { describe, expect, it } from "vitest";

import { GALAXIES } from "../data/storybook.ts";
import {
  markerHue,
  readRouteArt,
  readRouteMarkers,
  routePreviews,
  routeShipFrames,
} from "./route-art.ts";
import { ART_MANIFEST, CORE_MANIFEST, publicJson } from "./test-art-manifest.ts";

const markers = readRouteMarkers(publicJson(ART_MANIFEST.galaxyFields));

describe("route map art", () => {
  it("reads every galaxy's marker hue and the shared locked grey from galaxies.json", () => {
    expect(markers?.locked).toBe("#8B8B8B");
    expect(GALAXIES.map(({ galaxy }) => markerHue(markers, galaxy))).toEqual([
      "#D8C994",
      "#94D3E3",
      "#CFC5BD",
      "#B8C1FF",
      "#F3B6AC",
      "#E9B4DC",
    ]);
    expect(
      readRouteMarkers({ galaxies: { sunflower: { marker: "gold" } }, marker: {} }),
    ).toBeNull();
  });

  it("shows Art's placeholder previews where it lists them, else the selector captures", () => {
    const previews = Object.fromEntries(
      GALAXIES.map((card) => [card.id, routePreviews(CORE_MANIFEST.assets, card)]),
    );
    expect(previews.needle).toEqual({
      locked: "/art/previews/galaxy-needle-locked.png",
      open: "/art/previews/galaxy-needle.png",
    });
    expect(previews.sunflower).toEqual({
      locked: "/previews/galaxy-sunflower-locked.png",
      open: "/previews/galaxy-sunflower.png",
    });
    expect(previews["black-eye"]?.open).toBe("/previews/galaxy-black-eye.png");
  });

  it("reads the sky, the ground and its two figures at their canvas points", () => {
    const art = readRouteArt(CORE_MANIFEST.assets, markers, () => []);
    expect(art).toMatchObject({
      figures: [
        { height: 53, url: "/art/story/ada-skywatch.png", width: 26, x: 201, y: 59 },
        { height: 28, url: "/art/story/penny-sitting.png", width: 23, x: 228, y: 84 },
      ],
      ground: "/art/route-ground.png",
      locked: "#8B8B8B",
      sky: "/art/route-sky.png",
    });
    expect(readRouteArt([], markers, () => [])).toBeNull();
  });

  it("draws the paint's idle frames where it has them, and Classic's thrust frames", () => {
    const classic = routeShipFrames(CORE_MANIFEST.assets, null, false);
    expect(classic).toHaveLength(32);
    expect(classic[12]).toBe("/art/ship-12.svg");
    expect(routeShipFrames(CORE_MANIFEST.assets, null, true)[12]).toBe("/art/ship-thrust-12.svg");
    const cobalt = routeShipFrames(CORE_MANIFEST.assets, "cobalt", false);
    expect(cobalt[12]).toMatch(/cobalt/u);
    expect(routeShipFrames(CORE_MANIFEST.assets, "none", false)).toEqual(classic);
  });
});
