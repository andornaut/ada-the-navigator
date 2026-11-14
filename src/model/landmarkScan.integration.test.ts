import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { GameModel } from "./game.ts";
import { landmarkSites } from "./landmarks.ts";
import { stationsNear } from "./stations.ts";
import { stationSpecialty } from "./stationServices.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function fixture() {
  const model = new GameModel(CONTENT);
  model.state.prologueSeen = true;
  model.state.seenConversations.push("lesson:move", "lesson:aim", "lesson:dock", "lesson:stardust");
  model.startGalaxy(1);
  model.state.dialogue = null;
  const flight = model.state.flight!;
  flight.objects = [];
  flight.shots = [];
  const site = landmarkSites(1).find(({ kind }) => kind === "wreck")!;
  flight.player = { x: site.x, y: site.y };
  flight.velocity = { x: 0, y: 0 };
  return { flight, model, site };
}

describe("explicit landmark Scan", () => {
  it("leaves flyover and visible identification uncharted, then scans exactly once", () => {
    const { model, site } = fixture();
    const before = model.state.economy.stardust;
    model.step(0.01, idle);
    model.landmarkDisplayed(site.id);
    expect(model.state.progress[1].charted).not.toContain(site.id);
    expect(model.state.achievements.charted[1] ?? []).not.toContain(site.id);
    expect(model.state.economy.stardust).toBe(before);
    expect(model.useTarget).toEqual({ action: "scan", id: site.id });
    expect(model.contextLabel).toBe("Scan");
    model.interact();
    expect(model.state.progress[1].charted).toEqual([site.id]);
    expect(model.state.achievements.charted[1]).toEqual([site.id]);
    expect(model.map!.places.find(({ id }) => id === site.id)).toMatchObject({ symbol: "wreck" });
    model.interact();
    expect(model.state.progress[1].charted).toEqual([site.id]);
    expect(model.state.economy.stardust).toBe(before);
    const restored = new GameModel(CONTENT, model.save());
    restored.continueGame();
    restored.interact();
    expect(restored.state.progress[1].charted).toEqual([site.id]);
    expect(restored.state.economy.stardust).toBe(before);
  });

  it("uses the actual station interaction range and blocks covered dialogue actions", () => {
    const { flight, model, site } = fixture();
    flight.player.x = site.x + CONTENT.tuning.talkRange + 1;
    expect(model.contextAction).toBeUndefined();
    model.interact();
    expect(model.state.progress[1].charted).toEqual([]);
    flight.player.x = site.x + CONTENT.tuning.talkRange;
    expect(model.contextAction).toBe("scan");
    model.state.dialogue = { choices: [], context: "test", text: "", title: "Astra" };
    model.interact();
    expect(model.state.progress[1].charted).toEqual([]);
    model.state.dialogue = null;
    model.interact();
    expect(model.state.progress[1].charted).toEqual([site.id]);
  });

  it("completes an accepted survey and pays its actual offer only on explicit Scan", () => {
    const { flight, model } = fixture();
    const station = stationsNear(ECONOMY, 1, 40000, { x: 0, y: 0 }).find(
      ({ id }) => stationSpecialty(1, id) === "jobs",
    )!;
    model.state.docked = station.id;
    const offer = model.jobBoard().find(({ type }) => type === "survey")!;
    expect(offer).toBeDefined();
    expect(model.acceptJob(offer.id)).toBe("accepted");
    const target = structuredClone(model.state.tasks[1]!);
    model.undock();
    if (target.kind !== "job") {
      throw new Error("Expected accepted survey job");
    }
    flight.player = { x: target.target.x, y: target.target.y };
    const before = model.state.economy.stardust;
    model.step(0.01, idle);
    expect(model.state.tasks[1]).toBeDefined();
    expect(model.state.economy.stardust).toBe(before);
    model.interact();
    expect(model.state.tasks[1]).toBeUndefined();
    expect(model.state.progress[1].charted).toContain(target.target.id);
    expect(model.state.economy.stardust - before).toBe(offer.reward);
    expect(model.state.achievements.jobs).toBe(1);
    model.interact();
    model.step(0.01, idle);
    expect(model.state.economy.stardust - before).toBe(offer.reward);
    expect(model.state.achievements.jobs).toBe(1);
  });
});
