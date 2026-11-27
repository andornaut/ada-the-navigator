import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { markerHue, readRouteArt, readRouteMarkers, routePreviews } from "../art/index.ts";
import { GALAXIES } from "../data/storybook.ts";
import { ART_MANIFEST, CORE_MANIFEST, publicJson } from "../testing/publicArt.ts";
import { storyBackgrounds, storyComposites } from "../ui/storyArt.ts";
import { readStoryCompositionAssets } from "../ui/storyCompositions.ts";

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

  it("shows each galaxy's authored preview cards, open and locked", () => {
    for (const card of GALAXIES) {
      const previews = routePreviews(card);
      expect(previews, card.id).toEqual({
        locked: `/art/previews/card-${card.id}-locked.png`,
        open: `/art/previews/card-${card.id}.png`,
      });
      for (const path of [previews.open, previews.locked]) {
        expect(existsSync(new URL(`../../public${path}`, import.meta.url)), path).toBe(true);
      }
    }
    expect(CORE_MANIFEST.assets.filter(({ id }) => id.startsWith("galaxy-preview-"))).toEqual([]);
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
      sky: "/art/route-sky.webp",
    });
    expect(art?.homePreview).toBeUndefined();
    expect(art?.homeScene).toBeUndefined();
    expect(readRouteArt([], markers, () => [])).toBeNull();
  });
});

it("supplies the resolved canonical room layers and sheet crop rather than a remapped bare base", () => {
  const assets = readStoryCompositionAssets(
    [{ id: "story-ada-room", path: "/art/story-composed/base-ada-room-unpolished.webp" }],
    {
      assets: [
        {
          displayHeight: 540,
          displayWidth: 960,
          height: 1080,
          id: "room-base",
          path: "/art/story-composed/base-ada-room-unpolished.webp",
          pixelRatio: 2,
          width: 1920,
        },
        {
          displayHeight: 40,
          displayWidth: 80,
          height: 80,
          id: "room-props",
          path: "/art/story-composed/props.webp",
          pixelRatio: 2,
          width: 160,
        },
      ],
      canvas: { height: 540, width: 960 },
      scenes: {
        "story-ada-room": {
          base: "room-base",
          layers: [
            {
              asset: "room-props",
              atLogical: { x: 400, y: 240 },
              displayHeight: 40,
              displayWidth: 40,
              sourceRect: { height: 80, width: 80, x: 0, y: 0 },
            },
            {
              asset: "room-props",
              atLogical: { x: 450, y: 240 },
              displayHeight: 40,
              displayWidth: 40,
              sourceRect: { height: 80, width: 80, x: 80, y: 0 },
            },
          ],
          subject: { bottom: 300, top: 255 },
        },
      },
      version: 1,
    },
  );
  expect(assets).toBeDefined();
  const home = { backgrounds: storyBackgrounds(assets!), composites: storyComposites(assets!) };
  const art = readRouteArt(CORE_MANIFEST.assets, markers, () => [], home);
  expect(art?.homePreview).toBeUndefined();
  expect(art?.homeScene?.url).toBe("/art/story-composed/base-ada-room-unpolished.webp");
  expect(art?.homeScene?.overlays).toBe(home.composites.adaRoom);
  expect(art?.homeScene?.overlays).toHaveLength(2);
  expect(art?.homeScene?.overlays.map((layer) => layer.source?.rect.x)).toEqual([0, 80]);
  expect(art?.homeScene?.overlays[1]?.box.left).toBe((450 / 960) * 100);
});

it("does not substitute the incomplete raw base when canonical room resolution is unavailable", () => {
  const art = readRouteArt(CORE_MANIFEST.assets, markers, () => [], {
    backgrounds: {},
    composites: {},
  });
  expect(art?.homeScene).toBeUndefined();
  expect(art?.homePreview).toBeUndefined();
});
