import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import archieHardpoints from "../../public/art/enemies/archie-hardpoints.json";
import archieJets from "../../public/art/enemies/archie-jets.json";
import capitalHardpoints from "../../public/art/enemies/fleetCapital-hardpoints.json";
import capitalJets from "../../public/art/enemies/fleetCapital-jets.json";
import fighterJets from "../../public/art/enemies/fleetFighter-jets.json";
import frigateHardpoints from "../../public/art/enemies/fleetFrigate-hardpoints.json";
import frigateJets from "../../public/art/enemies/fleetFrigate-jets.json";
import interceptorJets from "../../public/art/enemies/fleetInterceptor-jets.json";
import retaliatorJets from "../../public/art/enemies/fleetRetaliator-jets.json";
import swarmJets from "../../public/art/enemies/fleetSwarm-jets.json";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import { GALAXY_ID } from "../data/galaxies.ts";
import { enemySpeedFraction } from "../model/enemyAi.ts";
import { ART_MANIFEST as manifest, CORE_MANIFEST, GALAXY_MANIFESTS } from "../testing/publicArt.ts";
import {
  aimIndex,
  CLAIM,
  CLAIM_WIRED,
  composedArchetypes,
  composeEnemy,
  type EnemyArt,
  enemyArt,
  type EnemyFrame,
  enemyFrameKey,
  enemyFrameSets,
  enemyHardpointsPath,
  enemyJetsPath,
  enemyJetTriangles,
  enemyPartFrame,
  GALAXY_FAMILIES,
  galaxyFamily,
  HIT_FLASH_MS,
  HitFlashes,
  hullHeading,
  layoutTier,
  mountedTop,
  type PartPose,
  readHardpointLayout,
  readSidecars,
  selectEnemyFrame,
  turretMuzzles,
} from "./enemyArt.ts";
import { readEnemyJets, selectEnemyJetPalette } from "./enemyJetPalette.ts";
import { jetLength, readShipJets } from "./shipJets.ts";

const assets = manifest.assets as EnemyFrame[];
const json = (path: string | undefined): unknown => {
  const url = path && new URL(`../../public${path}`, import.meta.url);
  return url && existsSync(url) ? JSON.parse(readFileSync(url, "utf8")) : undefined;
};
// Each manifest's sidecars map, which names the jets and hardpoints files its crafts load.
const coreSidecars = readSidecars(CORE_MANIFEST.sidecars)!;
const galaxySidecars = new Map(
  [...GALAXY_MANIFESTS].map(([galaxy, { sidecars }]) => [GALAXY_ID[galaxy], sidecars]),
);
// The manifest that lists each entry, a galaxy's or the core's, whose sidecars name its files.
const ownerOf = new Map<string, string>([
  ...CORE_MANIFEST.assets.map(({ id }) => [id, "core"] as const),
  ...[...GALAXY_MANIFESTS].flatMap(([galaxy, { assets }]) =>
    assets.map(({ id }) => [id, GALAXY_ID[galaxy]] as const),
  ),
]);
function nativePartFrames(owner: string, archetype: string): number {
  const file = json(enemyHardpointsPath(galaxySidecars.get(owner) ?? coreSidecars, archetype)) as {
    hardpoints: { capped?: boolean; states: string[]; top: string | null }[];
    weaponTops?: Record<string, { top: string }>;
  };
  const tops = new Set([
    ...file.hardpoints.flatMap((part) => part.top ?? []),
    ...Object.values(file.weaponTops ?? {}).map(({ top }) => top),
  ]);
  const bases = file.hardpoints.reduce(
    (sum, part) => sum + part.states.length + (part.capped ? 1 : 0),
    0,
  );
  return (bases + tops.size) * 16;
}
const files: Record<string, unknown> = {
  archie: archieJets,
  capital: capitalJets,
  fighter: fighterJets,
  frigate: frigateJets,
  interceptor: interceptorJets,
  retaliator: retaliatorJets,
  swarm: swarmJets,
};
const layouts: Record<string, unknown> = {
  archie: archieHardpoints,
  capital: capitalHardpoints,
  frigate: frigateHardpoints,
};
const build = (
  frames: readonly EnemyFrame[],
  layout = (name: string) => layouts[name] ?? json(enemyHardpointsPath(coreSidecars, name)),
) =>
  enemyArt(
    (archetype) => files[archetype] ?? json(enemyJetsPath(coreSidecars, archetype)),
    layout,
    composedArchetypes(assets),
    frames,
    enemyFrameSets(frames),
  );
