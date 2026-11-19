import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { HashedFiles } from "@andornaut/game-kit/build/precachePlugin";
import { validatePrecacheGroups } from "@andornaut/game-kit/runtime/web/pwa/precacheGroups";
import { describe, expect, it, vi } from "vitest";

import platform from "../../public/art/cartwheel/enemies/platform-hardpoints.json";
import cartwheel from "../../public/art/cartwheel/manifest.json";
import core from "../../public/art/manifest.json";
import jump from "../../public/art/quantum-jump.json";
import materialData from "../../public/art/ship-materials.json";
import paletteData from "../../public/art/ship-paint.json";
import { GALAXY_ID, GALAXY_NUMBERS } from "../data/galaxies.ts";
import * as enemyArt from "../game/enemyArt.ts";
import { galaxyPrecacheGroupAudit, galaxyPrecacheGroups } from "./galaxyPrecacheGroups.ts";

const ids = GALAXY_NUMBERS.map((id) => GALAXY_ID[id]);
const manifest = (id: string) => `/art/${id}/manifest.json`;
function fixture(extra: Record<string, unknown> = {}, physical: readonly string[] = []) {
  const json: Record<string, unknown> = {
    "/art/manifest.json": {
      assets: [{ id: "core", path: "/art/common/core.svg" }],
      galaxies: Object.fromEntries(ids.map((id) => [id, manifest(id)])),
      shipMaterials: "/art/materials.json",
      ui: { manifest: "/art/ui/manifest.json" },
    },
    "/art/materials.json": { palette: "/art/palette.json" },
    "/art/palette.json": {},
    "/art/ui/manifest.json": { files: ["/art/ui/font.ttf", "/art/story/room.png"] },
    ...Object.fromEntries(
      ids.map((id) => [
        manifest(id),
        { assets: [{ id: `${id}-world`, path: `/physical/${id}.svg` }] },
      ]),
    ),
    ...extra,
  };
  const files: HashedFiles = {
    sounds: { mp3: ["/assets/cue.mp3"], ogg: ["/assets/cue.ogg"] },
    urls: [
      ...Object.keys(json),
      ...ids.map((id) => `/physical/${id}.svg`),
      "/art/common/core.svg",
      "/art/ui/font.ttf",
      "/art/story/room.png",
      "/assets/entry-hash.js",
      "/play/",
      ...physical,
    ],
  };
  const context = {
    readJson: (url: string) => {
      if (!(url in json)) {
        throw new Error("Unavailable JSON");
      }
      return json[url];
    },
  };
  const groups = galaxyPrecacheGroups(context, files);
  const optional = Object.values(groups.urls).flat();
  const universe = [...new Set([...files.urls, ...Object.values(files.sounds).flat()])];
  return { context, files, groups, json, optional, universe };
}

type ShipRecord = { id: string; path: string; paint?: string; directionIndex: number };
function semanticCorpus() {
  const root = {
    assets: structuredClone(core.assets as ShipRecord[]).filter(
      (asset) => /^ship(?:-|$)/.test(asset.id) && Number.isInteger(asset.directionIndex),
    ),
    quantumJump: core.quantumJump,
    shipMaterials: core.shipMaterials,
  };
  const documents = new Map<string, unknown>([
    ["/art/manifest.json", root],
    [root.quantumJump, structuredClone(jump)],
    [root.shipMaterials, structuredClone(materialData)],
    ["/art/ship-paint.json", structuredClone(paletteData)],
  ]);
  const physical = new Set([...documents.keys(), "/art/ship-jets.json"]);
  const publicUrl = (url: string) => new URL(`../../public${url}`, import.meta.url);
  const collect = (value: unknown): void => {
    if (
      typeof value === "string" &&
      value.startsWith("/art/") &&
      /\.[a-z0-9]+$/i.test(value) &&
      existsSync(publicUrl(value))
    ) {
      physical.add(value);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(collect);
    }
  };
  documents.forEach(collect);
  return {
    context: {
      readJson: (url: string) =>
        documents.has(url) ? documents.get(url) : JSON.parse(readFileSync(publicUrl(url), "utf8")),
    },
    documents,
    files: { sounds: {}, urls: [...physical].sort() } satisfies HashedFiles,
    root,
  };
}

