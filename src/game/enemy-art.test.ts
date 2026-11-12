import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import capitalHardpoints from "../../public/art/enemies/capital-hardpoints.json";
import capitalJets from "../../public/art/enemies/capital-jets.json";
import fighterJets from "../../public/art/enemies/fighter-jets.json";
import frigateHardpoints from "../../public/art/enemies/frigate-hardpoints.json";
import frigateJets from "../../public/art/enemies/frigate-jets.json";
import interceptorJets from "../../public/art/enemies/interceptor-jets.json";
import retaliatorJets from "../../public/art/enemies/retaliator-jets.json";
import swarmJets from "../../public/art/enemies/swarm-jets.json";
import { enemyCatalog, enemyEncounterTuning } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { enemySpeedFraction } from "../model/enemy-ai.ts";
import { ART_MANIFEST as manifest } from "../testing/public-art.ts";
import {
  aimIndex,
  CLAIM,
  CLAIM_WIRED,
  composedArchetypes,
  composeEnemy,
  type EnemyArt,
  enemyArt,
  type EnemyFrame,
  enemyFrameSets,
  enemyHardpointsPath,
  enemyJetsPath,
  enemyJetTriangles,
  enemyPartFrame,
  HIT_FLASH_MS,
  HitFlashes,
  hullHeading,
  type PartPose,
  readHardpointLayout,
  selectEnemyFrame,
  turretMuzzles,
} from "./enemy-art.ts";
import { jetLength } from "./ship-jets.ts";

const assets = manifest.assets as EnemyFrame[];
const json = (path: string): unknown => {
  const url = new URL(`../../public${path}`, import.meta.url);
  return existsSync(url) ? JSON.parse(readFileSync(url, "utf8")) : undefined;
};
const files: Record<string, unknown> = {
  capital: capitalJets,
  fighter: fighterJets,
  frigate: frigateJets,
  interceptor: interceptorJets,
  retaliator: retaliatorJets,
  swarm: swarmJets,
};
const layouts: Record<string, unknown> = {
  capital: capitalHardpoints,
  frigate: frigateHardpoints,
};
const build = (frames: readonly EnemyFrame[], layout = (name: string) => layouts[name]) =>
  enemyArt(
    (archetype) => files[archetype],
    layout,
    composedArchetypes(assets),
    frames,
    enemyFrameSets(frames),
  );
const art = build(assets);
const sector = (name: string) => art.get(name)!;
const at = (degrees: number) => ({
  x: Math.cos((degrees * Math.PI) / 180),
  y: Math.sin((degrees * Math.PI) / 180),
});

describe("enemy frame sets", () => {
  it("reads sixteen sized headings for each sector one archetype from Art's manifest", () => {
    expect([...art.keys()].sort()).toEqual([
      "capital",
      "fighter",
      "frigate",
      "interceptor",
      "retaliator",
      "swarm",
    ]);
    const sizes = Object.fromEntries(
      [...art].map(([name, set]) => {
        expect(set.frames).toHaveLength(16);
        expect(set.frames.map((frame) => frame.directionIndex)).toEqual([...Array(16).keys()]);
        return [name, set.frames[0]!.displayWidth];
      }),
    );
    expect(sizes).toEqual({
      capital: 210,
      fighter: 42,
      frigate: 168,
      interceptor: 38.5,
      retaliator: 84,
      swarm: 35,
    });
  });

  it("frames every catalog archetype but the platform, with parts only for the heavies", () => {
    // CLEANUP (added 2026-11-11): the platform draws its vector placeholder until Art lands.
    expect(Object.keys(enemyCatalog).filter((name) => !art.has(name))).toEqual(["platform"]);
    expect([...art].filter(([, set]) => set.parts).map(([name]) => name)).toEqual([
      "frigate",
      "capital",
    ]);
  });

  it("tells the heavies' part frames, which load after the scene starts, from hull headings", () => {
    const parts = assets.filter(enemyPartFrame);
    // Each composed archetype of each family has 16 frames per hardpoint state and top design,
    // as its hardpoints file lists them.
    const sets = new Set(
      parts.map(
        (asset) => `${asset.path!.slice(0, asset.path!.lastIndexOf("/") + 1)}|${asset.archetype}`,
      ),
    );
    const expected = [...sets].reduce((sum, key) => {
      const [dir, archetype] = key.split("|") as [string, string];
      const file = json(`${dir}${archetype}-hardpoints.json`) as {
        hardpoints: { states: string[]; top: string | null }[];
      };
      const tops = new Set(file.hardpoints.flatMap((part) => part.top ?? []));
      return (
        sum + (file.hardpoints.reduce((n, part) => n + part.states.length, 0) + tops.size) * 16
      );
    }, 0);
    expect(parts).toHaveLength(expected);
    // The coral, claim and garnet families' composed heavies.
    expect(expected).toBe(1136);
    expect(parts.some((asset) => /^enemy-[a-z]+-\d+$/i.test(asset.id))).toBe(false);
  });

  it("keeps hardpoint bases and turret tops out of the hull heading sets", () => {
    for (const set of art.values()) {
      expect(set.frames.every((frame) => /^enemy-[a-z]+-\d+$/i.test(frame.id))).toBe(true);
    }
  });

  it("finds each archetype's jets file beside its frames", () => {
    expect(enemyJetsPath("fighter", sector("fighter").frames[3]!)).toBe(
      "/art/enemies/fighter-jets.json",
    );
    expect(enemyHardpointsPath("capital", sector("capital").frames[3]!)).toBe(
      "/art/enemies/capital-hardpoints.json",
    );
  });
});

