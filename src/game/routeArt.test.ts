import { describe, expect, it } from "vitest";

import { GALAXIES } from "../data/storybook.ts";
import { ART_MANIFEST, CORE_MANIFEST, publicJson } from "../testing/publicArt.ts";
import {
  markerHue,
  readRouteArt,
  readRouteMarkers,
  routePreviews,
  routeShipFrames,
} from "./routeArt.ts";

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
      "#DCBAE3",
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
    expect(previews.phantom?.open).toBe("/previews/galaxy-phantom.png");
  });

  it("reads the sky, the ground and its two figures at their canvas points", () => {
    const art = readRouteArt(CORE_MANIFEST.assets, markers, () => []);
    expect(art).toMatchObject({
      figures: [
        { height: 52, url: "/art/story/ada-skywatch.png", width: 28, x: 199, y: 60 },
        { height: 28, url: "/art/story/penny-sitting.png", width: 23, x: 228, y: 84 },
      ],
      ground: "/art/route-ground.png",
      locked: "#8B8B8B",
      sky: "/art/route-sky.png",
    });
    expect(readRouteArt([], markers, () => [])).toBeNull();
  });

  it("keeps the selected idle hull paint during thrust and never uses baked Classic flames", () => {
    const classic = routeShipFrames(CORE_MANIFEST.assets, null);
    expect(classic).toHaveLength(32);
    expect(classic[12]).toBe("/art/ship-12.svg");
    expect(classic.some((path) => path.includes("thrust"))).toBe(false);
    const cobalt = routeShipFrames(CORE_MANIFEST.assets, "cobalt");
    expect(cobalt[12]).toMatch(/cobalt/u);
    expect(cobalt.some((path) => path.includes("thrust"))).toBe(false);
    expect(routeShipFrames(CORE_MANIFEST.assets, "none")).toEqual(classic);
  });
});
