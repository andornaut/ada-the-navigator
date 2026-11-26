import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { createFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { flightLandmarkSites } from "./landmarks.ts";
import type { QuestEntry } from "./questDetails.ts";
import { questsForObject, taskMarkerCategory } from "./questObjectLinks.ts";
import { HUB_STATION, stationsNear } from "./stations.ts";
import type { HeldJob } from "./types.ts";

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
  const model = new GameModel(CONTENT, supportEntropy);
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

  it("offers repeatable Dock on every visit even when the station is linked to a held quest", () => {
    const model = game();
    const site = stationsNear(ECONOMY, 1, 20000, { x: 0, y: 0 })[0]!;
    const flight = model.state.flight!;
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