const art = build(assets);
const galaxy = (name: string) => art.get(name)!;
const at = (degrees: number) => ({
  x: Math.cos((degrees * Math.PI) / 180),
  y: Math.sin((degrees * Math.PI) / 180),
});

describe("enemy frame sets", () => {
  it("reads sixteen sized headings for each coral archetype from Art's manifest", () => {
    expect([...art.keys()].sort()).toEqual([
      "archie",
      "capital",
      "fighter",
      "frigate",
      "hostileStation",
      "interceptor",
      "retaliator",
      "retaliatorCargoHauler",
      "retaliatorMiningFreighter",
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
      archie: 245,
      capital: 231,
      fighter: 35,
      frigate: 150.5,
      hostileStation: 164.5,
      interceptor: 56,
      retaliator: 70,
      retaliatorCargoHauler: 122.5,
      retaliatorMiningFreighter: 77,
      swarm: 24.5,
    });
  });

  it("frames core roles and composed industrial craft while the platform stays in its family", () => {
    // The fixed platform belongs to the Claim family rather than the core frame set.
    expect(Object.keys(enemyCatalog).filter((name) => !art.has(name))).toEqual(["platform"]);
    expect(
      [...art]
        .filter(([, set]) => set.parts)
        .map(([name]) => name)
        .sort(),
    ).toEqual([
      "archie",
      "capital",
      "frigate",
      "hostileStation",
      "retaliator",
      "retaliatorCargoHauler",
      "retaliatorMiningFreighter",
    ]);
  });

  it("keeps Archie's flagship art without introducing a separate gameplay archetype", () => {
    const archie = art.get("archie")!;
    expect(archie.jets?.headings).toHaveLength(16);
    expect(archie.parts!.layout.frame).toBe(560);
    expect(archie.parts!.layout.fill).toEqual(capitalHardpoints.fill);
    expect(archie.parts!.layout.tiers).toEqual(art.get("capital")!.parts!.layout.tiers);
    expect(Object.keys(enemyCatalog)).not.toContain("archie");
  });

  it("tells the heavies' part frames, which load after the scene starts, from hull headings", () => {
    const parts = assets.filter(enemyPartFrame);
    // Each composed archetype of each family has 16 frames per hardpoint state, capped plate and
    // top design, as its hardpoints file and tiers list them.
    const sets = new Set(parts.map((asset) => `${ownerOf.get(asset.id)}|${enemyFrameKey(asset)}`));
    const expected = [...sets].reduce((sum, key) => {
      const [owner, archetype] = key.split("|") as [string, string];
      return sum + nativePartFrames(owner, archetype);
    }, 0);
    expect(parts).toHaveLength(expected);
    expect(parts.some((asset) => /^enemy-[a-z]+-\d+$/i.test(asset.id))).toBe(false);
  });

  it("keeps hardpoint bases and turret tops out of the hull heading sets", () => {
    for (const set of art.values()) {
      expect(set.frames.every((frame) => /^enemy-[a-z]+-\d+$/i.test(frame.id))).toBe(true);
    }
  });

  it("finds each archetype's data files in the core sidecars map", () => {
    const sidecars = readSidecars(CORE_MANIFEST.sidecars)!;
    expect(enemyJetsPath(sidecars, "fighter")).toBe("/art/enemies/fleetFighter-jets.json");
    expect(enemyHardpointsPath(sidecars, "capital")).toBe(
      "/art/enemies/fleetCapital-hardpoints.json",
    );
    expect(enemyHardpointsPath(sidecars, "fighter")).toBeUndefined();
  });
});

describe("enemy frame selection", () => {
  it.each([0, 1, 4, 8, 12, 15])("draws heading %i at its exact world angle", (index) => {
    expect(selectEnemyFrame(galaxy("fighter"), at(index * 22.5)).directionIndex).toBe(index);
  });

  it("draws the nearest of sixteen headings for a continuous facing", () => {
    const set = galaxy("swarm");
    expect(selectEnemyFrame(set, at(11)).id).toBe("enemy-swarm-0");
    expect(selectEnemyFrame(set, at(12)).id).toBe("enemy-swarm-1");
    expect(selectEnemyFrame(set, at(-11)).id).toBe("enemy-swarm-0");
    expect(selectEnemyFrame(set, at(-12)).id).toBe("enemy-swarm-15");
    // A new hull faces up, world angle -90 degrees.
    expect(selectEnemyFrame(set, { x: 0, y: -1 }).id).toBe("enemy-swarm-12");
  });
});

