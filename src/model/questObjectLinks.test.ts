import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { JOB_TUNING } from "../data/jobs.ts";
import { LANDMARK_SCAN_COPY } from "../data/landmarkScanCopy.ts";
import { ControlState } from "../input/state.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { consumeContextQuestUse } from "../ui/contextQuestUse.ts";
import { createEnemy, damageEnemy } from "./enemyAi.ts";
import { createFlight } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { flightLandmarkSites, landmarkLabel } from "./landmarks.ts";
import type { QuestEntry } from "./questDetails.ts";
import { questsForObject, taskMarkerCategory } from "./questObjectLinks.ts";
import { flightStationContext, HUB_STATION, worldStationsNear } from "./stations.ts";
import type { HeldJob } from "./types.ts";
import { worldDistance } from "./worldContacts.ts";

function job(target: string, station = "issuer"): HeldJob {
  return {
    id: "held",
    item: "seeds",
    kind: "job",
    reward: 17,
    station,
    target: { id: target, x: 0, y: 0 },
    type: "survey",
  };
}
function game() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.mode = "space";
  model.state.selectedGalaxy = 1;
  model.state.flight = createFlight(CONTENT, 1, 123, { known: [] });
  return model;
}
function landmarkContext() {
  const model = game();
  const site = flightLandmarkSites(model.state.flight!)[0]!;
  model.state.flight!.player = { x: site.x, y: site.y };
  model.state.tasks[1] = job(site.id);
  return { model, site };
}

function salvageByPip() {
  const model = new GameModel(CONTENT, () => 173, SAVE_RESTORE);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...GALAXY_NUMBERS] });
  model.state.progress[5].opened = true;
  model.startGalaxy(5);
  const flight = model.state.flight!;
  const pip = flight.objects.find(({ id }) => id === "pip")!;
  model.state.progress[5].known.push(pip.id);
  const world = flightWorldContext(flight);
  const station = worldStationsNear(flightStationContext(flight), ECONOMY, 5, 20000, pip).find(
    (site) => worldDistance(world, site, pip) >= JOB_TUNING.delivery.min,
  )!;
  model.state.progress[5].stations.push(station.id);
  // The held delivery is still linked to Pip after losing its item.
  model.state.tasks[5] = {
    carrying: false,
    id: "pip-delivery",
    item: "seeds",
    kind: "job",
    reward: 17,
    station: station.id,
    target: { id: pip.id, x: pip.x, y: pip.y },
    type: "delivery",
  };
  flight.player = { x: pip.x + 90, y: pip.y };
  const at = { x: flight.player.x + CONTENT.tuning.talkRange - 0.25, y: pip.y };
  const id = "disabled-frigate";
  const definition = enemyDefinition(5, "frigate", id);
  let enemy = createEnemy(definition, { archetype: "frigate", id, packId: null, phase: 0 }, at);
  for (const part of definition.hardpoints.filter(({ kind }) => kind === "weapon")) {
    enemy = damageEnemy(definition, { amount: part.hp, hardpointId: part.id }, enemy);
  }
  expect(enemy.disabled).toBe(true);
  const heavy = { ...at, enemy, hp: enemy.hp, id, kind: "enemy" as const, radius: 40 };
  flight.objects = [pip, heavy];
  return { flight, heavy, model, pip, world };
}

