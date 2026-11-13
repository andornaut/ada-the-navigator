import { beforeEach, describe, expect, it, vi } from "vitest";

import phantomManifest from "../../public/art/phantom/manifest.json";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { createEnemy } from "../model/enemyAi.ts";
import type { SpaceObject } from "../model/types.ts";
import type { ObjectsContext } from "./sceneObjects.ts";
import { drawPhantomFlagship, drawPhantomSettlement, phantomAllyCraft } from "./scenePhantom.ts";
const calls = vi.hoisted(() => ({
  enemy: vi.fn(),
  family: vi.fn(),
  outpost: vi.fn(),
  parts: vi.fn(),
}));
vi.mock("./sceneObjects.ts", () => ({ drawOutpost: calls.outpost, drawWhale: vi.fn() }));
vi.mock("./sceneEnemies.ts", () => ({ drawEnemySprite: calls.enemy }));
vi.mock("./sceneAssets.ts", () => ({ familyArt: calls.family, loadEnemyParts: calls.parts }));
vi.mock("./sceneSprites.ts", () => ({ objectSprite: vi.fn() }));
function scene(complete = false): ObjectsContext {
  return {
    model: { state: { flight: { galaxy: 6 }, progress: { 6: { questComplete: complete } } } },
    project: (at: { x: number; y: number }) => at,
    shipAssets: phantomManifest.assets,
    textures: { exists: () => true },
  } as unknown as ObjectsContext;
}
beforeEach(() => vi.clearAllMocks());
describe("Phantom authored rendering", () => {
  it("uses matching craft and leaves missing ally artwork explicit", () => {
    expect(phantomAllyCraft({ galaxy: 4, id: "reed" })).toBe("glider");
    expect(phantomAllyCraft({ galaxy: 5, id: "pip" })).toBe("pip");
    expect(phantomAllyCraft({ galaxy: 2, id: "mica" })).toBe("miner");
    expect(phantomAllyCraft({ galaxy: 1, id: "clover" })).toBeUndefined();
    expect(phantomAllyCraft({ galaxy: 3, id: "project:3:currentMapBuoys" })).toBeUndefined();
  });
  it("uses the actual settlement's cracked frames until completion and its matching mended frames after", () => {
    for (const [index, variant] of ["homes", "harbour", "signal"].entries()) {
      const object: SpaceObject = {
        hp: 1,
        id: `phantomSettlement${index + 1}`,
        kind: "destination",
        radius: 30,
        x: 0,
        y: 0,
      };
      expect(drawPhantomSettlement(scene(), object)).toBe(true);
      const cracked = calls.outpost.mock.lastCall![1];
      expect(cracked.frames.map((frame: { id: string }) => frame.id)).toEqual([
        `outpost-${variant}-cracked-a`,
        `outpost-${variant}-cracked-b`,
      ]);
      expect(drawPhantomSettlement(scene(true), object)).toBe(true);
      const mended = calls.outpost.mock.lastCall![1];
      expect(mended.frames.map((frame: { id: string }) => frame.id)).toEqual([
        `outpost-${variant}-mended-a`,
        `outpost-${variant}-mended-b`,
      ]);
      expect(mended.frames[0].pivot).toEqual(cracked.frames[0].pivot);
    }
  });
  it("requests Gadget's own heavy art and lights the salvaged hulk without changing its gameplay state", () => {
    const definition = enemyDefinition(6, "capital", PHANTOM_FLAGSHIP);
    const enemy = createEnemy(
      definition,
      { archetype: "capital", id: PHANTOM_FLAGSHIP, packId: null, phase: 0 },
      { x: 0, y: 0 },
    );
    enemy.disabled = true;
    enemy.salvaged = true;
    enemy.hp = 1;
    const object: SpaceObject = {
      enemy,
      hp: 1,
      id: PHANTOM_FLAGSHIP,
      kind: "enemy",
      radius: 50,
      x: 0,
      y: 0,
    };
    const art = { frames: [], parts: {} };
    calls.family.mockReturnValue(art);
    const before = structuredClone(object);
    expect(drawPhantomFlagship(scene(true), object)).toBe(true);
    expect(calls.parts).toHaveBeenCalledWith(expect.anything(), "gadget");
    expect(calls.enemy.mock.lastCall![1]).toBe(art);
    expect(calls.enemy.mock.lastCall![4]).toMatchObject({ disabled: false, salvaged: false });
    expect(object).toEqual(before);
  });
  it("retains the normal renderer until the flagship's complete hardpoint artwork is ready", () => {
    const enemy = createEnemy(
      enemyDefinition(6, "capital", PHANTOM_FLAGSHIP),
      { archetype: "capital", id: PHANTOM_FLAGSHIP, packId: null, phase: 0 },
      { x: 0, y: 0 },
    );
    calls.family.mockReturnValue({ frames: [] });
    expect(
      drawPhantomFlagship(scene(), {
        enemy,
        hp: 160,
        id: PHANTOM_FLAGSHIP,
        kind: "enemy",
        radius: 50,
        x: 0,
        y: 0,
      }),
    ).toBe(false);
    expect(calls.enemy).not.toHaveBeenCalled();
  });
});
