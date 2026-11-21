import { beforeEach, describe, expect, it, vi } from "vitest";

import { guideBeaconSlots } from "../model/guideBeacons.ts";
import { needleCourses } from "../model/needle.ts";
import type { FlightState, Vec } from "../model/types.ts";
import { GALAXY_MANIFESTS } from "../testing/publicArt.ts";
import { channelLampPlaces, createGuideLights } from "./sceneGuideLights.ts";

const calls = vi.hoisted(() => ({ keyline: vi.fn(), sprite: vi.fn() }));
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

function fixture(galaxy: 4 | 5, player: Vec) {
  const changes: { project: string; revealed: boolean }[] = [];
  const progress = { questComplete: false };
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
      revealWorldChange: vi.fn(),
      state: { progress: { 5: progress } },
      worldChanges: () => changes,
    },
    outpostArt: new Map(),
    passes: vi.fn(),
    project: (point: Vec) => ({ x: 360 + point.x - player.x, y: 180 + point.y - player.y }),
    reducedMotion: false,
    reveals: new Map(),
    shipAssets: [],
    textures: { exists: () => true },
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
});
