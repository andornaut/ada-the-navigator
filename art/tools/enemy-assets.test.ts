import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { readMuzzleArt } from "../../src/data/enemyMuzzles.ts";
import { INDUSTRIAL_STEMS } from "./crafts.ts";
import { fleetCrafts } from "./fleet.ts";
import { readManifest, type SidecarKind, type Sidecars } from "./manifest.ts";
import { anchor, ENEMY_HEADINGS } from "./projection.ts";
import { strictlyConvex } from "./silhouette.ts";

type Parts = [number, number][][];
type File = Omit<Parameters<typeof readMuzzleArt>[0], "hardpoints"> & {
  hardpoints: { id: string; role: string; top: string | null }[];
  tiers?: { positions: number[]; mounts: Record<string, { armed: true } | null> }[];
  version: number;
  archetype: string;
  headings: {
    index: number;
    hardpoints: {
      id: string;
      hidden?: true;
      pivot?: number[];
      collision: Record<string, Parts>;
    }[];
  }[];
  tops: Record<string, { index: number; collision: Parts; muzzles: number[][] }[]>;
};

// Each family's manifest and the sidecars map the runtime reads its files from.
const families = ["core", "andromeda", "cartwheel", "needle"] as const;
const sidecars = new Map(
  families.map((family) => [family, (readManifest(family).sidecars ?? {}) as Sidecars]),
);
const installed = (family: (typeof families)[number], craft: string, kind: SidecarKind) => {
  const path = sidecars.get(family)![craft]?.[kind];
  assert.ok(path, `${family} sidecars has no ${craft}.${kind}`);
  return `public${path}`;
};
const stems = ["frigate", "capital", "retaliator", ...Object.values(INDUSTRIAL_STEMS)];
const files = families.flatMap((family) =>
  [
    ...stems,
    ...(family === "core" ? ["gadget"] : []),
    ...(family === "cartwheel" ? ["platform"] : []),
    ...(family !== "needle" ? ["hostileStation"] : []),
  ].map((stem) => {
    const path = installed(family, stem, "hardpoints");
    return { path, stem, file: JSON.parse(readFileSync(path, "utf8")) as File };
  }),
);

test("installed v1 metadata keeps every physical state and independently aimed top within its raw frame", () => {
  for (const { file, path } of files) {
    assert.equal(file.version, 1, path);
    assert.equal(file.headings.length, 16, path);
    const inside = (x: number, y: number) =>
      assert.ok(
        Number.isFinite(x) &&
          Number.isFinite(y) &&
          x >= 0 &&
          y >= 0 &&
          x <= file.frame &&
          y <= file.frame,
        `${path}: ${x},${y} outside frame ${file.frame}`,
      );
    for (const heading of file.headings) {
      for (const part of heading.hardpoints) {
        for (const polygons of Object.values(part.collision)) {
          // A base the hull hides whole at a heading is an empty frame with no collision.
          assert.ok(polygons.length > 0 || part.hidden, path);
          for (const polygon of polygons) {
            assert.ok(strictlyConvex(polygon), path);
            for (const [x, y] of polygon) inside(x, y);
          }
        }
        if (!part.pivot) continue;
        const own = file.hardpoints.find(({ id }) => id === part.id)!.top;
        const names = own
          ? [own]
          : file.fill?.includes(part.id)
            ? Object.values(file.weaponTops!).map(({ top }) => top)
            : [];
        for (const name of names) {
          assert.equal(file.tops[name]!.length, 16, path);
          for (const top of file.tops[name]!) {
            assert.ok(top.muzzles.length > 0, path);
            for (const polygon of top.collision) {
              assert.ok(strictlyConvex(polygon), path);
              for (const [x, y] of polygon) inside(x + part.pivot[0]!, y + part.pivot[1]!);
            }
          }
        }
      }
    }
  }
});

