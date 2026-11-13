import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { SCREEN } from "../data/screen.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { settlementsNear } from "./andromedaPlaces.ts";
import { ConversationDirector } from "./conversations.ts";
import { GameModel } from "./game.ts";
import { lateEncounterCue } from "./lateEncounter.ts";
import { stationsNear } from "./stations.ts";
import type { Vec } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const prelude = CONVERSATIONS.filter(({ id }) => id === "arrival:4" || id === "meeting:4:avi");

function launch(galaxy: GalaxyNumber): GameModel {
  const model = new GameModel(CONTENT);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...GALAXY_NUMBERS] });
  for (const progress of Object.values(model.state.progress)) {
    progress.opened = true;
  }
  model.state.seenConversations.push(
    ...CONVERSATIONS.filter(({ trigger }) => trigger.kind === "lesson").map(({ id }) => id),
  );
  model.startGalaxy(galaxy);
  return model;
}
function visit(model: GameModel, point: Vec): void {
  model.state.flight!.player = { x: point.x, y: point.y };
  model.state.flight!.velocity = { x: 0, y: 0 };
  model.step(0.001, idle);
  model.dismissNotice();
}
function currentExchange(model: GameModel): void {
  const key = model.conversation?.key;
  const instance = key?.slice(0, key.lastIndexOf(":"));
  const bound = CONVERSATIONS.reduce((sum, conversation) => sum + conversation.lines.length, 0);
  for (
    let index = 0;
    model.conversation?.key.startsWith(`${instance}:`) && index < bound;
    index++
  ) {
    model.advanceConversation();
  }
}

describe("Later chapter first encounters", () => {
  it("shows the actual Needle arrival and Avi introduction before the first Loom card", () => {
    const model = launch(4);
    const flight = model.state.flight!;
    const loom = flight.objects.find(({ id }) => id === "elderLoom")!;
    visit(model, loom);
    model.interact();
    expect(model.state.dialogue).toBeNull();
    const shown: string[] = [];
    const budget = CONVERSATIONS.reduce((sum, conversation) => sum + conversation.lines.length, 0);
    for (let index = 0; !model.state.dialogue && index < budget; index++) {
      const view = model.conversation;
      expect(view).not.toBeNull();
      if (prelude.some(({ id }) => view!.key.startsWith(`${id}:`))) {
        shown.push(view!.text);
      }
      model.advanceConversation();
    }
    expect(shown).toEqual(prelude.flatMap(({ lines }) => lines.map(({ text }) => text)));
    expect(model.state.dialogue?.context).toBe("needle.arrival");
    expect(model.state.progress[4].needle?.met).toBe(false);
    expect(model.state.seenConversations.filter((id) => id === "meeting:4:avi")).toHaveLength(1);
    model.closeInteraction();
    const loaded = new GameModel(CONTENT, model.save());
    loaded.continueGame();
    loaded.interact();
    expect(loaded.state.dialogue?.context).toBe("needle.arrival");
    expect(loaded.state.progress[4].needle?.met).toBe(false);
  });

  it("does not identify Avi at an arbitrary station or apply a queued Talk after Ada leaves Loom", () => {
    const model = launch(4);
    const station = stationsNear(ECONOMY, 4, 50_000, { x: 0, y: 0 })[0]!;
    visit(model, station);
    currentExchange(model);
    expect(model.state.seenConversations).not.toContain("meeting:4:avi");
    const loom = model.state.flight!.objects.find(({ id }) => id === "elderLoom")!;
    visit(model, loom);
    model.interact();
    model.state.flight!.player = { x: loom.x + ECONOMY.station.safeRadius * 2, y: loom.y };
    prelude.flatMap(({ lines }) => lines).forEach(() => model.advanceConversation());
    expect(model.state.dialogue).toBeNull();
    expect(model.state.progress[4].needle?.met).toBe(false);
  });

  it("does not identify Munix from an invented settlement or station object", () => {
    const model = launch(5);
    const range = ECONOMY.station.safeRadius;
    const point = Array.from({ length: 32 }, (_, index) => ({
      x: index * ECONOMY.station.cellSize,
      y: 0,
    })).find(
      (candidate) =>
        stationsNear(ECONOMY, 5, range, candidate).length === 0 &&
        settlementsNear(ECONOMY, range, candidate).length === 0,
    );
    expect(point).toBeDefined();
    const flight = model.state.flight!;
    flight.player = point!;
    flight.objects = [
      { ...point!, hp: 1, id: "settlement:invented", kind: "destination", radius: 30 },
      { ...point!, hp: 1, id: "station:invented", kind: "station", radius: 30 },
    ];
    expect(lateEncounterCue({ catalog: ECONOMY, viewport: SCREEN }, flight)).toBeNull();
  });

  it.each(["station", "settlement"] as const)(
    "introduces Munix at a verified Andromeda %s",
    (kind) => {
      const model = launch(5);
      const sites =
        kind === "station"
          ? stationsNear(ECONOMY, 5, 50_000, { x: 0, y: 0 })
          : settlementsNear(ECONOMY, 50_000, { x: 0, y: 0 });
      expect(sites.length).toBeGreaterThan(0);
      visit(model, sites[0]!);
      const cue = lateEncounterCue({ catalog: ECONOMY, viewport: SCREEN }, model.state.flight!);
      expect(cue).toBe("stationNear");
      const copy = CONVERSATIONS.filter(({ id }) => id === "meeting:5:munix");
      const seen: string[] = [];
      const director = new ConversationDirector(copy, seen);
      director.beginFlight(5);
      director.encounter(cue!);
      expect(director.beforeInteraction(["meeting:5:munix"])).toBe(true);
      expect(director.showing?.conversation.id).toBe("meeting:5:munix");
      expect(seen).toEqual(["meeting:5:munix"]);
    },
  );
});
