import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { isHashedAssetUrl } from "@andornaut/game-kit/runtime/web/pwa/cachePolicy";
import { describe, expect, it } from "vitest";

import { routePreviews } from "../../art/index.ts";
import { ASTEROID_ART } from "../../data/asteroidCatalog.ts";
import { ECONOMY } from "../../data/economy.ts";
import { GALAXY_ID } from "../../data/galaxies.ts";
import { JOB_TYPES } from "../../data/jobs.ts";
import { PROJECTS } from "../../data/projects.ts";
import { GALAXIES } from "../../data/storybook.ts";
import { uiIconUrl } from "../../data/uiIconUrl.ts";
import { SHIP_HEADINGS } from "../../model/nose.ts";
import { CACHE_POLICY } from "../../pwa/cachePolicy.ts";
import { SHIPPED_SHIP_SOURCES } from "../../testing/shippedShipSources.ts";
import { ART_DIRECTORY, artUrls } from "./precacheArt.ts";

const publicDir = fileURLToPath(new URL("../../../public/", import.meta.url));
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

  it("precaches the six resource SVGs without their retired sprites and metadata", () => {
    const urls = artUrls(artFiles);
    for (const key of ["cargo-20", "holodisk", "holodisk-20", "ore-20", "stardust-20", "tow-20"]) {
      expect(urls).toContain(uiIconUrl(`icon-${key}`).split("#")[0]);
      expect(urls).not.toContain(`/art/ui/sprites/icon-${key}.png`);
      expect(urls).not.toContain(`/art/ui/sprites/icon-${key}.json`);
    }
    expect(urls).toContain("/art/ui/sprites/icon-holodisk-24.png");
  });

  it("precaches the Stardust and ore pickup sheets the core manifest draws", () => {
    const urls = artUrls(artFiles);
    const manifest = read("/art/manifest.json") as { assets: { id: string; path: string }[] };
    for (const id of ["stardust", "ore-nugget"]) {
      const sheet = `/art/${id}.png`;
      expect(manifest.assets.find((asset) => asset.id === id)?.path).toBe(sheet);
      expect(urls).toContain(sheet);
      expect(urls).toContain(`/art/${id}.json`);
    }
    expect(urls).not.toContain("/art/cartwheel/ore-nugget.png");
  });

  it("precaches the station SVG glyphs without their retired nested sprites", () => {
    const urls = artUrls(artFiles);
    const ui = read("/art/ui/manifest.json") as { sprites: { png: string }[] };
    const pairs = [
      ...["activity", ...JOB_TYPES].map((type) => `icon-job-${type}`),
      ...Object.values(PROJECTS).flatMap((projects) => projects?.map(({ icon }) => icon) ?? []),
    ];
    const masks = [
      ...["heavyMissile", "laser", "multiLaser", "phaser", "rapidMissile", "scattershot"].map(
        (weapon) => `weapon-${weapon}`,
      ),
      ...["energy", "missile", "shell"].map((ammo) => `ammo-${ammo}`),
    ];
    for (const key of pairs) {
      expect(urls).toContain(uiIconUrl(key).split("#")[0]);
      expect(urls).toContain(uiIconUrl(`${key}-disabled`).split("#")[0]);
    }
    for (const key of masks) {
      expect(urls).toContain(uiIconUrl(key).split("#")[0]);
    }
    for (const key of [...pairs, ...masks.map((key) => `icon-shop-${key}`)]) {
      expect(ui.sprites.some(({ png }) => png === `sprites/${key}.png`)).toBe(false);
      expect(urls).not.toContain(`/art/ui/sprites/${key}.png`);
      expect(urls).not.toContain(`/art/ui/sprites/${key}.json`);
    }
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
      const generatedId = asset.paint ? `ship-${asset.paint}-${heading}` : `ship-${heading}`;
      if (
        !SHIPPED_SHIP_SOURCES ||
        typeof heading !== "number" ||
        !Number.isInteger(heading) ||
        (asset.id !== generatedId && asset.id !== "ship")
      ) {
        return asset;
      }
      const source = SHIPPED_SHIP_SOURCES.ship(asset.paint ?? ECONOMY.defaultPaint, heading);
      expect(source, asset.id).toBeDefined();
      generatedHulls++;
      return { ...asset, path: source!.url };
    });
    expect(generatedHulls).toBe(
      SHIPPED_SHIP_SOURCES ? ECONOMY.paintOrder.length * SHIP_HEADINGS + 1 : 0,
    );
    const physicalClassic = urls.filter((url) => /^\/art\/ship-\d+\.svg$/u.test(url));
    expect(physicalClassic).toEqual(
      physicalClassic.length
        ? Array.from({ length: SHIP_HEADINGS }, (_, heading) => `/art/ship-${heading}.svg`).sort()
        : [],
    );
    expect(urls).not.toContain("/art/ship.svg");
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
      fonts: { fnt?: string; png: string }[];
      sprites: { json?: string; png: string }[];
    };
    const named = [
      "/art/manifest.json",
      ...namedArtUrls({ ...manifest, assets }).filter((url) => url !== manifest.ui.basePath),
      ...namedArtUrls({ ...jump, warp: { ...jump.warp, poses } }),
      ...(manifest.shipMaterials ? namedArtUrls(read(manifest.shipMaterials)) : []),
      ...[
        ...ui.fonts.flatMap(({ fnt, png }) => (fnt === undefined ? [png] : [png, fnt])),
        ...ui.sprites.flatMap(({ json, png }) => (json === undefined ? [png] : [png, json])),
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

  it("lists each core enemy heading set and every jets file", () => {
    const urls = artUrls(artFiles);
    const core = read("/art/manifest.json") as {
      assets: readonly { id: string; path: string; svgSheet?: true; svgSheetMember?: string }[];
    };
    const headings = (archetype: string) =>
      Array.from({ length: 16 }, (_, index) => `enemy-${archetype}-${index}`);
    // Each body's file stem: every hull has its own sheet.
    for (const [archetype, stem] of [
      ["swarm", "fleetSwarm"],
      ["fighter", "fleetFighter"],
      ["interceptor", "fleetInterceptor"],
      ["retaliator", "fleetRetaliator"],
      ["retaliatorCargoHauler", "fleetRetaliatorCargoHauler"],
      ["retaliatorMiningFreighter", "fleetRetaliatorMiningFreighter"],
    ] as const) {
      const sheet = `/art/enemies/${stem}-sheet.svg`;
      const ids = headings(archetype);
      const svg = readFileSync(join(publicDir, sheet), "utf8");
      const sheetFrames = Array.from(
        svg.matchAll(/<svg\b[^>]*\bid="(enemy-[a-zA-Z]+-\d+)"/gu),
        ([, id]) => id,
      );
      const expected = ids.map((id) => ({ id, svgSheet: true, svgSheetMember: undefined }));
      expect(urls.filter((url) => url === sheet)).toEqual([sheet]);
      expect(
        core.assets
          .filter((asset) => asset.path === sheet)
          .map(({ id, svgSheet, svgSheetMember }) => ({ id, svgSheet, svgSheetMember })),
      ).toEqual(expected);
      expect(sheetFrames).toEqual(ids);
      expect(urls).toContain(`/art/enemies/${stem}-jets.json`);
      for (let index = 0; index < 16; index++) {
        expect(urls).not.toContain(`/art/enemies/${archetype}-${index}.svg`);
      }
    }
  });

  it("precaches the medium m1 sheet and keeps its logical frame keys", () => {
    const urls = artUrls(artFiles);
    const sheet = "/art/asteroids/asteroid-m1-sheet.svg";
    const ids = Array.from({ length: 24 }, (_, index) => `asteroid-m1-${index}`);
    const rock = ASTEROID_ART.asteroids.find(({ id }) => id === "asteroid-m1");
    const svg = readFileSync(join(publicDir, sheet), "utf8");
    const frameIds = Array.from(
      svg.matchAll(/<svg\b[^>]*\bid="(asteroid-m1-\d+)"/gu),
      ([, id]) => id,
    );
    expect(rock?.svgSheet).toBe(sheet);
    expect(rock?.frames.map(({ file }) => file)).toEqual(
      ids.map((id) => `/art/asteroids/${id}.svg`),
    );
    expect(frameIds).toEqual(ids);
    expect(urls.filter((url) => url === sheet)).toEqual([sheet]);
    expect(urls.filter((url) => /^\/art\/asteroids\/asteroid-m1-\d+\.svg$/u.test(url))).toEqual([]);
  });

  it("leaves out the icon review sheet", () => {
    expect(artUrls(artFiles).filter((url) => url.includes("contact-sheet"))).toEqual([]);
  });
});

describe("galaxy preview cards", () => {
  it("lists every card the selector loads, both states, with the art", () => {
    const urls = artUrls(artFiles);
    const cards = GALAXIES.flatMap((galaxy) => {
      const { locked, open } = routePreviews(galaxy);
      return [open, locked];
    });
    expect(cards.filter((url) => !urls.includes(url))).toEqual([]);
    expect(urls.filter((url) => url.startsWith("/art/previews/"))).toEqual(cards.toSorted());
  });
});