test("installed retaliator bodies keep one turret with a shot origin per pod cell in the muzzle reader", () => {
  for (const { file, path } of files.filter(({ stem }) =>
    ["retaliator", ...Object.values(INDUSTRIAL_STEMS)].some((name) => name === stem),
  )) {
    assert.equal(file.archetype, "retaliator", path);
    assert.deepEqual(
      file.hardpoints.map(({ id }) => id),
      ["turret"],
      path,
    );
    const art = readMuzzleArt(file);
    assert.equal(art.pivots.get("turret")!.length, 16, path);
    assert.ok(
      art.tops.get("turret")!.every((tips) => tips.length === 2),
      path,
    );
  }
});

// Every manifest's sidecars name the fleet producer's jets: each family's own class keys and
// the coral galaxies' design keys (frigateTwin, capitalManta, capitalForked).
const crafts = new Map(fleetCrafts().map((craft) => [craft.key, craft]));
const fleetJets = (
  ["core", "whirlpool", "phantom", "andromeda", "cartwheel", "needle"] as const
).flatMap((manifest) =>
  Object.entries((readManifest(manifest).sidecars ?? {}) as Sidecars).flatMap(([key, entry]) => {
    const stem = /^\/art\/enemies\/(fleet[A-Za-z]+)-jets\.json$/u.exec(entry.jets ?? "")?.[1];
    return stem ? [{ key, manifest, path: `public${entry.jets}`, stem }] : [];
  }),
);

test("every fleet craft ships its producer's jets file, with each mouth's anchor", () => {
  assert.deepEqual(new Set(fleetJets.map(({ stem }) => stem)), new Set(crafts.keys()));
  for (const { key, manifest, path, stem } of fleetJets) {
    const craft = crafts.get(stem)!;
    assert.ok(craft, `${manifest} ${key}: ${path}`);
    const actual = JSON.parse(readFileSync(path, "utf8")) as {
      frame: number;
      headings: { mouths: { anchor: number[] }[] }[];
    };
    assert.equal(actual.frame, craft.frame, path);
    assert.equal(actual.headings.length, ENEMY_HEADINGS, path);
    for (const [yaw, { mouths }] of actual.headings.entries()) {
      // Mesh space (forward +x, port +y) to the projection's local space (forward -y).
      const expected = craft.mouths.map(({ at: [l, w, z] }) =>
        anchor(ENEMY_HEADINGS, craft.frame / 2, yaw, [w, -l, z]),
      );
      assert.deepEqual(
        mouths.map((mouth) => mouth.anchor),
        expected,
        `${path} heading ${yaw}`,
      );
    }
  }
});

test("installed station families retain the approved tier prefixes and exact Rapid/Ring muzzle contracts", () => {
  const stations = files.filter(({ stem }) => stem === "hostileStation");
  assert.equal(stations.length, 3);
  for (const { file, path } of stations) {
    assert.equal(file.archetype, "hostileStation", path);
    assert.equal(file.hardpoints.length, 8, path);
    assert.ok(
      file.hardpoints.every(({ role }) => role === "turret"),
      path,
    );
    assert.deepEqual(
      file.tiers!.map(({ positions, mounts }) => ({
        positions,
        armed: Object.values(mounts).filter(Boolean).length,
      })),
      [
        { positions: [4, 4], armed: 6 },
        { positions: [5, 5], armed: 7 },
        { positions: [6, 6], armed: 8 },
      ],
      path,
    );
    assert.deepEqual(Object.keys(file.weaponTops!).sort(), ["rapidMissile", "ringBurst"], path);
    for (const part of file.hardpoints)
      assert.equal(part.top, part.id === "weapon-5" ? "dome" : "pod", path);
    const art = readMuzzleArt(file);
    assert.ok(
      art.tops.get("pod")!.every((tips) => tips.length === 4),
      path,
    );
    assert.ok(
      art.tops.get("dome")!.every((tips) => tips.length === 8),
      path,
    );
  }
});
