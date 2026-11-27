import { beforeEach, describe, expect, it, vi } from "vitest";

import { readGalaxyStationArt, readWhirlpoolProjects } from "../art/index.ts";
import { ECONOMY } from "../data/economy.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { settlementsNear } from "../model/andromedaPlaces.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "../model/flightTopology.ts";
import { guideBeaconSlots } from "../model/guideBeacons.ts";
import { needleCourses } from "../model/needle.ts";
import type { FlightState, GalaxyProgress, Vec } from "../model/types.ts";
import { GALAXY_MANIFESTS, publicJson } from "../testing/publicArt.ts";
import { andromedaSettlementVariant } from "./sceneAndromeda.ts";
import { channelLampPlaces, createGuideLights } from "./sceneGuideLights.ts";

const calls = vi.hoisted(() => ({ keyline: vi.fn(), sprite: vi.fn() }));
vi.mock("./sceneObjects.ts", () => ({ drawOutpost: vi.fn(), placeStationFrame: vi.fn() }));
vi.mock("./sceneHud.ts", () => ({ keylineSprite: calls.keyline }));
vi.mock("./sceneSprites.ts", () => ({ objectSprite: calls.sprite }));

beforeEach(() => {
  vi.clearAllMocks();
  calls.sprite.mockReturnValue({
    setAlpha: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
  });
});

function fixture(galaxy: 3 | 4 | 5, player: Vec) {
  const changes: { project: string; revealed: boolean }[] = [];
  const progress: Pick<GalaxyProgress, "questComplete" | "andromeda"> = { questComplete: false };
  const flight = {
    galaxy,
    objects: [],
    player,
    seed: 1,
    world: { notables: {} },
  } as unknown as FlightState;
  const scene = {
    flightClock: 0,
    flightLive: true,
    galaxyManifests: GALAXY_MANIFESTS,
    galaxyStations: new Map(),
    model: {
      revealWorldChange: vi.fn(() => true),
      state: { progress: { 5: progress } },
      worldChanges: () => changes,
    },
    outpostArt: new Map(),
    passes: vi.fn(),
    project: (point: Vec) => ({ x: 360 + point.x - player.x, y: 180 + point.y - player.y }),
    projectArt: { revealMs: 600 },
    reducedMotion: false,
    reveals: new Map(),
    shipAssets: [],
    textures: { exists: () => true },
    time: { now: 0 },
    whirlpoolProjects: readWhirlpoolProjects(
      GALAXY_MANIFESTS.get(3)!.assets,
      publicJson("/art/whirlpool/projects.json"),
    ),
  };
  const draw = createGuideLights();
  return {
    changes,
    flight,
    progress,
    run: () => draw(scene as unknown as Parameters<typeof draw>[0], flight),
    scene,
  };
}

