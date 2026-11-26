import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { questReward } from "../data/questRewards.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { ensureStation } from "./flight.ts";
import { GameModel } from "./game.ts";
import { landmarkById, landmarkLabel, landmarkSites } from "./landmarks.ts";
import { stationsNear } from "./stations.ts";

function fixture() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
  model.startGalaxy(1);
  const flight = model.state.flight!;
  const station = stationsNear(ECONOMY, 1, 20000, { x: 0, y: 0 }).sort(
    (a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y),
  )[0]!;
  ensureStation(CONTENT, station.id, flight);
  model.state.progress[1].stations.push(station.id);
  flight.player = { x: station.x, y: station.y };
  model.state.docked = station.id;
  const survey = model.jobBoard().find((row) => row.type === "survey")!;
  expect(survey).toBeDefined();
  const offer = model.state.jobs.boards[1]![station.id]!.find((row) => row.id === survey.id)!;
  return { flight, model, offer, station };
}
function scan(model: GameModel, targetId: string): void {
  model.state.docked = null;
  model.state.dialogue = null;
  const site = landmarkById(1, targetId)!;
  model.state.flight!.player = { x: site.x, y: site.y };
  expect(model.contextAction).toBe("scan");
  model.interact();
}

it("remembers a real scan across Continue and pays an explicitly accepted later survey once without revisiting", () => {
  const { model, offer, station } = fixture();
  const beforeScan = model.state.economy.stardust;
  scan(model, offer.target.id);
  expect(model.state.progress[1].charted).toContain(offer.target.id);
  expect(model.state.tasks[1]).toBeUndefined();
  expect(model.state.economy.stardust).toBe(beforeScan);
  const ordinary = model.drainScanOutcomes();
  expect(ordinary).toHaveLength(1);
  expect(ordinary[0]).toMatchObject({ completions: [], source: "scan", targetId: offer.target.id });
  const resumed = relaunch(CONTENT, model.save());
  expect(resumed.state.flight).not.toBeNull();
  resumed.state.flight!.player = { x: station.x, y: station.y };
  resumed.state.docked = station.id;
  expect(resumed.jobBoard().some((row) => row.id === offer.id)).toBe(true);
  const beforeReward = resumed.state.economy.stardust;
  expect(resumed.acceptJob(offer.id)).toBe("accepted");
  expect(resumed.state.tasks[1]).toBeUndefined();
  expect(resumed.state.economy.stardust - beforeReward).toBe(questReward(offer.reward));
  const outcomes = resumed.drainScanOutcomes();
  expect(outcomes).toHaveLength(1);
  expect(outcomes[0]).toMatchObject({
    completions: [
      {
        kind: "quest",
        quest: {
          icon: { jobType: "survey", symbol: "job" },
          id: `job:1:${offer.id}`,
          name: resumed.jobText(offer).title,
        },
      },
    ],
    source: "remembered",
    targetId: offer.target.id,
  });
  expect(outcomes[0]!.completions[0]).not.toHaveProperty("task");
  expect(Object.isFrozen(outcomes)).toBe(true);
  expect(Object.isFrozen(outcomes[0])).toBe(true);
  expect(Object.isFrozen(outcomes[0]!.target)).toBe(true);
  expect(Object.isFrozen(outcomes[0]!.completions[0]!.quest.icon)).toBe(true);
  expect(resumed.acceptJob(offer.id)).toBe("missing");
  expect(resumed.state.economy.stardust - beforeReward).toBe(questReward(offer.reward));
  expect(resumed.drainScanOutcomes()).toEqual([]);
  const again = relaunch(CONTENT, resumed.save());
  expect(again.state.economy.stardust).toBe(resumed.state.economy.stardust);
  expect(again.state.tasks[1]).toBeUndefined();
  expect(again.drainScanOutcomes()).toEqual([]);
});

it("reports actual full survey completion on a live scan and keeps ordinary scan facts separate", () => {
  const { model, offer } = fixture();
  expect(model.acceptJob(offer.id)).toBe("accepted");
  const entry = model.quests.find((quest) => quest.jobType === "survey")!;
  expect(model.state.tasks[1]?.id).toBe(offer.id);
  expect(model.drainScanOutcomes()).toEqual([]);
  const before = model.state.economy.stardust;
  scan(model, offer.target.id);
  expect(model.state.tasks[1]).toBeUndefined();
  expect(model.state.economy.stardust - before).toBe(questReward(offer.reward));
  const site = landmarkById(1, offer.target.id)!;
  const [outcome] = model.drainScanOutcomes();
  expect(outcome).toMatchObject({
    completions: [{ kind: "quest", quest: { id: entry.id } }],
    source: "scan",
    target: {
      id: site.id,
      name: landmarkLabel((key) => CONTENT.labels[key] ?? key, site),
      symbol: site.kind,
    },
  });
  model.interact();
  expect(model.drainScanOutcomes()).toEqual([]);
  expect(model.state.progress[1].charted.filter((id) => id === site.id)).toHaveLength(1);
});

it("matches only the accepted target ID and does not complete, accept or replace another quest", () => {
  const { model, offer } = fixture();
  const other = landmarkSites(1).find((site) => site.id !== offer.target.id)!;
  scan(model, other.id);
  expect(model.drainScanOutcomes()[0]!.completions).toEqual([]);
  expect(model.state.tasks[1]).toBeUndefined();
  model.state.docked = offer.station;
  const before = model.state.economy.stardust;
  expect(model.acceptJob(offer.id)).toBe("accepted");
  expect(model.state.tasks[1]?.id).toBe(offer.id);
  expect(model.state.economy.stardust).toBe(before);
  expect(model.drainScanOutcomes()).toEqual([]);
  const second = model.jobBoard().find((row) => row.id !== offer.id)!;
  expect(model.acceptJob(second.id)).toBe("busy");
  expect(model.state.tasks[1]?.id).toBe(offer.id);
  scan(model, offer.target.id);
  expect(model.state.tasks[1]).toBeUndefined();
  expect(model.state.economy.stardust - before).toBe(questReward(offer.reward));
});

it("reconciles an accepted saved survey immediately on Continue and never pays it again", () => {
  const { model, offer } = fixture();
  expect(model.acceptJob(offer.id)).toBe("accepted");
  model.state.progress[1].charted.push(offer.target.id);
  const before = model.state.economy.stardust;
  const resumed = relaunch(CONTENT, model.save());
  expect(resumed.state.tasks[1]).toBeUndefined();
  expect(resumed.state.economy.stardust - before).toBe(questReward(offer.reward));
  expect(resumed.drainScanOutcomes()).toMatchObject([
    { completions: [{ kind: "quest" }], source: "remembered", targetId: offer.target.id },
  ]);
  const again = relaunch(CONTENT, resumed.save());
  expect(again.state.economy.stardust).toBe(resumed.state.economy.stardust);
  expect(again.drainScanOutcomes()).toEqual([]);
});
