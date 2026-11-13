import { beforeEach, describe, expect, it, vi } from "vitest";

import manifest from "../../public/art/andromeda/manifest.json";
import core from "../../public/art/manifest.json";
import type { SpaceObject } from "../model/types.ts";
import { selectEnemyFrame } from "./enemyArt.ts";
import { andromedaSettlementVariant, drawAndromeda } from "./sceneAndromeda.ts";
import type { ObjectsContext } from "./sceneObjects.ts";
import type { Asset } from "./sceneShared.ts";

const calls = vi.hoisted(() => ({ outpost: vi.fn(), single: vi.fn(), sprite: vi.fn() }));
vi.mock("./sceneObjects.ts", () => ({
  drawOutpost: calls.outpost,
  placeStationFrame: calls.single,
}));
vi.mock("./sceneSprites.ts", () => ({ objectSprite: calls.sprite }));

const frames = core.assets.filter(({ id }) => /^craft-pip-\d+$/u.test(id)) as unknown as Asset[];
const craft = { frames, jets: undefined };
function scene(complete = false, ready = true): ObjectsContext {
  return {
    craftArt: new Map([["pip", craft]]),
    model: {
      state: {
        flight: { galaxy: 5, player: { x: 100, y: 0 } },
        progress: { 5: { questComplete: complete } },
      },
    },
    passes: vi.fn(),
    project: (point: { x: number; y: number }) => point,
    shipAssets: manifest.assets,
    textures: { exists: () => ready },
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
    expect(calls.sprite.mock.results[0]!.value.setDisplaySize).toHaveBeenCalledWith(35, 35);
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
