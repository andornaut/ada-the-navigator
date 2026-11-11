import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { isHashedAssetUrl } from "@andornaut/game-kit/web/pwa/cachePolicy";
import { describe, expect, it } from "vitest";

import { GALAXIES, galaxyPreview } from "../data/storybook.ts";
import { CACHE_POLICY } from "./cachePolicy.ts";
import { ART_DIRECTORY, artUrls, PREVIEW_DIRECTORY, previewUrls } from "./precacheArt.ts";

const publicDir = fileURLToPath(new URL("../../public/", import.meta.url));
const artDirectory = join(publicDir, ART_DIRECTORY);
const read = (url: string) => JSON.parse(readFileSync(join(publicDir, url), "utf8")) as unknown;

// Every file under public/art, as the build lists it.
const artFiles = readdirSync(artDirectory, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => relative(artDirectory, join(entry.parentPath, entry.name)).split(sep).join("/"));

// Every /art/ URL a JSON document names, at any depth, the UI manifest's base path among them.
function namedArtUrls(json: unknown): string[] {
  if (typeof json === "string") {
    return json.startsWith(`/${ART_DIRECTORY}/`) ? [json] : [];
  }
  if (json !== null && typeof json === "object") {
    return Object.values(json).flatMap(namedArtUrls);
  }
  return [];
}

describe("artUrls", () => {
  it("lists every art file by URL, in order, apart from the app icons", () => {
    expect(
      artUrls([
        "ship.svg",
        "app-icon/contact-sheet.png",
        "ui/sprites/ui-close.png",
        "manifest.json",
      ]),
    ).toEqual(["/art/manifest.json", "/art/ship.svg", "/art/ui/sprites/ui-close.png"]);
  });

  it("lists only network-first URLs, so changed art changes the precache version", () => {
    expect(artUrls(artFiles).filter((url) => isHashedAssetUrl(CACHE_POLICY, url))).toEqual([]);
  });

  it("lists every file the art manifest and the UI manifest name", () => {
    const urls = artUrls(artFiles);
    const manifest = read("/art/manifest.json") as { ui: { basePath: string; manifest: string } };
    const ui = read(manifest.ui.manifest) as {
      fonts: { fnt: string; png: string }[];
      sprites: { json: string; png: string }[];
    };
    const named = [
      "/art/manifest.json",
      ...namedArtUrls(manifest).filter((url) => url !== manifest.ui.basePath),
      ...[
        ...ui.fonts.flatMap(({ fnt, png }) => [fnt, png]),
        ...ui.sprites.flatMap(({ json, png }) => [json, png]),
      ].map((path) => `${manifest.ui.basePath}${path}`),
    ];
    expect(named.length).toBeGreaterThan(1);
    expect(named.filter((url) => !urls.includes(url))).toEqual([]);
  });

  it("lists each galaxy manifest the core manifest maps, and every file it names", () => {
    const urls = artUrls(artFiles);
    const manifest = read("/art/manifest.json") as { galaxies: Record<string, string> };
    const galaxies = Object.values(manifest.galaxies);
    expect(galaxies).toEqual([
      "/art/sunflower/manifest.json",
      "/art/cartwheel/manifest.json",
      "/art/whirlpool/manifest.json",
    ]);
    for (const galaxy of galaxies) {
      expect(urls).toContain(galaxy);
      const named = namedArtUrls(read(galaxy));
      expect(named.length).toBeGreaterThan(1);
      expect(named.filter((url) => !urls.includes(url))).toEqual([]);
    }
  });

  it("lists every enemy heading frame and jets file", () => {
    const urls = artUrls(artFiles);
    for (const archetype of ["swarm", "fighter", "interceptor", "retaliator"]) {
      expect(urls).toContain(`/art/enemies/${archetype}-jets.json`);
      for (let index = 0; index < 16; index++) {
        expect(urls).toContain(`/art/enemies/${archetype}-${index}.svg`);
      }
    }
  });

  it("leaves out the icon review sheet", () => {
    expect(artUrls(artFiles).filter((url) => url.includes("contact-sheet"))).toEqual([]);
  });
});

describe("previewUrls", () => {
  it("lists every galaxy preview the selector loads, both states", () => {
    const files = readdirSync(join(publicDir, PREVIEW_DIRECTORY));
    const urls = previewUrls(files);
    expect(urls).toEqual(
      GALAXIES.flatMap((galaxy) =>
        [false, true].map((locked) => galaxyPreview(galaxy, locked)),
      ).sort(),
    );
    expect(urls.filter((url) => isHashedAssetUrl(CACHE_POLICY, url))).toEqual([]);
  });
});