describe("enemy frame selection", () => {
  it.each([0, 1, 4, 8, 12, 15])("draws heading %i at its exact world angle", (index) => {
    expect(selectEnemyFrame(sector("fighter"), at(index * 22.5)).directionIndex).toBe(index);
  });

  it("draws the nearest of sixteen headings for a continuous facing", () => {
    const set = sector("swarm");
    expect(selectEnemyFrame(set, at(11)).id).toBe("enemy-swarm-0");
    expect(selectEnemyFrame(set, at(12)).id).toBe("enemy-swarm-1");
    expect(selectEnemyFrame(set, at(-11)).id).toBe("enemy-swarm-0");
    expect(selectEnemyFrame(set, at(-12)).id).toBe("enemy-swarm-15");
    // A new hull faces up, world angle -90 degrees.
    expect(selectEnemyFrame(set, { x: 0, y: -1 }).id).toBe("enemy-swarm-12");
  });
});

describe("enemy jets", () => {
  it.each([
    ["swarm", 1, 80],
    ["fighter", 2, 96],
    ["interceptor", 1, 88],
    ["retaliator", 3, 192],
    ["frigate", 2, 384],
    ["capital", 2, 480],
  ] as const)("draws %s with %i mouths of two haloless layers", (name, mouths, frame) => {
    const set = sector(name);
    expect(set.jets?.frame).toBe(frame);
    expect(set.jets?.headings.every((entry) => entry.length === mouths)).toBe(true);
    expect(set.jets?.layers.map((layer) => layer.colors)).toEqual([
      [0xb8644c, 0xf0a07c],
      [0xd68b72, 0xffe2c8],
    ]);
    for (const heading of set.frames) {
      expect(enemyJetTriangles(set, heading, 1)).toHaveLength(mouths * 2);
    }
  });

  it.each(["swarm", "fighter", "interceptor", "retaliator", "frigate", "capital"])(
    "maps %s mouth geometry from frame pixels to display pixels about the pivot",
    (name) => {
      const set = sector(name);
      const jets = set.jets!;
      const frame = set.frames[5]!;
      const scale = frame.displayWidth! / jets.frame;
      const [outer] = jets.layers;
      const mouth = jets.headings[5]![0]!;
      const tip = jetLength(jets, 1) * outer!.length;
      const [left, point, right] = enemyJetTriangles(set, frame, 1)[0]!.points;
      expect(point.x).toBeCloseTo((mouth.anchor.x + mouth.axis.x * tip - jets.frame / 2) * scale);
      expect(point.y).toBeCloseTo((mouth.anchor.y + mouth.axis.y * tip - jets.frame / 2) * scale);
      expect(left.x).toBeCloseTo(
        (mouth.anchor.x + mouth.half.x * outer!.width - jets.frame / 2) * scale,
      );
      expect(right.y).toBeCloseTo(
        (mouth.anchor.y - mouth.half.y * outer!.width - jets.frame / 2) * scale,
      );
    },
  );

  it("does not clip jet tips to the frame", () => {
    const extents = [...art.values()].flatMap((set) =>
      set.frames.flatMap((frame) =>
        enemyJetTriangles(set, frame, 1).flatMap(({ points }) =>
          points.map(
            (point) => Math.max(Math.abs(point.x), Math.abs(point.y)) / (frame.displayWidth! / 2),
          ),
        ),
      ),
    );
    expect(Math.max(...extents)).toBeGreaterThan(1);
  });

  it("scales jets with speed as a fraction of the archetype's maximum speed", () => {
    const set = sector("fighter");
    const frame = set.frames[0]!;
    const definition = enemyCatalog.fighter;
    const maxSpeed = PROTOTYPE.tuning.maxSpeed * definition.physics.speedRatio;
    const fraction = (speed: number) =>
      enemySpeedFraction(
        definition,
        PROTOTYPE.tuning.maxSpeed,
        enemyEncounterTuning.speedCapRatio,
        {
          velocity: { x: 0, y: speed },
        },
      );
    const reach = (f: number) => {
      const [, point] = enemyJetTriangles(set, frame, f)[0]!.points;
      const [left, , right] = enemyJetTriangles(set, frame, f)[0]!.points;
      return Math.hypot(point.x - (left.x + right.x) / 2, point.y - (left.y + right.y) / 2);
    };
    expect(fraction(0)).toBe(0);
    expect(enemyJetTriangles(set, frame, fraction(0))).toEqual([]);
    expect(fraction(maxSpeed / 2)).toBeCloseTo(0.5, 12);
    expect(fraction(maxSpeed * 3)).toBe(1);
    const jets = set.jets!;
    expect(reach(fraction(maxSpeed / 2)) / reach(fraction(maxSpeed))).toBeCloseTo(
      jetLength(jets, 0.5) / jetLength(jets, 1),
      9,
    );
  });
});