describe("project guide lights", () => {
  it("places paired lamps at the published start, spacing and inward edge inset", () => {
    expect(
      channelLampPlaces(
        {
          path: [
            { x: 0, y: 0 },
            { x: 210, y: 0 },
          ],
          width: 120,
        },
        { inset: 4, sides: [-1, 1], spacing: 80, start: 40 },
      ),
    ).toEqual([
      { index: 0, point: { x: 40, y: -56 }, side: -1 },
      { index: 0, point: { x: 40, y: 56 }, side: 1 },
      { index: 1, point: { x: 120, y: -56 }, side: -1 },
      { index: 1, point: { x: 120, y: 56 }, side: 1 },
      { index: 2, point: { x: 200, y: -56 }, side: -1 },
      { index: 2, point: { x: 200, y: 56 }, side: 1 },
    ]);
  });

  it("animates only funded practice lamps in the same local image, with reduced motion holding A", () => {
    const player = { x: 0, y: 0 };
    const f = fixture(4, player);
    f.flight.topology = CURRENT_FLIGHT_TOPOLOGY;
    f.flight.needle = {
      anchor: { x: GALAXY_SIDE / 2 + 4000, y: 0 },
      chatter: [],
      exitPackPlaced: false,
    };
    const entrance = needleCourses(f.flight)!.practice.path[0]!;
    Object.assign(player, { x: entrance.x - GALAXY_SIDE, y: entrance.y });
    expect(f.run()).toEqual([]);
    expect(calls.sprite).not.toHaveBeenCalled();
    f.changes.push({ project: "channelLights", revealed: true });
    expect(f.run().length).toBeGreaterThan(1);
    const textures = () =>
      new Map(calls.sprite.mock.calls.map(([, key, texture]) => [key, texture]));
    const on = textures();
    expect(on.get("project:channelLights:0:-1")).toBe("needle-lamp-a");
    expect(on.get("project:channelLights:0:1")).toBe("needle-lamp-b");
    expect(on.get("project:channelLights:1:-1")).toBe("needle-lamp-b");
    expect(calls.keyline.mock.calls.every((call) => call[1] === "needleLamp")).toBe(true);
    expect(f.scene.passes).toHaveBeenCalledTimes(calls.sprite.mock.calls.length);

    f.scene.time.now = 700;
    expect(f.run()).toEqual([...on.keys()]);
    const off = textures();
    for (const [id, frame] of on) {
      expect(off.get(id)).toBe(frame === "needle-lamp-a" ? "needle-lamp-b" : "needle-lamp-a");
    }
    calls.sprite.mockClear();
    f.scene.reducedMotion = true;
    expect(f.run()).toEqual([...on.keys()]);
    expect([...new Set(textures().values())]).toEqual(["needle-lamp-a"]);
  });

  it("reveals the funded school beside loaded settlers' stations on their shared blink clock", () => {
    const f = fixture(5, { x: 0, y: 0 });
    const station = { hp: 1, id: "station:0,0", kind: "station" as const, radius: 70, x: 0, y: 0 };
    f.flight.objects.push(station, { ...station, id: "pip", kind: "destination" });
    const key = "project:courierSchool:station:0,0:1";
    expect(f.run()).not.toContain(key);
    const change = { project: "courierSchool", revealed: false };
    f.changes.push(change);
    f.scene.flightLive = false;
    expect(f.run()).not.toContain(key);
    f.scene.flightLive = true;
    f.scene.textures.exists = () => false;
    expect(f.run()).not.toContain(key);
    expect(f.scene.model.revealWorldChange).not.toHaveBeenCalled();
    f.scene.textures.exists = () => true;
    expect(f.run()).not.toContain(key);
    f.scene.galaxyStations.set(5, readGalaxyStationArt(GALAXY_MANIFESTS.get(5)!.assets)!);
    expect(f.run()).toContain(key);
    expect(f.scene.model.revealWorldChange).toHaveBeenCalledExactlyOnceWith(5, "courierSchool");
    expect(calls.sprite).toHaveBeenCalledWith(f.scene, key, "station-settlers-school-a");
    expect(calls.sprite.mock.results[0]!.value.setPosition).toHaveBeenCalledWith(
      360 - 194.093 * (204.75 / 312),
      180,
    );
    change.revealed = true;
    f.scene.flightClock = 700;
    f.scene.time.now = 700;
    expect(f.run()).toContain(key);
    expect(calls.sprite).toHaveBeenCalledWith(f.scene, key, "station-settlers-school-b");
    f.scene.reducedMotion = true;
    expect(f.run()).toContain(key);
    expect(calls.sprite.mock.calls.filter(([, id]) => id === key).at(-1)?.[2]).toBe(
      "station-settlers-school-a",
    );
    expect(f.scene.model.revealWorldChange).toHaveBeenCalledTimes(1);
  });

  it("uses the ordinary slot art until a story beacon occupies it, and gates its spare on repair and funding", () => {
    const slot = guideBeaconSlots({ x: 0, y: 0 }, 12000)[0]!;
    const f = fixture(5, slot.point);
    expect(f.run()).toContain(`guide:${slot.id}`);
    expect(calls.sprite).toHaveBeenCalledWith(
      f.scene,
      `guide:${slot.id}`,
      slot.index % 2 === 0 ? "beacon-guide-lit-a" : "beacon-guide-lit-b",
    );
    f.flight.objects.push({
      ...slot.point,
      hp: 1,
      id: "darkBeacon",
      kind: "destination",
      radius: 30,
    });
    f.changes.push({ project: "spareBeacon", revealed: true });
    expect(f.run()).not.toContain(`guide:${slot.id}`);
    expect(f.run()).not.toContain("project:spareBeacon");
    f.progress.questComplete = true;
    expect(f.run()).toContain("project:spareBeacon");
    expect(calls.sprite).toHaveBeenCalledWith(
      f.scene,
      "project:spareBeacon",
      "beacon-guide-spare-a",
    );
    expect(calls.keyline).toHaveBeenCalledWith(
      f.scene,
      "guideBeacon",
      "project:spareBeacon",
      expect.anything(),
    );
  });

  it("anchors the Whirlpool lights to family and reveals only in visible live flight", () => {
    const f = fixture(3, { x: 100, y: -78 });
    f.flight.objects.push({ hp: 1, id: "family", kind: "destination", radius: 40, x: 0, y: 0 });
    expect(f.run()).toEqual([]);
    const change = { project: "quietCrossing", revealed: false };
    f.changes.push(change);
    f.scene.flightLive = false;
    expect(f.run()).toEqual([]);
    expect(f.scene.model.revealWorldChange).not.toHaveBeenCalled();
    f.scene.flightLive = true;
    expect(f.run()).toEqual(["project:quietCrossing"]);
    expect(f.scene.model.revealWorldChange).toHaveBeenCalledExactlyOnceWith(3, "quietCrossing");
    expect(calls.sprite).toHaveBeenCalledWith(
      f.scene,
      "project:quietCrossing",
      "whirlpool-quiet-crossing-a",
    );
    expect(calls.sprite.mock.results[0]!.value.setPosition).toHaveBeenCalledWith(360, 180);
    expect(calls.sprite.mock.results[0]!.value.setAlpha).toHaveBeenLastCalledWith(0);
    change.revealed = true;
    f.scene.flightClock = 300;
    f.scene.time.now = 1000;
    expect(f.run()).toEqual(["project:quietCrossing"]);
    expect(calls.sprite).toHaveBeenLastCalledWith(
      f.scene,
      "project:quietCrossing",
      "whirlpool-quiet-crossing-b",
    );
    expect(calls.sprite.mock.results[1]!.value.setAlpha).toHaveBeenLastCalledWith(0.875);
  });

  it("places the berth off the canonical practice entrance with reduced motion holding A", () => {
    const player = { x: 0, y: 0 };
    const f = fixture(4, player);
    f.flight.needle = { anchor: { x: 0, y: 0 }, chatter: [], exitPackPlaced: false };
    const entrance = needleCourses(f.flight)!.practice.path[0]!;
    f.changes.push({ project: "practiceBerth", revealed: true });
    expect(f.run()).not.toContain("project:practiceBerth");
    Object.assign(player, { x: entrance.x - 106, y: entrance.y + 158 });
    f.scene.reducedMotion = true;
    f.scene.time.now = 700;
    expect(f.run()).toEqual(["project:practiceBerth"]);
    expect(calls.sprite).toHaveBeenLastCalledWith(
      f.scene,
      "project:practiceBerth",
      "needle-practice-berth-a",
    );
    expect(calls.sprite.mock.results[0]!.value.setPosition).toHaveBeenCalledWith(360, 180);
  });

  it.each(["hamlet", "lamphouse"])(
    "places the rack at the retained %s settlement rather than Pip",
    (variant) => {
      const chosen = settlementsNear(ECONOMY, 75_000, { x: 0, y: 0 }).find(
        (site) => andromedaSettlementVariant(site.id) === variant,
      )!;
      expect(chosen).toBeDefined();
      const f = fixture(5, { x: chosen.x - 110, y: chosen.y - 143 });
      f.flight.objects.push(
        { hp: 1, id: "pip", kind: "destination", radius: 40, x: chosen.x + 40, y: chosen.y },
        { ...chosen, hp: 1, kind: "destination", radius: 40, role: "settlement" },
      );
      f.changes.push({ project: "routeExchange", revealed: true });
      expect(f.run()).not.toContain("project:routeExchange");
      f.progress.andromeda = { settlement: chosen.id };
      expect(f.run()).toContain("project:routeExchange");
      const index = calls.sprite.mock.calls.findIndex(
        (call) => call[1] === "project:routeExchange",
      );
      expect(calls.sprite.mock.calls[index]?.[2]).toBe("andromeda-route-exchange-a");
      expect(calls.sprite.mock.results[index]!.value.setPosition).toHaveBeenCalledWith(360, 180);
    },
  );
});