describe("canonical quest object associations", () => {
  it("uses actual endpoints, not the shared location label dictionary or other galaxies", () => {
    const model = game();
    model.state.progress[1].known.push("growers", "workshop");
    Object.assign(model.state.progress[1], { introduced: true, stage: 1 });
    model.state.tasks[1] = job("workshop");
    model.state.tasks[2] = job("workshop");
    const before = structuredClone(model.state);
    const context = {
      galaxy: 1 as const,
      knownIds: ["growers", "workshop"],
      quests: model.quests,
      storyTargets: [],
      task: model.state.tasks[1]!,
    };
    expect(questsForObject(context, "growers").map(({ id }) => id)).toEqual(["story:1:1"]);
    expect(questsForObject(context, "workshop").map(({ id }) => id)).toEqual([
      "story:1:1",
      "job:1:held",
    ]);
    expect(questsForObject({ ...context, knownIds: ["growers"] }, "workshop")).toEqual([]);
    expect(model.state).toEqual(before);
  });

  it("uses project only for an explicit eligible contributor after story and job", () => {
    expect(taskMarkerCategory([], true, true, true)).toBe("story");
    expect(taskMarkerCategory([], false, true, true)).toBe("job");
    expect(taskMarkerCategory([], false, false, true)).toBe("project");
    expect(taskMarkerCategory([], false, false)).toBe("generic");
  });

  it("does not infer associations from a known label or coordinates", () => {
    const entry: QuestEntry = {
      galaxy: 1,
      id: "story:1:1",
      line: { kind: "story", target: null, text: "Existing objective" },
      locations: [{ id: "unrelated", label: "Known place" }],
    };
    expect(
      questsForObject(
        { galaxy: 1, knownIds: ["unrelated"], quests: [entry], storyTargets: [] },
        "unrelated",
      ),
    ).toEqual([]);
  });
});