describe("enemy art fallback", () => {
  const swarmFrames = assets.filter((asset) => asset.id.startsWith("enemy-swarm-"));

  it("keeps the vector placeholder for an archetype with a missing or mislabelled frame", () => {
    const missing = assets.filter((asset) => asset.id !== "enemy-swarm-7");
    expect(enemyFrameSets(missing).has("swarm")).toBe(false);
    expect(enemyFrameSets(missing).has("fighter")).toBe(true);
    const mislabelled = assets.map((asset) =>
      asset.id === "enemy-fighter-2" ? { ...asset, archetype: "swarm" } : asset,
    );
    expect(enemyFrameSets(mislabelled).has("fighter")).toBe(false);
    const unsized = assets.map((asset) =>
      asset.id === "enemy-interceptor-0" ? { ...asset, displayWidth: 0 } : asset,
    );
    expect(enemyFrameSets(unsized).has("interceptor")).toBe(false);
  });

  it("requires exactly sixteen headings, so a missing last or an extra frame falls back", () => {
    const lastMissing = assets.filter((asset) => asset.id !== "enemy-retaliator-15");
    expect(enemyFrameSets(lastMissing).has("retaliator")).toBe(false);
    expect(enemyFrameSets(lastMissing).has("swarm")).toBe(true);
    const sixteenth = assets.find((asset) => asset.id === "enemy-fighter-15")!;
    const extra = [
      ...assets,
      { ...sixteenth, directionIndex: 16, id: "enemy-fighter-16" } satisfies EnemyFrame,
    ];
    expect(enemyFrameSets(extra).has("fighter")).toBe(false);
    expect(enemyFrameSets(extra).has("interceptor")).toBe(true);
  });

  it("draws frames without jets when the jets file is missing or mismatched", () => {
    const sets = new Map([["swarm", swarmFrames]]);
    const none = () => undefined;
    const absent = enemyArt(none, none, new Set(), swarmFrames, sets).get("swarm")!;
    expect(absent.jets).toBeUndefined();
    expect(enemyJetTriangles(absent, absent.frames[0]!, 1)).toEqual([]);
    const short = { ...swarmJets, headings: swarmJets.headings.slice(0, 8) };
    expect(
      enemyArt(() => short, none, new Set(), swarmFrames, sets).get("swarm")!.jets,
    ).toBeUndefined();
    const set: EnemyArt = enemyArt(() => swarmJets, none, new Set(), swarmFrames, sets).get(
      "swarm",
    )!;
    expect(set.jets?.headings).toHaveLength(16);
  });

  it("keeps a heavy's vector placeholder without a valid layout or every part frame", () => {
    expect(build(assets, () => undefined).has("frigate")).toBe(false);
    expect(build(assets, () => undefined).has("swarm")).toBe(true);
    const noTop = assets.filter((asset) => asset.id !== "enemy-capital-turret-top-9");
    expect(build(noTop).has("capital")).toBe(false);
    expect(build(noTop).has("frigate")).toBe(true);
    const noStump = assets.filter((asset) => asset.id !== "enemy-frigate-port-destroyed-4");
    expect(build(noStump).has("frigate")).toBe(false);
    // Before its part frames load, a heavy keeps its placeholder rather than a bare hull.
    const unloaded = assets.filter((asset) => !enemyPartFrame(asset));
    expect(build(unloaded).has("capital")).toBe(false);
    expect(build(unloaded).has("fighter")).toBe(true);
  });

  it("rejects a layout whose heading order or turret pivots disagree with its hardpoints", () => {
    expect(readHardpointLayout("frigate", frigateHardpoints)).toBeDefined();
    expect(readHardpointLayout("capital", frigateHardpoints)).toBeUndefined();
    const copy = () => JSON.parse(JSON.stringify(frigateHardpoints)) as typeof frigateHardpoints;
    const reordered = copy();
    reordered.headings[3]!.order = ["hull", "port", "engine"];
    expect(readHardpointLayout("frigate", reordered)).toBeUndefined();
    const unpivoted = copy();
    delete (unpivoted.headings[3]!.hardpoints[1] as { pivot?: number[] }).pivot;
    expect(readHardpointLayout("frigate", unpivoted)).toBeUndefined();
    const fewerAims = copy();
    fewerAims.tops.gun = fewerAims.tops.gun.slice(0, 15);
    expect(readHardpointLayout("frigate", fewerAims)).toBeUndefined();
  });
});

