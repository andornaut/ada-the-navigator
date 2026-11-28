import { beforeEach, describe, expect, it, vi } from "vitest";

import manifest from "../../public/art/andromeda/manifest.json";
import core from "../../public/art/manifest.json";
import { selectEnemyFrame, staleSpriteKeys } from "../art/index.ts";
import { ANDROMEDA_REDACT } from "../data/capitalBosses.ts";
import { ECONOMY } from "../data/economy.ts";
import { worldNearestSettlerStation } from "../model/andromeda/places.ts";
import type { GalaxyProgress, SpaceObject } from "../model/types.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "../model/world/index.ts";
import {
  andromedaSettlementVariant,
  drawAndromeda,
  drawAndromedaLaneCourier,
} from "./sceneAndromeda.ts";
import type { ObjectsContext } from "./sceneObjects.ts";
import type { Asset } from "./sceneShared.ts";
import type { WorldContext } from "./sceneWorld.ts";

const calls = vi.hoisted(() => ({ outpost: vi.fn(), single: vi.fn(), sprite: vi.fn() }));
vi.mock("./sceneObjects.ts", () => ({
  drawOutpost: calls.outpost,
  placeStationFrame: calls.single,
}));
vi.mock("./sceneSprites.ts", () => ({ objectSprite: calls.sprite }));
vi.mock("./sceneHud.ts", () => ({ drawCraftJets: vi.fn(), keylineSprite: vi.fn() }));

const frames = core.assets.filter(({ id }) => /^craft-pip-\d+$/u.test(id)) as unknown as Asset[];
const craft = { frames, jets: undefined };
function scene(complete = false, ready = true, redact?: GalaxyProgress["redact"]): ObjectsContext {
  return {
    craftArt: new Map([["pip", craft]]),
    galaxyManifests: new Map([[5, manifest]]),
    model: {
      state: {
        flight: { galaxy: 5, player: { x: 100, y: 0 } },
        progress: { 5: { questComplete: complete, redact } },
      },
    },
    passes: vi.fn(),
    project: (point: { x: number; y: number }) => point,
    shipAssets: [],
    textures: { exists: () => ready },
    time: { now: 0 },
  } as unknown as ObjectsContext;
}
const destination = (id: string): SpaceObject => ({
  hp: 1,
  id,
  kind: "destination",
  radius: 30,
  x: 0,
  y: 0,
});
beforeEach(() => {
  vi.clearAllMocks();
  calls.sprite.mockReturnValue({
    setDepth: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
  });
});

