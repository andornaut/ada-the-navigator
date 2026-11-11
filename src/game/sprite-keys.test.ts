import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/story-ships.ts";
import { ensureDestination } from "../model/flight.ts";
import { GameModel } from "../model/game.ts";
import { storyShips } from "../model/story-ships.ts";
import {
  BEACON_SUFFIX,
  hubBayKey,
  hubBuoyKey,
  hubStoryKey,
  spriteOwner,
  staleSpriteKeys,
} from "./sprite-keys.ts";

describe("object sprite keys", () => {
  it("keeps the hub's bay, buoys and story craft through the update's cleanup", () => {
    const model = new GameModel(PROTOTYPE);
    model.state.unlocked = [1, 2];
    model.startSector(2);
    const flight = model.state.flight!;
    const hub = ensureDestination(PROTOTYPE, "hub", flight);
    // Every craft the scenes draw: the waiting pair, and the blocking scene's cast.
    const ships = [
      ...storyShips(hub, { stage: 2 }, false, undefined, 0),
      ...storyShips(hub, { stage: 2 }, false, { at: 0, id: "blocked", lineDue: false }, 1),
    ];
    expect(ships.length).toBeGreaterThan(0);
    const keys = [
      hubBayKey(hub.id),
      ...Object.keys(CARTWHEEL_STORY_SHIPS.buoys).map((group) => hubBuoyKey(hub.id, group)),
      ...ships.map((ship) => hubStoryKey(hub.id, ship.id)),
    ];
    const active = new Set(flight.objects.map((object) => object.id));
    expect(staleSpriteKeys(active, keys)).toEqual([]);
    active.delete(hub.id);
    expect(staleSpriteKeys(active, keys)).toEqual(keys);
  });

  it("owns an extra sprite by the id before its first #", () => {
    expect(spriteOwner(`holodisk${BEACON_SUFFIX}`)).toBe("holodisk");
    expect(spriteOwner(hubStoryKey("hub", "visitor-1"))).toBe("hub");
    expect(spriteOwner("growers")).toBe("growers");
  });
});