const world = (degrees: number) => at(degrees);
const pose = (destroyed: readonly string[] = [], aim = world(0)): PartPose => ({
  aim: () => aim,
  intact: (hardpoint) => !destroyed.includes(hardpoint),
});

describe("composed heavies", () => {
  const frigate = sector("frigate");
  const capital = sector("capital");

  it.each([2, 6, 10, 14])("draws frigate heading %i in its layer order", (heading) => {
    const hull = frigate.frames[heading]!;
    const layout = frigateHardpoints.headings[heading]!;
    const sprites = composeEnemy(frigate, pose(), hull);
    // Every hardpoint's base in the heading's order, with each gun's top straight after it.
    const expected = layout.order.flatMap((id) =>
      id === "hull" ? ["hull"] : id === "engine" ? [`${id}:base`] : [`${id}:base`, `${id}:top`],
    );
    expect(
      sprites.map((part) => (part.hardpoint ? `${part.hardpoint}:${part.layer}` : "hull")),
    ).toEqual(expected);
    expect(sprites.find((part) => part.hardpoint === null)!.frame.id).toBe(
      `enemy-frigate-${heading}`,
    );
  });

  it("centres each base on its anchor and each top on its pivot, in display px", () => {
    const hull = capital.frames[4]!;
    const scale = 210 / 480;
    const placed = capitalHardpoints.headings[4]!.hardpoints.find(
      (part) => part.id === "weapon-left",
    )!;
    const sprites = composeEnemy(capital, pose(), hull);
    const base = sprites.find((part) => part.hardpoint === "weapon-left" && part.layer === "base")!;
    const top = sprites.find((part) => part.hardpoint === "weapon-left" && part.layer === "top")!;
    expect(base.frame.id).toBe("enemy-capital-weapon-left-intact-4");
    expect(base.offset.x).toBeCloseTo((placed.anchor[0]! - 240) * scale, 9);
    expect(base.offset.y).toBeCloseTo((placed.anchor[1]! - 240) * scale, 9);
    expect(top.offset.y).toBeCloseTo((placed.pivot![1]! - 240) * scale, 9);
  });

  it("aims each top by world angle, whatever the hull heading", () => {
    expect(aimIndex(world(0))).toBe(0);
    expect(aimIndex(world(22.5 * 5))).toBe(5);
    expect(aimIndex(world(-22.5))).toBe(15);
    for (const heading of [0, 7, 12]) {
      const tops = composeEnemy(capital, pose([], world(22.5 * 9)), capital.frames[heading]!)
        .filter((part) => part.layer === "top")
        .map((part) => part.frame.id);
      expect(tops).toEqual(Array(4).fill("enemy-capital-turret-top-9"));
    }
  });

  it("draws a destroyed hardpoint's stump with no turret top", () => {
    const sprites = composeEnemy(frigate, pose(["port"]), frigate.frames[6]!);
    expect(
      sprites.filter((part) => part.hardpoint === "port").map((part) => part.frame.id),
    ).toEqual(["enemy-frigate-port-destroyed-6"]);
    expect(sprites.filter((part) => part.layer === "top")).toHaveLength(1);
  });

  it("places each barrel tip at the pivot plus the top's muzzle at its aim", () => {
    const hull = capital.frames[2]!;
    const scale = 210 / 480;
    const pivot = capitalHardpoints.headings[2]!.hardpoints.find(
      (part) => part.id === "weapon-right",
    )!.pivot!;
    const muzzles = capitalHardpoints.tops.turret[3]!.muzzles;
    const tips = turretMuzzles(capital, pose([], world(22.5 * 3)), hull, "weapon-right");
    expect(tips).toHaveLength(2);
    expect(tips[1]!.x).toBeCloseTo((pivot[0]! + muzzles[1]![0]! - 240) * scale, 9);
    expect(tips[1]!.y).toBeCloseTo((pivot[1]! + muzzles[1]![1]! - 240) * scale, 9);
    expect(turretMuzzles(capital, pose(["weapon-right"]), hull, "weapon-right")).toEqual([]);
    expect(turretMuzzles(capital, pose(), hull, "command")).toEqual([]);
  });

  it("draws each jet mouth only while its engine is intact", () => {
    const hull = capital.frames[2]!;
    const intact = (destroyed: string[]) => (id: string) => !destroyed.includes(id);
    expect(enemyJetTriangles(capital, hull, 1, intact([]))).toHaveLength(4);
    expect(enemyJetTriangles(capital, hull, 1, intact(["engine-left"]))).toHaveLength(2);
    expect(enemyJetTriangles(frigate, frigate.frames[0]!, 1, intact(["engine"]))).toEqual([]);
  });

  it("composes a hull plus an aimed top for a turret mount without hardpoint state", () => {
    // A retaliator-like craft: one turret top over the hull, aimed with the hull weapon.
    const hull = sector("retaliator").frames[0]!;
    const top = { ...hull, aimIndex: 0, top: "gun" };
    const tops = Array.from({ length: 16 }, (_, index) => ({
      ...top,
      aimIndex: index,
      id: `top-${index}`,
    }));
    const mounted: EnemyArt = {
      ...sector("retaliator"),
      parts: {
        bases: new Map([["turret", new Map()]]),
        layout: {
          frame: 192,
          hardpoints: [{ id: "turret", role: "turret", states: [], top: "gun" }],
          headings: Array.from({ length: 16 }, () => ({
            order: ["hull", "turret"],
            parts: new Map([["turret", { anchor: { x: 96, y: 96 }, pivot: { x: 96, y: 90 } }]]),
          })),
          tops: new Map([["gun", Array.from({ length: 16 }, () => [{ x: 0, y: 10 }])]]),
        },
        tops: new Map([["gun", tops]]),
      },
    };
    const sprites = composeEnemy(mounted, pose([], world(22.5 * 4)), hull);
    expect(sprites.map((part) => part.frame.id)).toEqual(["enemy-retaliator-0", "top-4"]);
    expect(sprites[1]!.offset.y).toBeCloseTo(-6 * (84 / 192), 9);
  });

  it(`flashes a hit hardpoint for ${HIT_FLASH_MS} ms after its hit points drop`, () => {
    const flashes = new HitFlashes();
    expect(flashes.observe("a#port", 3, 0)).toBe(false);
    expect(flashes.observe("a#port", 2, 16)).toBe(true);
    expect(flashes.observe("a#port", 2, 16 + HIT_FLASH_MS - 1)).toBe(true);
    expect(flashes.observe("a#port", 2, 16 + HIT_FLASH_MS)).toBe(false);
    flashes.retain(new Set(), (key) => key.split("#")[0]!);
    expect(flashes.observe("a#port", 1, 500)).toBe(false);
  });
});

