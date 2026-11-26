import { beforeEach, describe, expect, it, vi } from "vitest";

import { readWhirlpoolProjects } from "../art/index.ts";
import { ECONOMY } from "../data/economy.ts";
import { settlementsNear } from "../model/andromedaPlaces.ts";
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
  it("keeps a stable 128-unit cadence on both sides of the practice channel", () => {
    expect(
      channelLampPlaces({
        path: [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
        ],
        width: 120,
      }),
    ).toEqual([
      { index: 0, point: { x: 0, y: -80 }, side: -1 },
      { index: 0, point: { x: 0, y: 80 }, side: 1 },
      { index: 1, point: { x: 128, y: -80 }, side: -1 },
      { index: 1, point: { x: 128, y: 80 }, side: 1 },
      { index: 2, point: { x: 256, y: -80 }, side: -1 },
      { index: 2, point: { x: 256, y: 80 }, side: 1 },
    ]);
  });

  it("draws only funded practice lamps, alternating art and reporting each passable keyline", () => {
    const player = { x: 0, y: 0 };
    const f = fixture(4, player);
    f.flight.needle = { anchor: { x: 0, y: 0 }, chatter: [], exitPackPlaced: false };
    Object.assign(player, needleCourses(f.flight)!.practice.path[0]);
    expect(f.run()).toEqual([]);
    expect(calls.sprite).not.toHaveBeenCalled();
    f.changes.push({ project: "channelLights", revealed: true });
    expect(f.run().length).toBeGreaterThan(1);
    expect(calls.sprite.mock.calls.map((call) => call[2])).toEqual(
      expect.arrayContaining(["needle-lamp-a", "needle-lamp-b"]),
    );
    expect(calls.keyline.mock.calls.every((call) => call[1] === "needleLamp")).toBe(true);
    expect(f.scene.passes).toHaveBeenCalledTimes(calls.sprite.mock.calls.length);
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