describe("physical galaxy precache partition", () => {
  it("keeps six disjoint optional groups, first two initial, and mandatory shell/root transitive art", () => {
    const f = fixture();
    expect(f.groups.initial).toEqual(["sunflower", "whirlpool"]);
    expect(Object.keys(f.groups.urls)).toEqual(ids);
    expect(new Set(f.optional).size).toBe(f.optional.length);
    for (const id of ids) {
      const sharedMetadata = ids.some((consumer) =>
        enemyArt.GALAXY_FAMILIES.some((family) =>
          [...family.wired].some(
            (archetype) =>
              consumer !== id && enemyArt.galaxyFamily(consumer, archetype)?.galaxy === id,
          ),
        ),
      );
      expect(f.groups.urls[id]).toEqual(
        [!sharedMetadata ? manifest(id) : undefined, `/physical/${id}.svg`]
          .filter((url): url is string => url !== undefined)
          .sort(),
      );
    }
    const base = f.universe.filter((url) => !f.optional.includes(url));
    expect(base).toEqual(
      expect.arrayContaining([
        "/art/manifest.json",
        "/art/materials.json",
        "/art/palette.json",
        "/art/ui/manifest.json",
        "/art/ui/font.ttf",
        "/art/story/room.png",
        "/assets/entry-hash.js",
        "/assets/cue.mp3",
        "/assets/cue.ogg",
        "/play/",
      ]),
    );
    expect(new Set([...base, ...f.optional])).toEqual(new Set(f.universe));
    expect(validatePrecacheGroups(f.universe, f.groups)).toEqual(f.groups);
  });

  it("shares transitive dependencies once, follows relative paths, cycles, asset IDs and declared templates", () => {
    const f = fixture(
      {
        [manifest("needle")]: {
          assets: [
            { id: "needle-world", path: "/physical/needle.svg" },
            { id: "known-frame", path: "/physical/shared.svg" },
          ],
          files: ["./sidecar.json", "/physical/shared.json"],
        },
        [manifest("andromeda")]: { files: ["/physical/shared.json"] },
        "/art/needle/other.json": { next: "sidecar.json" },
        "/art/needle/sidecar.json": {
          file: "frames/{heading}.svg",
          frame: "known-frame",
          next: "other.json",
        },
        "/physical/shared.json": { file: "shared.svg" },
      },
      ["/art/needle/frames/0.svg", "/art/needle/frames/1.svg", "/physical/shared.svg"],
    );
    expect(f.groups.urls.needle).toEqual(
      expect.arrayContaining([
        "/art/needle/sidecar.json",
        "/art/needle/other.json",
        "/art/needle/frames/0.svg",
        "/art/needle/frames/1.svg",
      ]),
    );
    expect(f.optional).not.toContain("/physical/shared.json");
    expect(f.optional).not.toContain("/physical/shared.svg");
    expect(new Set(f.optional).size).toBe(f.optional.length);
  });

  it("retains current ownership and shares only an explicitly selected canonical Claim subset", () => {
    const assets = (cartwheel.assets as Record<string, unknown>[]).filter(
      (asset) => asset.family === "claim" && asset.archetype === "platform",
    );
    const metadata = "/art/cartwheel/enemies/platform-hardpoints.json";
    const selected = [
      manifest("cartwheel"),
      metadata,
      ...assets.map((asset) => asset.path as string),
    ];
    const f = fixture(
      {
        [manifest("cartwheel")]: {
          assets: [...assets, { path: "/physical/cartwheel-world.svg" }],
          world: "/art/cartwheel/world.json",
        },
        "/art/cartwheel/enemies/platform-hardpoints.json": platform,
        "/art/cartwheel/world.json": { file: "/physical/cartwheel-world.svg" },
      },
      [...assets.map((asset) => asset.path as string), "/physical/cartwheel-world.svg"],
    );
    expect(assets.length).toBeGreaterThan(0);
    const currentSelection = enemyArt.galaxyFamily("phantom", "platform");
    for (const url of selected) {
      expect(f.groups.urls.cartwheel!.includes(url)).toBe(!currentSelection);
    }
    const original = enemyArt.galaxyFamily;
    const claim = enemyArt.GALAXY_FAMILIES.find((family) => family.family === "claim")!;
    // The fixture supplies an already-selected dependency, not a production Phantom alias.
    const selection = vi
      .spyOn(enemyArt, "galaxyFamily")
      .mockImplementation((galaxy, archetype) =>
        galaxy === "phantom" && archetype === "platform" ? claim : original(galaxy, archetype),
      );
    try {
      const groups = galaxyPrecacheGroups(f.context, f.files);
      const optional = Object.values(groups.urls).flat();
      for (const url of selected) {
        expect(optional).not.toContain(url);
        expect(f.universe).toContain(url);
      }
      expect(groups.urls.cartwheel).toEqual(
        expect.arrayContaining(["/art/cartwheel/world.json", "/physical/cartwheel-world.svg"]),
      );
      expect(optional.every((url) => f.universe.includes(url))).toBe(true);
    } finally {
      selection.mockRestore();
    }
  });

  it("puts a craft's sidecars where its manifest's map names them, shared ones in base", () => {
    const shared = "/art/enemies/capital-hardpoints.json";
    const own = "/art/needle/enemies/capital-jets.json";
    const f = fixture(
      {
        [manifest("andromeda")]: {
          assets: [
            { archetype: "capital", id: "enemy-garnet-capital-0", path: "/a/capital-0.svg" },
          ],
          sidecars: { capital: { hardpoints: shared } },
        },
        [manifest("needle")]: {
          assets: [
            { archetype: "capital", id: "enemy-needle-capital-0", path: "/n/capital-0.svg" },
          ],
          sidecars: { capital: { hardpoints: shared, jets: own } },
        },
        [own]: {},
        [shared]: {},
      },
      ["/a/capital-0.svg", "/n/capital-0.svg"],
    );
    expect(f.groups.urls.needle).toEqual(expect.arrayContaining([own, "/n/capital-0.svg"]));
    expect(f.groups.urls.andromeda).toContain("/a/capital-0.svg");
    expect(f.optional).not.toContain(shared);
    expect(f.universe).toContain(shared);
  });

  it("keeps each galaxy's sidecars with its craft's frames and shared sidecars in base", () => {
    const root = new URL("../../public", import.meta.url).pathname;
    const urls = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(root.length))
      .sort();
    const groups = galaxyPrecacheGroups(
      { readJson: (url) => JSON.parse(readFileSync(join(root, url), "utf8")) },
      { sounds: {}, urls },
    );
    const owner = new Map(
      Object.entries(groups.urls).flatMap(([galaxy, list]) => list.map((url) => [url, galaxy])),
    );
    const group = (url: string) => owner.get(url) ?? "base";
    // A sidecar outside every galaxy's folder is a shared core file.
    const shared = (url: string) =>
      !Object.keys(core.galaxies).some((galaxy) => url.startsWith(`/art/${galaxy}/`));
    let checked = 0;
    for (const path of ["/art/manifest.json", ...Object.values(core.galaxies)]) {
      const document = JSON.parse(readFileSync(join(root, path), "utf8")) as {
        assets: { archetype?: string; craft?: string; id: string; path: string }[];
        sidecars?: unknown;
      };
      const sidecars = enemyArt.readSidecars(document.sidecars)!;
      for (const asset of document.assets) {
        const craft = asset.archetype ? enemyArt.enemyFrameKey(asset) : asset.craft;
        for (const sidecar of Object.values((craft && sidecars.get(craft)) ?? {})) {
          expect(group(sidecar), `${asset.id} ${sidecar}`).toBe(
            shared(sidecar) ? "base" : group(asset.path),
          );
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    // The cargo hauler flies the retaliator's jets; both industrial crafts share core hardpoints.
    for (const galaxy of ["andromeda", "cartwheel", "needle"]) {
      expect(groups.urls[galaxy]).toEqual(
        expect.arrayContaining([
          `/art/${galaxy}/enemies/retaliator-jets.json`,
          `/art/${galaxy}/enemies/retaliatorCargoHauler-shards.json`,
          `/art/${galaxy}/enemies/retaliatorMiningFreighter-jets.json`,
          `/art/${galaxy}/enemies/retaliatorMiningFreighter-shards.json`,
        ]),
      );
    }
    const optional = Object.values(groups.urls).flat();
    for (const craft of ["retaliator", "retaliatorMiningFreighter"]) {
      expect(optional).not.toContain(`/art/enemies/${craft}-hardpoints.json`);
      expect(urls).toContain(`/art/enemies/${craft}-hardpoints.json`);
    }
  });

  it("keeps unreadable/unclassified physical URLs in base and never adds retired logical paths", () => {
    const f = fixture(
      {
        [manifest("phantom")]: { file: "/unclassified/broken.json" },
        "/art/materials.json": { retiredLogical: "/art/ship-blue-0.svg" },
        "/art/needle/misleading-name.svg.json": {},
        "/unclassified/broken.json": undefined,
        "/unclassified/relative.json": { path: "missing.svg" },
      },
      ["/art/cartwheel/unreferenced.svg", "/elsewhere/unknown.bin"],
    );
    for (const url of [
      "/unclassified/broken.json",
      "/art/needle/misleading-name.svg.json",
      "/art/cartwheel/unreferenced.svg",
      "/elsewhere/unknown.bin",
    ]) {
      expect(f.optional).not.toContain(url);
    }
    const audit = galaxyPrecacheGroupAudit(f.context, f.files);
    expect(audit.uncertain).toEqual(
      expect.arrayContaining([
        {
          from: "/unclassified/broken.json",
          reason: "unreadable-json",
          reference: "/unclassified/broken.json",
        },
        { from: "/art/materials.json", reason: "missing-url", reference: "/art/ship-blue-0.svg" },
      ]),
    );
    expect(audit.uncertain).toContainEqual({
      from: "/unclassified/relative.json",
      reason: "relative-reference",
      reference: "missing.svg",
    });
    expect(f.optional).not.toContain("/art/ship-blue-0.svg");
    expect(f.universe).not.toContain("/art/ship-blue-0.svg");
    expect(() =>
      galaxyPrecacheGroups(
        {
          readJson: () => {
            throw new Error("offline");
          },
        },
        f.files,
      ),
    ).not.toThrow();
  });

  it("does not mutate caller inputs and produces the same partition in any discovery order", () => {
    const f = fixture();
    const before = JSON.stringify({ files: f.files, json: f.json });
    const audit = galaxyPrecacheGroupAudit(f.context, f.files);
    expect(audit.groups).toEqual(f.groups);
    expect(
      galaxyPrecacheGroupAudit(f.context, { ...f.files, urls: [...f.files.urls].reverse() }),
    ).toEqual(audit);
    expect(new Set(audit.edges.map((edge) => JSON.stringify(edge))).size).toBe(audit.edges.length);
    expect(
      audit.edges.every(({ from, to }) => f.universe.includes(from) && f.universe.includes(to)),
    ).toBe(true);
    expect(
      galaxyPrecacheGroups(f.context, { ...f.files, urls: [...f.files.urls].reverse() }),
    ).toEqual(f.groups);
    expect(JSON.stringify({ files: f.files, json: f.json })).toBe(before);
  });

  it("recognizes exact active generated ship/pose fields without dropping physical sources or metadata", () => {
    const f = semanticCorpus();
    const audit = galaxyPrecacheGroupAudit(f.context, f.files);
    expect(f.root.assets).toHaveLength(450);
    expect(f.root.assets.filter((asset) => !f.files.urls.includes(asset.path))).toHaveLength(321);
    expect(jump.warp.poses.flatMap((pose) => Object.values(pose.paths))).toHaveLength(54);
    expect(audit.uncertain).toEqual([]);
    expect(f.root.assets.filter((asset) => f.files.urls.includes(asset.path))).toHaveLength(129);
    expect(f.files.urls).toContain("/art/ship-jets.json");
    const optional = Object.values(audit.groups.urls).flat();
    expect(optional).toEqual([]);
    for (const url of [f.root.shipMaterials, "/art/ship-paint.json", f.root.quantumJump]) {
      expect(f.files.urls).toContain(url);
    }
    expect(audit.edges).toContainEqual({ from: f.root.quantumJump, to: f.root.shipMaterials });
    expect(audit.edges).toContainEqual({ from: f.root.quantumJump, to: "/art/ship-paint.json" });
  });

  it("keeps mismatched semantic records and unrelated fields strict even with a valid active package", () => {
    const mutations: ((asset: ShipRecord) => void)[] = [
      (asset) => {
        asset.id = "not-a-ship";
      },
      (asset) => {
        asset.paint = "not-a-paint";
      },
      (asset) => {
        asset.directionIndex = 0.5;
      },
    ];
    for (const mutate of mutations) {
      const f = semanticCorpus();
      const asset = f.root.assets.find((row) => row.paint !== undefined)!;
      mutate(asset);
      expect(galaxyPrecacheGroupAudit(f.context, f.files).uncertain).toEqual([
        { from: "/art/manifest.json", reason: "missing-url", reference: asset.path },
      ]);
    }
    const f = semanticCorpus();
    const logical = f.root.assets.find((asset) => !f.files.urls.includes(asset.path))!.path;
    f.documents.set(f.root.shipMaterials, {
      ...structuredClone(materialData),
      retiredLogical: logical,
    });
    expect(galaxyPrecacheGroupAudit(f.context, f.files).uncertain).toEqual([
      { from: f.root.shipMaterials, reason: "missing-url", reference: logical },
    ]);
  });

  it("requires linked valid geometry, palettes and jump metadata before any generated exemption", () => {
    const brokenGeometry = { ...structuredClone(materialData), version: 2 };
    const brokenPalettes = structuredClone(paletteData);
    brokenPalettes.schemes[0]!.id = "unknown";
    const brokenJump = structuredClone(jump);
    brokenJump.warp.poses[0]!.id = "unknown-pose";
    for (const [url, value] of [
      [core.shipMaterials, brokenGeometry],
      ["/art/ship-paint.json", brokenPalettes],
      [core.quantumJump, brokenJump],
    ] as const) {
      const f = semanticCorpus();
      f.documents.set(url, value);
      const missing = galaxyPrecacheGroupAudit(f.context, f.files).uncertain.filter(
        (entry) => entry.reason === "missing-url",
      );
      expect(missing).toHaveLength(375);
    }
    const f = semanticCorpus();
    f.documents.set("/art/manifest.json", {
      assets: f.root.assets,
      quantumJump: f.root.quantumJump,
    });
    expect(
      galaxyPrecacheGroupAudit(f.context, f.files).uncertain.filter(
        (entry) => entry.reason === "missing-url",
      ),
    ).toHaveLength(375);
  });

  it.skipIf(!process.env.ADA_GROUP_BUILD)(
    "accounts for every actual final build URL and sound variant",
    () => {
      const root = process.env.ADA_GROUP_BUILD!;
      const input = JSON.parse(readFileSync(join(root, "group-input.json"), "utf8")) as HashedFiles;
      const physical = new Set([...input.urls, ...Object.values(input.sounds).flat()]);
      const audit = galaxyPrecacheGroupAudit(
        { readJson: (url) => JSON.parse(readFileSync(join(root, "dist", url), "utf8")) },
        input,
      );
      const groups = audit.groups;
      writeFileSync(join(root, "group-result.json"), JSON.stringify(audit));
      const optional = Object.values(groups.urls).flat();
      expect(new Set(optional).size).toBe(optional.length);
      expect(optional.every((url) => physical.has(url))).toBe(true);
      expect(validatePrecacheGroups([...physical], groups)).toEqual(groups);
      expect(groups.initial).toEqual(["sunflower", "whirlpool"]);
      const rootJson = JSON.parse(readFileSync(join(root, "dist/art/manifest.json"), "utf8"));
      expect(optional).not.toContain(rootJson.shipMaterials);
      expect(optional).not.toContain("/art/ship-paint.json");
      const selectedFamily = enemyArt.galaxyFamily("phantom", "platform");
      expect(optional.includes("/art/cartwheel/enemies/platform-hardpoints.json")).toBe(
        !selectedFamily,
      );
      expect(optional.includes("/art/cartwheel/manifest.json")).toBe(!selectedFamily);
      expect(groups.urls.cartwheel!.some((url) => url.includes("capital"))).toBe(true);
      expect([...physical].some((url) => /ship-blue-\d+\.svg$/.test(url))).toBe(false);
    },
  );
});