describe("enemy SVGs", () => {
  it("finds every heavy SVG declared at its display size, its viewBox in frame px", () => {
    const heavies = (
      manifest.assets as (EnemyFrame & { height: number; path: string; width: number })[]
    ).filter(({ archetype }) => ["capital", "frigate", "platform"].includes(archetype ?? ""));
    // The coral, claim and garnet frigates and capitals, 384 frames each, and the claim
    // platform's 81.
    expect(heavies).toHaveLength(384 * 3 + 81);
    for (const asset of heavies) {
      const svg = readFileSync(new URL(`../../public${asset.path}`, import.meta.url), "utf8");
      const root = /<svg\b[^>]*>/u.exec(svg)?.[0] ?? "";
      const size = (name: string) =>
        Number(new RegExp(`\\b${name}="([\\d.]+)"`, "u").exec(root)?.[1]);
      expect([size("width"), size("height")], asset.path).toEqual([
        asset.displayWidth,
        asset.displayHeight,
      ]);
      expect(root, asset.path).toContain(`viewBox="0 0 ${asset.width} ${asset.height}"`);
    }
  });
});

describe("claim jumper art", () => {
  const sets = enemyFrameSets(assets, CLAIM);
  const claim = enemyArt(
    (archetype) => json(`/art/cartwheel/enemies/${archetype}-jets.json`),
    (archetype) => json(`/art/cartwheel/enemies/${archetype}-hardpoints.json`),
    composedArchetypes(assets.filter((asset) => asset.family === "claim")),
    assets,
    sets,
    CLAIM,
  );

  it("reads the claim family apart from the coral one, with ember jets", () => {
    expect([...sets.keys()].sort()).toEqual(
      ["capital", "fighter", "frigate", "interceptor", "platform", "retaliator", "swarm"].sort(),
    );
    for (const name of ["swarm", "fighter", "interceptor", "retaliator"]) {
      expect(sets.get(name)!.every((frame) => frame.id.startsWith(`enemy-claim-${name}-`))).toBe(
        true,
      );
      expect(claim.get(name)!.jets?.headings).toHaveLength(16);
    }
    expect(enemyFrameSets(assets).get("fighter")![0]!.id).toBe("enemy-fighter-0");
    expect(enemyFrameSets(assets).has("platform")).toBe(false);
  });

  it("draws the platform's one fixed hull for every facing, its turrets on heading 0", () => {
    const platform = claim.get("platform")!;
    expect(platform.frames.map((frame) => frame.id)).toEqual(["enemy-claim-platform"]);
    expect(platform.jets).toBeUndefined();
    const pose: PartPose = { aim: () => ({ x: 0, y: 1 }), intact: () => true };
    for (const degrees of [0, 90, 200, 315]) {
      const hull = selectEnemyFrame(platform, at(degrees));
      expect(hull.id).toBe("enemy-claim-platform");
      expect(hullHeading(platform, hull)).toBe(0);
      const sprites = composeEnemy(platform, pose, hull);
      expect(sprites.map((sprite) => sprite.frame.id).sort()).toEqual(
        [
          "enemy-claim-platform",
          "enemy-claim-platform-port-intact-0",
          "enemy-claim-platform-starboard-intact-0",
          `enemy-claim-platform-turret-top-${aimIndex({ x: 0, y: 1 })}`,
          `enemy-claim-platform-turret-top-${aimIndex({ x: 0, y: 1 })}`,
        ].sort(),
      );
      expect(turretMuzzles(platform, pose, hull, "port").length).toBeGreaterThan(0);
    }
    // Each turret aims on its own.
    const split: PartPose = {
      aim: (id) => (id === "port" ? { x: -1, y: 0 } : { x: 1, y: 0 }),
      intact: () => true,
    };
    const tops = composeEnemy(platform, split, platform.frames[0]!)
      .filter((sprite) => sprite.layer === "top")
      .map((sprite) => sprite.frame.id);
    expect(new Set(tops).size).toBe(2);
  });

  it("composes the claim frigate and capital, drawing a destroyed hardpoint's destroyed base", () => {
    expect([...CLAIM_WIRED].sort()).toEqual([...sets.keys()].sort());
    for (const name of ["frigate", "capital"]) {
      const art = claim.get(name)!;
      expect(art.frames).toHaveLength(16);
      expect(art.parts).toBeDefined();
      const hull = art.frames[3]!;
      const intact = composeEnemy(art, { aim: () => ({ x: 1, y: 0 }), intact: () => true }, hull);
      const wrecked = composeEnemy(art, { aim: () => ({ x: 1, y: 0 }), intact: () => false }, hull);
      const ids = (sprites: typeof intact) => sprites.map((sprite) => sprite.frame.id);
      expect(ids(intact).every((id) => id.startsWith(`enemy-claim-${name}`))).toBe(true);
      expect(ids(intact).some((id) => id.includes("-intact-"))).toBe(true);
      expect(ids(wrecked).some((id) => id.includes("-destroyed-"))).toBe(true);
      expect(ids(wrecked).some((id) => id.includes("-intact-"))).toBe(false);
    }
  });
});