describe("Andromeda authored rendering", () => {
  it("shows the dented beacon until actual repair completes and its authored relit frames afterward", () => {
    const beacon = destination("darkBeacon");
    expect(drawAndromeda(scene(), beacon)).toBe(true);
    expect(calls.single.mock.lastCall![1].id).toBe("beacon-guide-dented");
    expect(drawAndromeda(scene(true), beacon)).toBe(true);
    expect(calls.outpost.mock.lastCall![1].frames.map(({ id }: Asset) => id)).toEqual([
      "beacon-guide-relit-a",
      "beacon-guide-relit-b",
    ]);
  });

  it("draws the existing guide beacon only for Redact's resolved relay", () => {
    const relay = destination(ANDROMEDA_REDACT.relayId);
    const record = { relay: { x: 0, y: 0 }, site: { x: 500, y: 0 } };
    expect(drawAndromeda(scene(true, true, { ...record, phase: "active" }), relay)).toBe(true);
    expect(calls.single).not.toHaveBeenCalled();
    expect(
      drawAndromeda(
        scene(true, false, { ...record, outcome: "salvaged", phase: "resolved" }),
        relay,
      ),
    ).toBe(false);
    const resolved = scene(true, true, { ...record, outcome: "defeated", phase: "resolved" });
    expect(drawAndromeda(resolved, relay)).toBe(true);
    expect(calls.single).toHaveBeenCalledExactlyOnceWith(
      resolved,
      expect.objectContaining({ id: "beacon-guide-lit-a" }),
      "guideBeacon",
      relay,
      relay,
    );
  });

  it("assigns actual seeded settlement identities stable authored designs", () => {
    for (const [id, variant] of [
      ["settlement:2,-2", "hamlet"],
      ["settlement:2,-1", "lamphouse"],
    ]) {
      const outpost = destination(id!);
      expect(andromedaSettlementVariant(id!)).toBe(variant);
      expect(drawAndromeda(scene(), outpost)).toBe(true);
      expect(calls.outpost.mock.lastCall![2]).toBe(outpost);
      expect(calls.outpost.mock.lastCall![1].frames.map(({ id }: Asset) => id)).toEqual([
        `outpost-${variant}-a`,
        `outpost-${variant}-b`,
      ]);
    }
    expect(andromedaSettlementVariant("station:2,-2")).toBeUndefined();
  });

  it("draws Pip with the core courier craft's authored heading and display footprint", () => {
    const context = scene();
    const pip = destination("pip");
    const frame = selectEnemyFrame(craft, { x: 100, y: 0 });
    expect(drawAndromeda(context, pip)).toBe(true);
    expect(calls.sprite).toHaveBeenCalledWith(context, pip.id, frame.id);
    expect(calls.sprite.mock.results[0]!.value.setDisplaySize).toHaveBeenCalledWith(
      frame.displayWidth,
      frame.displayHeight,
    );
    expect(pip.kind).toBe("destination");
    expect(pip.enemy).toBeUndefined();
  });

  it("leaves missing textures and unrelated objects to the existing renderer", () => {
    for (const id of ["darkBeacon", "pip", "settlement:2,-2"]) {
      expect(drawAndromeda(scene(false, false), destination(id))).toBe(false);
    }
    expect(drawAndromeda(scene(), destination("growers"))).toBe(false);
    expect(calls.outpost).not.toHaveBeenCalled();
    expect(calls.single).not.toHaveBeenCalled();
    expect(calls.sprite).not.toHaveBeenCalled();
  });
});

describe("visible Andromeda courier", () => {
  function frame({
    complete = true,
    live = true,
    ready = true,
    visible = true,
    warpCover = false,
  } = {}) {
    const context = scene(complete, ready) as unknown as WorldContext;
    const flight = context.model.state.flight!;
    const beacon = destination("darkBeacon");
    Object.assign(flight, {
      objects: [beacon],
      time: 10,
      topology: CURRENT_FLIGHT_TOPOLOGY,
      world: { notables: {} },
    });
    Object.assign(context, {
      flightLive: live,
      project: () => (visible ? { x: 20, y: 40 } : { x: -200, y: 40 }),
      warpCover,
    });
    context.model.andromedaCourierDisplayed = vi.fn();
    Object.assign(context.model.state.progress[5], {
      andromeda: {
        station: worldNearestSettlerStation(
          { worldSide: CURRENT_FLIGHT_TOPOLOGY.side },
          ECONOMY,
          beacon,
        ).id,
      },
      requiredSites: { darkBeacon: beacon },
    });
    drawAndromedaLaneCourier(context, flight);
    return { context, flight };
  }

  it("registers sight after placing the existing textured craft with a retained sprite owner", () => {
    const { context, flight } = frame();
    const sprite = calls.sprite.mock.results[0]!.value;
    const key = "darkBeacon#andromeda:lane-courier";
    expect(calls.sprite).toHaveBeenCalledWith(context, key, expect.stringMatching(/^craft-pip-/u));
    expect(staleSpriteKeys(new Set(flight.objects.map(({ id }) => id)), [key])).toEqual([]);
    expect(context.passes).toHaveBeenCalledWith(sprite);
    expect(context.model.andromedaCourierDisplayed).toHaveBeenCalledWith(flight);
  });

  it.each([{ complete: false }, { ready: false }, { visible: false }])(
    "records no sight or sprite for %j",
    (condition) => {
      const { context } = frame(condition);
      expect(calls.sprite).not.toHaveBeenCalled();
      expect(context.model.andromedaCourierDisplayed).not.toHaveBeenCalled();
    },
  );

  it.each([{ live: false }, { warpCover: true }])("records no sight under %j", (condition) => {
    const { context } = frame(condition);
    expect(context.model.andromedaCourierDisplayed).not.toHaveBeenCalled();
  });
});