describe("enemy jets", () => {
  const claimColors = [
    ["#010203", "#040506"],
    ["#070809", "#0a0b0c"],
  ];
  const sharedFighter = { ...fighterJets, familyColors: { claim: claimColors } };

  it("selects the named family ramps while retaining geometry and the Coral base", () => {
    expect(selectEnemyJetPalette("claim", sharedFighter)).toEqual({
      core: claimColors[1],
      outer: claimColors[0],
    });
    expect(readEnemyJets("claim", sharedFighter)).toEqual(
      readShipJets({
        ...fighterJets,
        layers: fighterJets.layers.map((layer, index) => ({
          ...layer,
          colors: claimColors[index],
        })),
      }),
    );
    expect(readEnemyJets("coral", sharedFighter)).toEqual(readShipJets(fighterJets));
    const legacy = { ...fighterJets };
    Reflect.deleteProperty(legacy, "familyColors");
    expect(readEnemyJets("claim", legacy)).toEqual(readShipJets(legacy));
  });

  it.each([
    undefined,
    null,
    { claim: [["#010203", "#040506"]] },
    {
      claim: [
        ["#010203", "#040506"],
        ["#070809", "not-a-color"],
      ],
    },
    { garnet: claimColors },
    { claim: claimColors, unknown: claimColors },
  ])("rejects an invalid or absent selected palette without painting Coral", (familyColors) => {
    expect(readEnemyJets("claim", { ...sharedFighter, familyColors })).toBeUndefined();
  });

  it("requires the packed sidecar's named outer/core layers and a known family", () => {
    expect(selectEnemyJetPalette("unknown", sharedFighter)).toBeUndefined();
    expect(
      readEnemyJets("claim", { ...sharedFighter, layers: [...fighterJets.layers].reverse() }),
    ).toBeUndefined();
    expect(
      readEnemyJets("claim", {
        ...sharedFighter,
        layers: fighterJets.layers.map((layer) => ({ ...layer, color: "#ffffff" })),
      }),
    ).toBeUndefined();
  });

  it.each([
    ["swarm", 1, 56],
    ["fighter", 2, 80],
    ["interceptor", 1, 128],
    ["retaliator", 3, 160],
    ["frigate", 2, 344],
    ["capital", 2, 528],
  ] as const)("draws %s with %i mouths of two haloless layers", (name, mouths, frame) => {
    const set = galaxy(name);
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
      const set = galaxy(name);
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
    const set = galaxy("fighter");
    const frame = set.frames[0]!;
    const definition = enemyCatalog.fighter;
    const maxSpeed = definition.physics.maxSpeed;
    const fraction = (speed: number) =>
      enemySpeedFraction(definition, {
        velocity: { x: 0, y: speed },
      });
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
    const noTop = assets.filter((asset) => asset.id !== "enemy-capital-lance-top-9");
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

  it("reads a mount heavy's fill, tiers and Disabled banner centres", () => {
    const layout = readHardpointLayout("frigate", frigateHardpoints)!;
    expect(layout.fill).toEqual(["port", "starboard", "spine", "bow"]);
    expect(layout.tiers.map((tier) => tier.positions)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    expect(layout.tiers[0]!.mounts.get("spine")).toBe(false);
    expect(layout.tiers[2]!.mounts.get("bow")).toBe(true);
    expect(layout.weaponTops.get("heavyMissile")).toEqual({ aim: "target", top: "rail" });
    expect(layout.hardpoints.filter((part) => part.capped).map((part) => part.id)).toEqual([
      "spine",
      "bow",
    ]);
    expect(layout.headings[5]!.banner).toEqual({
      x: frigateHardpoints.headings[5]!.banner[0],
      y: frigateHardpoints.headings[5]!.banner[1],
    });
    expect([...layout.tops.keys()].sort()).toEqual(["gun", "rail"]);
  });

  it("rejects tiers that miss a mount or cap one without plates, and an unknown top aim", () => {
    const copy = () => JSON.parse(JSON.stringify(frigateHardpoints)) as typeof frigateHardpoints;
    const missing = copy();
    delete (missing.tiers[1]!.mounts as Record<string, unknown>).bow;
    expect(readHardpointLayout("frigate", missing)).toBeUndefined();
    const uncapped = copy();
    (uncapped.tiers[0]!.mounts as Record<string, unknown>).port = null;
    expect(readHardpointLayout("frigate", uncapped)).toBeUndefined();
    const aim = copy();
    aim.weaponTops.heavyMissile = { ...aim.weaponTops.heavyMissile, aim: "up" };
    expect(readHardpointLayout("frigate", aim)).toBeUndefined();
    const unarmed = copy();
    (unarmed.tiers[2]!.mounts as Record<string, unknown>).bow = { armed: false };
    expect(readHardpointLayout("frigate", unarmed)).toBeUndefined();
    const untopped = copy();
    delete (untopped as { weaponTops?: unknown }).weaponTops;
    expect(readHardpointLayout("frigate", untopped)).toBeUndefined();
    const fillOnly = copy();
    delete (fillOnly as { tiers?: unknown }).tiers;
    expect(readHardpointLayout("frigate", fillOnly)).toBeUndefined();
    const banner = copy();
    (banner.headings[2] as { banner: unknown }).banner = [1];
    expect(readHardpointLayout("frigate", banner)).toBeUndefined();
    const noLanceAims = copy();
    noLanceAims.tops.rail = noLanceAims.tops.rail.slice(0, 15);
    expect(readHardpointLayout("frigate", noLanceAims)).toBeUndefined();
  });

  it("picks the tier holding the route position, past the last tier the last one", () => {
    const layout = readHardpointLayout("capital", capitalHardpoints)!;
    const positions = (position: number) => layoutTier(layout, position)?.positions;
    expect([1, 2, 3, 4, 5, 6, 7].map(positions)).toEqual([
      [1, 2],
      [1, 2],
      [3, 4],
      [3, 4],
      [5, 6],
      [5, 6],
      [5, 6],
    ]);
    expect(layoutTier({ tiers: [] }, 3)).toBeUndefined();
  });
});

const world = (degrees: number) => at(degrees);
/** A loadout for every frigate and capital mount; a heavy's tops follow its weapons. */
const LOADOUT: Readonly<Record<string, string>> = {
  bow: "laser",
  "claw-left": "scattershot",
  "claw-right": "scattershot",
  port: "heavyMissile",
  spine: "laser",
  starboard: "laser",
  "stern-left": "scattershot",
  "stern-right": "scattershot",
  "weapon-left": "chargedLance",
  "weapon-rear-left": "scattershot",
  "weapon-rear-right": "scattershot",
  "weapon-right": "scattershot",
};
const MINE_LOADOUT = { ...LOADOUT, "stern-right": "mineLayer", "weapon-left": "scattershot" };
const pose = (
  destroyed: readonly string[] = [],
  aim = world(0),
  position = 1,
  weapons: Readonly<Record<string, string>> = LOADOUT,
): PartPose => ({
  aim: () => aim,
  intact: (hardpoint) => !destroyed.includes(hardpoint),
  position,
  weapon: (hardpoint) => weapons[hardpoint],
});

describe("composed heavies", () => {
  const frigate = galaxy("frigate");
  const capital = galaxy("capital");

  it.each([2, 6, 10, 14])("draws frigate heading %i in its layer order", (heading) => {
    const hull = frigate.frames[heading]!;
    const layout = frigateHardpoints.headings[heading]!;
    // Every hardpoint's base in the heading's order, with each armed mount's top straight after
    // it; positions 1 to 2 cap the spine and bow, 3 to 4 the bow, and 5 to 6 arm every mount.
    for (const [position, capped] of [
      [1, ["spine", "bow"]],
      [3, ["bow"]],
      [5, []],
    ] as const) {
      const sprites = composeEnemy(frigate, pose([], world(0), position), hull);
      // The engine and the fixed front Laser carry no top, nor does a capped mount.
      const fixed = frigateHardpoints.hardpoints.flatMap((part) =>
        "aim" in part && part.aim === "facing" ? [part.id] : [],
      );
      const plain = (id: string) =>
        id === "engine" || fixed.includes(id) || (capped as readonly string[]).includes(id);
      const expected = layout.order.flatMap((id) =>
        id === "hull" ? ["hull"] : plain(id) ? [`${id}:base`] : [`${id}:base`, `${id}:top`],
      );
      expect(
        sprites.map((part) => (part.hardpoint ? `${part.hardpoint}:${part.layer}` : "hull")),
      ).toEqual(expected);
      for (const id of capped) {
        expect(sprites.find((part) => part.hardpoint === id)!.frame.id).toBe(
          `enemy-frigate-${id}-capped-${heading}`,
        );
      }
      expect(sprites.find((part) => part.hardpoint === null)!.frame.id).toBe(
        `enemy-frigate-${heading}`,
      );
    }
  });

  it("centres each base on its anchor and each top on its pivot, in display px", () => {
    const hull = capital.frames[4]!;
    const scale = hull.displayWidth! / capitalHardpoints.frame;
    const placed = capitalHardpoints.headings[4]!.hardpoints.find(
      (part) => part.id === "weapon-left",
    )!;
    const sprites = composeEnemy(capital, pose(), hull);
    const base = sprites.find((part) => part.hardpoint === "weapon-left" && part.layer === "base")!;
    const top = sprites.find((part) => part.hardpoint === "weapon-left" && part.layer === "top")!;
    expect(base.frame.id).toBe("enemy-capital-weapon-left-intact-4");
    expect(base.offset.x).toBeCloseTo((placed.anchor[0]! - capitalHardpoints.frame / 2) * scale, 9);
    expect(base.offset.y).toBeCloseTo((placed.anchor[1]! - capitalHardpoints.frame / 2) * scale, 9);
    expect(top.offset.y).toBeCloseTo((placed.pivot![1]! - capitalHardpoints.frame / 2) * scale, 9);
  });

  it("aims each top by world angle, whatever the hull heading", () => {
    expect(aimIndex(world(0))).toBe(0);
    expect(aimIndex(world(22.5 * 5))).toBe(5);
    expect(aimIndex(world(-22.5))).toBe(15);
    for (const heading of [0, 7, 12]) {
      const sprites = composeEnemy(capital, pose([], world(22.5 * 9)), capital.frames[heading]!);
      // An armed mount the hull hides at this heading draws no top.
      const hidden = new Set(
        capitalHardpoints.headings[heading]!.hardpoints.flatMap((part) =>
          "hidden" in part && part.hidden ? [part.id] : [],
        ),
      );
      const armed = sprites.filter(
        (part) =>
          part.layer === "base" &&
          capitalHardpoints.fill.includes(part.hardpoint ?? "") &&
          part.frame.id.includes("-intact-"),
      );
      const tops = sprites.filter((part) => part.layer === "top");
      expect(armed).toHaveLength(4);
      expect(tops.map((part) => part.hardpoint).sort()).toEqual(
        armed
          .map((part) => part.hardpoint)
          .filter((id) => !hidden.has(id!))
          .sort(),
      );
      expect(
        tops.every((part) => /^enemy-capital-(lance|spread)-top-9$/u.test(part.frame.id)),
      ).toBe(true);
    }
  });

  it("draws each tier's tops, the mine layer's hopper held aft of the hull heading", () => {
    for (const heading of [0, 5, 12]) {
      const sprites = composeEnemy(
        capital,
        pose([], world(22.5 * 9), 5, MINE_LOADOUT),
        capital.frames[heading]!,
      );
      const top = (id: string) =>
        sprites.find((part) => part.hardpoint === id && part.layer === "top")?.frame.id;
      expect(Object.fromEntries(capitalHardpoints.fill.map((id) => [id, top(id)]))).toEqual({
        "claw-left": "enemy-capital-spread-top-9",
        "claw-right": "enemy-capital-spread-top-9",
        "stern-left": "enemy-capital-spread-top-9",
        "stern-right": `enemy-capital-hopper-top-${(heading + 8) % 16}`,
        "weapon-left": "enemy-capital-spread-top-9",
        "weapon-rear-left": "enemy-capital-spread-top-9",
        "weapon-rear-right": "enemy-capital-spread-top-9",
        "weapon-right": "enemy-capital-spread-top-9",
      });
    }
    // A capped plate never draws a top, whatever its hardpoint state.
    const sprites = composeEnemy(capital, pose(["claw-left"], world(0), 1), capital.frames[3]!);
    expect(
      sprites.filter((part) => part.hardpoint === "claw-left").map((part) => part.frame.id),
    ).toEqual(["enemy-capital-claw-left-capped-3"]);
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
    const scale = hull.displayWidth! / capitalHardpoints.frame;
    const pivot = capitalHardpoints.headings[2]!.hardpoints.find(
      (part) => part.id === "weapon-right",
    )!.pivot!;
    const muzzles = capitalHardpoints.tops.spread[3]!.muzzles;
    const triple = pose([], world(22.5 * 3), 1, { "weapon-right": "scattershot" });
    const tips = turretMuzzles(capital, triple, hull, "weapon-right");
    expect(tips).toHaveLength(5);
    expect(tips[1]!.x).toBeCloseTo(
      (pivot[0]! + muzzles[1]![0]! - capitalHardpoints.frame / 2) * scale,
      9,
    );
    expect(tips[1]!.y).toBeCloseTo(
      (pivot[1]! + muzzles[1]![1]! - capitalHardpoints.frame / 2) * scale,
      9,
    );
    expect(turretMuzzles(capital, pose(["weapon-right"]), hull, "weapon-right")).toEqual([]);
    expect(turretMuzzles(capital, pose(), hull, "command")).toEqual([]);
    // Tier tops: the claw's capped plate has none, the rear mount's pod has its own.
    expect(turretMuzzles(capital, pose(), hull, "claw-left")).toEqual([]);
    const pod = capitalHardpoints.tops.hopper[3]!.muzzles;
    const rear = turretMuzzles(
      capital,
      pose([], world(22.5 * 3), 5, { "weapon-rear-left": "mineLayer" }),
      hull,
      "weapon-rear-left",
    );
    expect(rear).toHaveLength(pod.length);
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
    const hull = galaxy("retaliator").frames[0]!;
    const top = { ...hull, aimIndex: 0, top: "gun" };
    const tops = Array.from({ length: 16 }, (_, index) => ({
      ...top,
      aimIndex: index,
      id: `top-${index}`,
    }));
    const mounted: EnemyArt = {
      ...galaxy("retaliator"),
      parts: {
        bases: new Map([["turret", new Map()]]),
        layout: {
          fill: [],
          frame: 192,
          hardpoints: [{ capped: false, id: "turret", role: "turret", states: [], top: "gun" }],
          headings: Array.from({ length: 16 }, () => ({
            order: ["hull", "turret"],
            parts: new Map([["turret", { anchor: { x: 96, y: 96 }, pivot: { x: 96, y: 90 } }]]),
          })),
          tiers: [],
          tops: new Map([["gun", Array.from({ length: 16 }, () => [{ x: 0, y: 10 }])]]),
          weaponTops: new Map(),
        },
        tops: new Map([["gun", tops]]),
      },
    };
    const sprites = composeEnemy(mounted, pose([], world(22.5 * 4)), hull);
    expect(sprites.map((part) => part.frame.id)).toEqual(["enemy-retaliator-0", "top-4"]);
    // The pivot's 6 frame px above the anchor, at the hull's display px per layout frame px.
    expect(sprites[1]!.offset.y).toBeCloseTo(-6 * (hull.displayWidth! / 192), 9);
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
  it("reads composed SVG dimensions and the fleet sheets' frame-px roots with exact raw viewBoxes", () => {
    const composed = new Set([
      "archie",
      "capital",
      "frigate",
      "frigateTwin",
      "hostileStation",
      "platform",
      "retaliator",
      "retaliatorCargoHauler",
      "retaliatorMiningFreighter",
    ]);
    const heavies = (
      manifest.assets as (EnemyFrame & {
        height: number;
        path: string;
        svgSheet?: boolean;
        svgSheetMember?: string;
        width: number;
      })[]
    ).filter((asset) => composed.has(enemyFrameKey(asset) ?? ""));
    const groups = new Map<string, { owner: string; archetype: string }>();
    for (const asset of heavies) {
      const owner = ownerOf.get(asset.id)!;
      const archetype = enemyFrameKey(asset)!;
      groups.set(`${owner}|${archetype}`, { archetype, owner });
    }
    const expected = [...groups.values()].reduce(
      (sum, { archetype, owner }) => sum + nativePartFrames(owner, archetype) + 16,
      0,
    );
    expect(heavies).toHaveLength(expected);
    for (const asset of heavies) {
      const svg = readFileSync(new URL(`../../public${asset.path}`, import.meta.url), "utf8");
      const [outer, ...members] = Array.from(svg.matchAll(/<svg\b[^>]*>/gu), ([tag]) => tag);
      const member = asset.svgSheetMember ?? asset.id;
      const roots = asset.svgSheet
        ? members.filter((tag) => /\sid="([^"]+)"/u.exec(tag)?.[1] === member)
        : [outer];
      expect(roots, asset.id).toHaveLength(1);
      const root = roots[0] ?? "";
      const size = (name: string) =>
        Number(new RegExp(`\\b${name}="([\\d.]+)"`, "u").exec(root)?.[1]);
      // The fleet producer's sheets, hulls and parts alike, and Art's model-layer hostile station
      // and platform hulls and bases size each root in frame px.
      const framePx =
        /\/fleet[A-Z][^/]*$/u.test(asset.path) ||
        ((asset.archetype === "hostileStation" || asset.archetype === "platform") &&
          asset.top === undefined);
      expect([size("width"), size("height")], asset.path).toEqual(
        framePx ? [asset.width, asset.height] : [asset.displayWidth, asset.displayHeight],
      );
      expect(root, asset.path).toContain(`viewBox="0 0 ${asset.width} ${asset.height}"`);
    }
  });
});

describe("claim jumper art", () => {
  const sets = enemyFrameSets(assets, CLAIM);
  const claim = enemyArt(
    (archetype) => json(enemyJetsPath(galaxySidecars.get("cartwheel")!, archetype)),
    (archetype) => json(enemyHardpointsPath(galaxySidecars.get("cartwheel")!, archetype)),
    composedArchetypes(assets.filter((asset) => asset.family === "claim")),
    assets,
    sets,
    CLAIM,
    "claim",
  );

  it("reads the claim family apart from the coral one, with ember jets", () => {
    expect([...sets.keys()].sort()).toEqual(
      [
        "capital",
        "fighter",
        "frigate",
        "hostileStation",
        "interceptor",
        "platform",
        "retaliator",
        "retaliatorCargoHauler",
        "retaliatorMiningFreighter",
        "swarm",
      ].sort(),
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

  it("turns the platform's hull with its heading, its mounts at that heading's anchors", () => {
    const platform = claim.get("platform")!;
    expect(platform.frames.map((frame) => frame.id)).toEqual(
      Array.from({ length: 16 }, (_, index) => `enemy-claim-platform-${index}`),
    );
    expect(platform.jets).toBeUndefined();
    const pose: PartPose = {
      aim: () => ({ x: 0, y: 1 }),
      intact: () => true,
      position: 5,
      weapon: () => "laser",
    };
    for (const degrees of [0, 90, 202.5, 315]) {
      const hull = selectEnemyFrame(platform, at(degrees));
      const heading = Math.round(degrees / 22.5) % 16;
      expect(hull.id).toBe(`enemy-claim-platform-${heading}`);
      expect(hullHeading(platform, hull)).toBe(heading);
      const sprites = composeEnemy(platform, pose, hull);
      expect(sprites.map((sprite) => sprite.frame.id).sort()).toEqual(
        [
          `enemy-claim-platform-${heading}`,
          `enemy-claim-platform-aft-capped-${heading}`,
          `enemy-claim-platform-port-intact-${heading}`,
          `enemy-claim-platform-starboard-intact-${heading}`,
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
      position: 5,
      weapon: () => "laser",
    };
    const tops = composeEnemy(platform, split, platform.frames[0]!)
      .filter((sprite) => sprite.layer === "top")
      .map((sprite) => sprite.frame.id);
    expect(new Set(tops).size).toBe(2);
  });

  it("draws no top on a mount the hull hides at a heading, which still fires", () => {
    const station = galaxy("hostileStation");
    const file = json(enemyHardpointsPath(coreSidecars, "hostileStation")) as {
      headings: { hardpoints: { hidden?: boolean; id: string }[]; index: number }[];
    };
    const hidden = file.headings.flatMap(({ hardpoints, index }) =>
      hardpoints.filter((part) => part.hidden).map(({ id }) => ({ id, index })),
    );
    expect(hidden.length).toBeGreaterThan(0);
    const pose: PartPose = {
      aim: () => ({ x: 1, y: 0 }),
      intact: () => true,
      position: 5,
      weapon: () => "laser",
    };
    for (const { id, index } of hidden) {
      const hull = station.frames[index]!;
      const sprites = composeEnemy(station, pose, hull).filter((part) => part.hardpoint === id);
      expect(sprites.map(({ layer }) => layer)).not.toContain("top");
      const shown = mountedTop(station.parts!.layout, pose.position, id, "laser");
      if (shown !== "capped" && shown.top) {
        expect(turretMuzzles(station, pose, hull, id).length).toBeGreaterThan(0);
      }
    }
  });

  it("composes the claim frigate and capital, drawing a destroyed hardpoint's destroyed base", () => {
    expect([...sets.keys()].sort()).toEqual([...CLAIM_WIRED].sort());
    for (const name of ["frigate", "capital"]) {
      const art = claim.get(name)!;
      expect(art.frames).toHaveLength(16);
      expect(art.parts).toBeDefined();
      const hull = art.frames[3]!;
      const live = pose([], { x: 1, y: 0 }, 5);
      const intact = composeEnemy(art, live, hull);
      const wrecked = composeEnemy(art, { ...live, intact: () => false }, hull);
      const ids = (sprites: typeof intact) => sprites.map((sprite) => sprite.frame.id);
      expect(ids(intact).every((id) => id.startsWith(`enemy-claim-${name}`))).toBe(true);
      expect(ids(intact).some((id) => id.includes("-intact-"))).toBe(true);
      expect(ids(wrecked).some((id) => id.includes("-destroyed-"))).toBe(true);
      expect(ids(wrecked).some((id) => id.includes("-intact-"))).toBe(false);
    }
  });
});

describe("galaxy enemy families", () => {
  it("draws Cartwheel's claim jumpers and Andromeda's garnet drones, else Archie's coral", () => {
    expect(galaxyFamily("cartwheel", "platform")?.family).toBe("claim");
    expect(galaxyFamily("andromeda", "swarm")?.family).toBe("garnet");
    expect(galaxyFamily("needle", "capital")?.family).toBe("needle");
    // Andromeda has no garnet platform, and the other galaxies fly the coral family.
    expect(galaxyFamily("andromeda", "platform")).toBeUndefined();
    expect(galaxyFamily("sunflower", "swarm")).toBeUndefined();
    expect(galaxyFamily(undefined, "swarm")).toBeUndefined();
  });

  it("finds every garnet archetype's full frame set in Andromeda's manifest", () => {
    const garnet = GALAXY_FAMILIES.find(({ family }) => family === "garnet")!;
    const assets = (manifest.assets as unknown as (EnemyFrame & { family?: string })[]).filter(
      (asset) => asset.family === "garnet",
    );
    expect([...enemyFrameSets(assets, garnet.prefix).keys()].sort()).toEqual(
      [...garnet.wired].sort(),
    );
  });
});

it.each([
  [undefined, ["capital", "frigate"]],
  ["cartwheel", ["capital", "frigate"]],
  ["andromeda", ["capital", "frigate"]],
  ["needle", ["capital", "frigate"]],
  ["whirlpool", ["capitalManta", "frigateTwin"]],
  ["phantom", ["capitalForked"]],
] as const)("composes every frigate and capital design %s flies", (galaxy, keys) => {
  // A family's own class rows are its design; a coral galaxy's designs are its own keys.
  const family = galaxyFamily(galaxy, "capital");
  const own = assets.filter((frame) => frame.family === family?.family);
  const sidecars = (galaxy && galaxySidecars.get(galaxy)) || coreSidecars;
  const art = enemyArt(
    (key) => json(enemyJetsPath(sidecars, key)),
    (key) => json(enemyHardpointsPath(sidecars, key)),
    composedArchetypes(own),
    own,
    enemyFrameSets(own, family?.prefix),
    family?.prefix,
    family?.family,
  );
  for (const key of keys) {
    const design = art.get(key);
    expect(design?.frames, key).toHaveLength(16);
    expect(design?.jets?.headings, key).toHaveLength(16);
    expect(design?.parts?.layout.headings, key).toHaveLength(16);
    expect(
      design?.parts?.bases.get("engine") ?? design?.parts?.bases.get("engine-left"),
    ).toBeDefined();
  }
});
