import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { questReward } from "../data/questRewards.ts";
import { relaunch } from "../testing/launch.ts";
import type { ExchangePreview, ExchangeQuote } from "./exchange.ts";
import { ensureDestination, ensureStation } from "./flight.ts";
import { GameModel } from "./game.ts";
import { stationsNear } from "./stations.ts";

function quote(preview: ExchangePreview): ExchangeQuote {
  expect(preview.kind).toBe("quote");
  if (preview.kind !== "quote") {
    throw Error(preview.reason);
  }
  return preview;
}
function docked() {
  const model = new GameModel(CONTENT);
  model.state.prologueSeen = true;
  model.startGalaxy(1);
  const flight = model.state.flight!;
  flight.objects = [];
  const site = stationsNear(ECONOMY, 1, 40000, flight.player)[0]!;
  ensureStation(CONTENT, site.id, flight);
  model.state.progress[1].stations.push(site.id);
  flight.player = { x: site.x, y: site.y };
  flight.cargo = 3;
  model.state.economy.stardust = 20;
  model.interact();
  expect(model.state.docked).toBe(site.id);
  return model;
}

describe("confirmed station ore Exchange", () => {
  it("buys and sells the same ore, losing one Stardust per unit on a round trip", () => {
    const model = docked();
    const beforeProgress = structuredClone(model.state.progress);
    const buy = quote(model.previewExchange({ amount: 5, direction: "buy" }));
    expect(model.state.flight!.cargo).toBe(3);
    expect(model.confirmExchange(buy).kind).toBe("quote");
    expect(model.state.flight!.cargo).toBe(8);
    expect(model.state.economy.stardust).toBe(10);
    expect(model.confirmExchange(buy)).toEqual({ kind: "refused", reason: "stale" });
    expect(model.state.flight!.cargo).toBe(8);
    const sell = quote(model.previewExchange({ amount: 5, direction: "sell" }));
    expect(model.confirmExchange(sell).kind).toBe("quote");
    expect(model.state.flight!.cargo).toBe(3);
    expect(model.state.economy.stardust).toBe(15);
    expect(model.state.progress).toEqual(beforeProgress);
    expect(model.flightEvents).toEqual([]);
    expect(model.drainPickupFeedback()).toEqual([]);
  });

  it("rejects undocked or stale confirmation without changing either balance", () => {
    const model = docked();
    const buy = quote(model.previewExchange({ amount: 2, direction: "buy" }));
    model.state.economy.stardust -= 1;
    expect(model.confirmExchange(buy)).toEqual({ kind: "refused", reason: "stale" });
    expect(model.state.flight!.cargo).toBe(3);
    expect(model.state.economy.stardust).toBe(19);
    model.undock();
    expect(model.previewExchange({ amount: 1, direction: "buy" })).toEqual({
      kind: "refused",
      reason: "unavailable",
    });
    expect(model.confirmExchange(buy)).toEqual({ kind: "refused", reason: "unavailable" });
    expect(model.state.flight!.cargo).toBe(3);
    expect(model.state.economy.stardust).toBe(19);
  });

  it("preserves the fungible balances across Continue, reload and an ordinary trip home", () => {
    const model = docked();
    model.confirmExchange(quote(model.previewExchange({ amount: 5, direction: "buy" })));
    model.backToTitle();
    model.continueGame();
    expect(model.state.flight!.cargo).toBe(8);
    const loaded = relaunch(CONTENT, model.save());
    expect(loaded.state.flight!.cargo).toBe(8);
    expect(loaded.state.economy.stardust).toBe(10);
    loaded.undock();
    loaded.returnHome();
    expect(loaded.state.economy.cargo).toBe(8);
    expect(loaded.state.economy.stardust).toBe(10);
    expect(Object.hasOwn(loaded.state.economy, "boughtOre")).toBe(false);
  });

  it("applies the existing mining deposit rules to ore bought at the hub", () => {
    const model = new GameModel(CONTENT);
    model.state.prologueSeen = true;
    model.state.unlocked = [1, 2];
    model.startGalaxy(2);
    Object.assign(model.state.progress[2], {
      holodisk: true,
      introduced: true,
      known: ["hub"],
      opened: true,
      questComplete: true,
      resolved: true,
      stage: 5,
    });
    const flight = model.state.flight!;
    flight.objects = [];
    const hub = ensureDestination(CONTENT, "hub", flight);
    flight.player = { x: hub.x, y: hub.y };
    flight.velocity = { x: 0, y: 0 };
    model.state.economy.stardust = 100;
    model.interact();
    expect(model.acceptJob("miningContract")).toBe("accepted");
    const baseReward = model.state.tasks[2]!.reward;
    const before = model.state.progress[2].deposited;
    const progress = structuredClone(model.state.progress);
    const achievements = structuredClone(model.state.achievements);
    model.confirmExchange(quote(model.previewExchange({ amount: 30, direction: "buy" })));
    const afterPurchase = model.state.economy.stardust;
    expect(afterPurchase).toBe(40);
    expect(model.state.progress).toEqual(progress);
    expect(model.state.achievements).toEqual(achievements);
    model.undock();
    model.interact();
    expect(model.state.progress[2].deposited).toBe(before + 30);
    expect(model.state.tasks[2]).toBeUndefined();
    expect(flight.cargo).toBe(0);
    expect(model.state.economy.stardust).toBe(afterPurchase + questReward(baseReward));
  });
});