describe("contextual Use quest fallback", () => {
  it("offers Salvage without placing its callout over a different POI", () => {
    const { heavy, model } = salvageByPip();
    expect(model.contextAction).toBe("salvage");
    expect(model.useTarget).toBeUndefined();
    expect(model.contextQuestDetails).toBeNull();
    model.interact();
    expect(heavy.enemy.salvaged).toBe(true);
    expect(model.state.dialogue?.context).toBe("salvage");
  });

  it("dispatches the linked quest once when movement makes it win after Use sampling", () => {
    const { flight, heavy, model, pip, world } = salvageByPip();
    expect(model.contextAction).toBe("salvage");
    expect(model.contextQuestDetails).toBeNull();
    expect(worldDistance(world, flight.player, heavy)).toBeCloseTo(CONTENT.tuning.talkRange - 0.25);
    flight.velocity = { x: -60, y: 0 };
    const task = structuredClone(model.state.tasks[5]);
    const economy = structuredClone(model.state.economy);
    const controls = new ControlState();
    controls.setUseAvailable(true);
    controls.requestUse();
    const sample = () =>
      consumeContextQuestUse(
        () => model.contextQuestDetails,
        () => {
          throw new Error("Details must only become eligible after movement");
        },
        controls.sample(),
      );
    const open = vi.fn();
    model.step(0.05, sample(), open);
    expect(worldDistance(world, flight.player, heavy)).toBeGreaterThan(CONTENT.tuning.talkRange);
    expect(worldDistance(world, flight.player, pip)).toBeLessThan(CONTENT.tuning.talkRange);
    expect(model.contextAction).toBeUndefined();
    const current = model.contextQuestDetails;
    expect(current?.targetId).toBe(pip.id);
    expect(current?.quests.map(({ id }) => id)).toEqual(["job:5:pip-delivery"]);
    expect(open).toHaveBeenCalledExactlyOnceWith(current);
    model.step(0.001, sample(), open);
    expect(open).toHaveBeenCalledTimes(1);
    expect(flight.objects.find(({ id }) => id === heavy.id)?.enemy?.salvaged).toBe(false);
    expect(model.state.dialogue).toBeNull();
    expect(model.state.tasks[5]).toEqual(task);
    expect(model.state.economy).toEqual(economy);
  });

  it("keeps Scan first, then exposes the existing linked details only within Use range", () => {
    const { model, site } = landmarkContext();
    expect(model.contextAction).toBe("scan");
    expect(model.contextQuestDetails).toBeNull();
    model.state.progress[1].charted.push(site.id);
    const before = structuredClone(model.state);
    const details = model.contextQuestDetails;
    expect(details?.targetId).toBe(site.id);
    expect(details?.quests.map(({ id }) => id)).toEqual(["job:1:held"]);
    expect(details?.quests[0]).toEqual(model.quests[0]);
    expect(model.state).toEqual(before);
    model.state.flight!.player.x += CONTENT.tuning.talkRange + 1;
    expect(model.contextQuestDetails).toBeNull();
  });

  it("answers the same charted landmark only when Use is pressed and preserves the real Scan", () => {
    const { model, site } = landmarkContext();
    delete model.state.tasks[1];
    const expected = LANDMARK_SCAN_COPY.outcomeRemembered.replace(
      "{target}",
      landmarkLabel((key) => CONTENT.labels[key] ?? "", site),
    );
    expect(model.useTarget).toEqual({ action: "scan", id: site.id });
    expect(model.state.notice).toBe("");
    model.interact();
    expect(model.drainScanOutcomes()).toMatchObject([{ target: { id: site.id } }]);
    expect(model.state.progress[1].charted).toEqual([site.id]);
    expect(model.state.notice).not.toBe(expected);
    expect(model.useTarget).toEqual({ action: "use", id: site.id });

    const progress = structuredClone(model.state.progress[1]);
    const economy = structuredClone(model.state.economy);
    const refusals = model.useRefusals;
    for (let press = 0; press < 2; press++) {
      model.dismissNotice();
      model.interact();
      expect(model.state.notice).toBe(expected);
      expect(model.state.dialogue).toBeNull();
      expect(model.state.progress[1]).toEqual(progress);
      expect(model.state.economy).toEqual(economy);
      expect(model.useRefusals).toBe(refusals);
      expect(model.drainScanOutcomes()).toEqual([]);
    }
    model.state.flight!.player.x += CONTENT.tuning.talkRange + 1;
    model.dismissNotice();
    expect(model.useTarget).toBeUndefined();
    model.interact();
    expect(model.state.notice).toBe("");
  });

  it("offers repeatable Dock on every visit even when the station is linked to a held quest", () => {
    const model = game();
    const flight = model.state.flight!;
    const site = worldStationsNear(flightStationContext(flight), ECONOMY, 1, 20000, {
      x: 0,
      y: 0,
    })[0]!;
    flight.player = { x: site.x, y: site.y };
    flight.objects = [{ ...site, hp: 1, kind: "station", radius: 1 }];
    model.state.progress[1].stations.push(site.id);
    model.state.tasks[1] = job("target", site.id);
    for (let visit = 0; visit < 2; visit++) {
      expect(model.contextAction).toBe("dock");
      expect(model.contextQuestDetails).toBeNull();
      model.interact();
      expect(model.state.docked).toBe(site.id);
      expect(model.contextQuestDetails).toBeNull();
      model.undock();
    }
  });

  it("does not replace a due hub action whose contextAction is undefined", () => {
    const model = game();
    const flight = createFlight(CONTENT, 2, 123, { known: [HUB_STATION] });
    model.state.flight = flight;
    model.state.selectedGalaxy = 2;
    model.state.progress[2].known.push(HUB_STATION);
    flight.storyScene = { at: flight.time, id: "blocked", lineDue: true };
    const hub = flight.objects.find(({ id }) => id === HUB_STATION)!;
    flight.player = { x: hub.x, y: hub.y };
    expect(model.contextAction).toBeUndefined();
    expect(model.contextQuestDetails).toBeNull();
    flight.cargo = 10;
    expect(model.contextAction).toBeUndefined();
    model.interact();
    expect(model.stationTalk).toBeNull();
    expect(model.state.docked).toBeNull();
    expect(model.state.progress[2]).toMatchObject({ deposited: 0, introduced: false, stage: 0 });
    expect(flight.cargo).toBe(10);
  });

  it("keeps dialogue and gameplay mode guards without mutating an accepted task", () => {
    const { model, site } = landmarkContext();
    model.state.progress[1].charted.push(site.id);
    expect(model.contextQuestDetails).not.toBeNull();
    model.state.mode = "home";
    expect(model.contextQuestDetails).toBeNull();
    model.state.mode = "space";
    model.state.dialogue = { choices: [], context: "talk", text: "Existing line", title: "Astra" };
    expect(model.contextQuestDetails).toBeNull();
    expect(model.state.tasks[1]).toEqual(job(site.id));
  });
});
