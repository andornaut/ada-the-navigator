import { beforeEach, describe, expect, it, vi } from "vitest";

import phantomAllies from "../../public/art/phantom/allies.json";
import phantomManifest from "../../public/art/phantom/manifest.json";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { galaxyProjects } from "../data/projects.ts";
import { toScreen } from "../model/convex.ts";
import { createEnemy } from "../model/enemyAi.ts";
import type { PhantomDeparture } from "../model/phantom.ts";
import { phantomAllyRoster, rotatePhantomAllies } from "../model/phantomAllies.ts";
import { projectAllies } from "../model/projects.ts";
import type { SpaceObject } from "../model/types.ts";
import { finaleAllyCraft, readPhantomAllyArt } from "./phantomAllyArt.ts";
import type { ObjectsContext } from "./sceneObjects.ts";
import {
  drawPhantomAllies,
  drawPhantomFlagship,
  drawPhantomSettlement,
  phantomAllyCraft,
} from "./scenePhantom.ts";
import { clearPhantomSong } from "./scenePhantomSong.ts";
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
vi.mock("./sceneHud.ts", () => ({ drawCraftJets: vi.fn(), keylineSprite: vi.fn() }));
function scene(complete = false): ObjectsContext {
  return {
    galaxyManifests: new Map([[6, phantomManifest]]),
    model: { state: { flight: { galaxy: 6 }, progress: { 6: { questComplete: complete } } } },
    project: (at: { x: number; y: number }) => at,
    shipAssets: [],
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
  it("rotates the three new funded escorts with real authored craft and preserves Marlo", () => {
    const roster = phantomAllyRoster(
      ([1, 3, 4, 5, 2] as const).map((galaxy) => {
        const projects = galaxyProjects(galaxy);
        return {
          activityCompleted: true,
          galaxy,
          projects: projectAllies(projects, {
            donated: Object.fromEntries(projects.map(({ cost, id }) => [id, cost])),
            resolved: true,
            revealed: [],
          }),
        };
      }),
      21,
    );
    const formation = { facing: { x: 0, y: -1 }, player: { x: 0, y: 0 } };
    const rotations = [0, 1, 2].flatMap((turn) => rotatePhantomAllies(roster, turn, formation));
    const art = readPhantomAllyArt(phantomAllies);
    for (const [id, craft] of [
      ["project:3:quietCrossing", "voronguide"],
      ["project:4:practiceBerth", "avipracticeglider"],
      ["project:5:routeExchange", "courierrunner"],
    ]) {
      expect(roster.filter((entry) => entry.id === id)).toHaveLength(1);
      const ally = rotations.find((entry) => entry.id === id);
      expect(ally?.behavior).toBe("escort");
      expect(finaleAllyCraft(art, ally!)).toBe(craft);
      expect(
        phantomManifest.assets.filter(({ id: asset }) => asset.startsWith(`craft-${craft}-`)),
      ).toHaveLength(16);
    }
    expect(rotations.find(({ id }) => id === "marlo")).toMatchObject({
      behavior: "whale",
      song: true,
    });
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
  it("requests Archie's own heavy art and lights the salvaged hulk without changing its gameplay state", () => {
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
    expect(calls.parts).toHaveBeenCalledWith(expect.anything(), "archie");
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

function songGraphics() {
  return {
    beginPath: vi.fn(),
    clear() {
      this.lineBetween.mockClear();
      this.moveTo.mockClear();
    },
    closePath: vi.fn(),
    fillPath: vi.fn(),
    fillStyle: vi.fn(),
    lineBetween: vi.fn(),
    lineStyle: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    setDepth() {
      return this;
    },
    strokePath: vi.fn(),
  };
}

describe("Phantom song rendering", () => {
  it.each([false, true])(
    "draws the active nursery reach and rings with reduced motion=%s",
    (reducedMotion) => {
      const roster = phantomAllyRoster(
        [
          {
            activityCompleted: true,
            galaxy: 3,
            projects: [{ ally: "current", project: "nurseryBeacon" }],
          },
        ],
        21,
      );
      const player = { x: 40, y: 80 };
      const allies = rotatePhantomAllies(roster, 0, { facing: { x: 0, y: -1 }, player });
      const marlo = allies.find(({ id }) => id === "marlo")!;
      const nursery = allies.find(({ id }) => id === "project:3:nurseryBeacon")!;
      for (const ally of allies) {
        ally.jumpAge = 10;
      }
      const drone = (distance: number, disabled = false): SpaceObject => {
        const id = `song-drone:${distance}`;
        const point = { x: marlo.x + distance, y: marlo.y };
        const definition = enemyDefinition(6, "swarm", id);
        const enemy = createEnemy(
          definition,
          { archetype: "swarm", id, packId: null, phase: 0 },
          point,
        );
        enemy.disabled = disabled;
        return { ...point, enemy, hp: definition.hp, id, kind: "enemy", radius: 10 };
      };
      const departures: PhantomDeparture[] = [
        { age: 10, id: nursery.id, x: nursery.x, y: nursery.y },
      ];
      const phantom = { allies, allyTurn: 0, departures };
      const flight = {
        galaxy: 6,
        objects: [drone(450), drone(451), drone(200, true)],
        phantom,
        player,
        time: 0.6,
      };
      const layers: ReturnType<typeof songGraphics>[] = [];
      const ink = songGraphics();
      let authored = true;
      const view = {
        add: {
          graphics: () => {
            const layer = songGraphics();
            layers.push(layer);
            return layer;
          },
        },
        cache: { json: { get: () => (authored ? phantomAllies : undefined) } },
        ink,
        model: { state: { flight } },
        palette: { environmentDetail: 0 },
        project: toScreen,
        reducedMotion,
        textures: { exists: () => false },
      } as unknown as ObjectsContext;
      const vertex = (center: { x: number; y: number }, radius: number) => {
        const point = toScreen({ x: center.x + radius, y: center.y });
        return [point.x, point.y];
      };

      drawPhantomAllies(view);
      expect(layers).toHaveLength(2);
      const [field, ring] = layers;
      const expected = (reducedMotion ? [450, 450] : [450, 450, 112.5, 337.5]).map((radius) =>
        vertex(marlo, radius),
      );
      expect(field!.moveTo.mock.calls).toHaveLength(expected.length);
      // Marlo flies beside the nursery whale, off Ada's track, so compare to rounding.
      field!.moveTo.mock.calls.forEach(([x, y]: number[], index: number) => {
        expect(x).toBeCloseTo(expected[index]![0]!, 9);
        expect(y).toBeCloseTo(expected[index]![1]!, 9);
      });
      expect(ring!.moveTo).toHaveBeenCalledOnce();

      clearPhantomSong(view);
      phantom.allies = [marlo];
      drawPhantomAllies(view);
      expect(field!.moveTo.mock.calls[1]).toEqual(vertex(marlo, 300));
      expect(ring!.moveTo).not.toHaveBeenCalled();

      clearPhantomSong(view);
      phantom.allies = [nursery];
      departures.push({ age: 10, id: marlo.id, x: marlo.x, y: marlo.y });
      drawPhantomAllies(view);
      expect(field!.moveTo).not.toHaveBeenCalled();
      expect(ring!.moveTo).not.toHaveBeenCalled();

      authored = false;
      phantom.allies = allies;
      drawPhantomAllies(view);
      expect(ink.lineBetween).toHaveBeenCalledTimes(96);
      expect(ink.lineBetween.mock.calls[0]!.slice(0, 2)).toEqual(vertex(marlo, 450));
      expect(ink.lineBetween.mock.calls[48]!.slice(0, 2)).toEqual(vertex(flight.objects[0]!, 14));

      ink.clear();
      phantom.allies = [marlo];
      drawPhantomAllies(view);
      expect(ink.lineBetween).toHaveBeenCalledTimes(48);
      expect(ink.lineBetween.mock.calls[0]!.slice(0, 2)).toEqual(vertex(marlo, 300));

      ink.clear();
      phantom.allies = [];
      drawPhantomAllies(view);
      expect(ink.lineBetween).not.toHaveBeenCalled();
    },
  );
});
