import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { isHashedAssetUrl } from "@andornaut/game-kit/runtime/web/pwa/cachePolicy";
import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { GALAXY_ID } from "../data/galaxies.ts";
import { GALAXIES, galaxyPreview } from "../data/storybook.ts";
import { SHIP_HEADINGS } from "../model/nose.ts";
import { SHIPPED_SHIP_SOURCES } from "../testing/shippedShipSources.ts";
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

  it("lists required network files and resolves exact generated ship references", () => {
    const urls = artUrls(artFiles);
    const manifest = read("/art/manifest.json") as {
      assets: { id: string; path: string; directionIndex?: number; paint?: string }[];
      quantumJump: string;
      shipMaterials?: string;
      ui: { basePath: string; manifest: string };
    };
    let generatedHulls = 0;
    const assets = manifest.assets.map((asset) => {
      const heading = asset.directionIndex;
      const generatedId = asset.paint ? `ship-${asset.paint}-${heading}` : "ship";
      if (
        !SHIPPED_SHIP_SOURCES ||
        typeof heading !== "number" ||
        !Number.isInteger(heading) ||
        asset.id !== generatedId
      ) {
        return asset;
      }
      const source = SHIPPED_SHIP_SOURCES.ship(asset.paint ?? ECONOMY.defaultPaint, heading);
      expect(source, asset.id).toBeDefined();
      generatedHulls++;
      return { ...asset, path: source!.url };
    });
    expect(generatedHulls).toBe(
      SHIPPED_SHIP_SOURCES ? (ECONOMY.paintOrder.length - 1) * SHIP_HEADINGS + 1 : 0,
    );
    // Classic headings remain real network assets for the current local map.
    for (let heading = 0; heading < SHIP_HEADINGS; heading++) {
      expect(urls).toContain(`/art/ship-${heading}.svg`);
    }
    const jump = read(manifest.quantumJump) as {
      warp: { poses: { id: string; paths: Record<string, string> }[] };
    };
    let generatedPoses = 0;
    const poses = jump.warp.poses.map((pose) => ({
      ...pose,
      paths: Object.fromEntries(
        Object.entries(pose.paths).map(([scheme, path]) => {
          if (!SHIPPED_SHIP_SOURCES) {
            return [scheme, path];
          }
          const source = SHIPPED_SHIP_SOURCES.pose(scheme, pose.id);
          expect(source, `${scheme}:${pose.id}`).toBeDefined();
          generatedPoses++;
          return [scheme, source!.url];
        }),
      ),
    }));
    expect(generatedPoses).toBe(
      SHIPPED_SHIP_SOURCES ? ECONOMY.paintOrder.length * jump.warp.poses.length : 0,
    );
    const ui = read(manifest.ui.manifest) as {
      fonts: { fnt: string; png: string }[];
      sprites: { json: string; png: string }[];
    };
    const named = [
      "/art/manifest.json",
      ...namedArtUrls({ ...manifest, assets }).filter((url) => url !== manifest.ui.basePath),
      ...namedArtUrls({ ...jump, warp: { ...jump.warp, poses } }),
      ...(manifest.shipMaterials ? namedArtUrls(read(manifest.shipMaterials)) : []),
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
    // However many galaxies Art has drawn: each under its stable galaxy id.
    const ids = Object.values(GALAXY_ID);
    expect(Object.keys(manifest.galaxies).filter((id) => !ids.includes(id))).toEqual([]);
    const galaxies = Object.entries(manifest.galaxies).map(([id, path]) => {
      expect(path).toBe(`/art/${id}/manifest.json`);
      return path;
    });
    expect(galaxies.length).toBeGreaterThan(0);
    for (const galaxy of galaxies) {
      expect(urls).toContain(galaxy);
      // A placeholder galaxy's manifest names only its backdrop.
      const named = namedArtUrls(read(galaxy));
      expect(named.length).toBeGreaterThan(0);
      expect(named.filter((url) => !urls.includes(url))).toEqual([]);
    }
  });

  it("lists every enemy heading frame and jets file", () => {
    const urls = artUrls(artFiles);
    const sheet = "/art/enemies/fighter-sheet.svg";
    const core = read("/art/manifest.json") as {
      assets: readonly { id: string; path: string; svgSheet?: true }[];
    };
    const fighterIds = Array.from({ length: 16 }, (_, index) => `enemy-fighter-${index}`);
    const svg = readFileSync(join(publicDir, sheet), "utf8");
    const sheetFrames = Array.from(
      svg.matchAll(/<svg\b[^>]*\bid="(enemy-fighter-\d+)"/gu),
      ([, id]) => id,
    );
    expect(urls.filter((url) => url === sheet)).toEqual([sheet]);
    expect(
      core.assets
        .filter((asset) => asset.path === sheet)
        .map(({ id, svgSheet }) => ({ id, svgSheet })),
    ).toEqual(fighterIds.map((id) => ({ id, svgSheet: true })));
    expect(sheetFrames).toEqual(fighterIds);
    for (const archetype of ["swarm", "fighter", "interceptor", "retaliator"]) {
      expect(urls).toContain(`/art/enemies/${archetype}-jets.json`);
      for (let index = 0; index < 16; index++) {
        const path = `/art/enemies/${archetype}-${index}.svg`;
        if (archetype === "fighter") {
          expect(urls).not.toContain(path);
        } else {
          expect(urls).toContain(path);
        }
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
      GALAXIES.filter(({ preview }) => preview)
        .flatMap((galaxy) => [false, true].map((locked) => galaxyPreview(galaxy, locked)))
        .sort(),
    );
    expect(urls.filter((url) => isHashedAssetUrl(CACHE_POLICY, url))).toEqual([]);
  });
});
