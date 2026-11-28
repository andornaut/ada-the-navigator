import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { supportEntropy } from "../testing/launch.ts";
import { GameModel } from "./game.ts";
import { type ShopItem, shopRowState } from "./shop.ts";
import { stationSpecialty } from "./stations/commerce/index.ts";
import { flightStationContext, type StationSite, worldStationsNear } from "./stations/index.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function dock(model: GameModel, site: StationSite) {
  const flight = model.state.flight!;
  flight.player = { x: site.x, y: site.y };
  flight.objects = [{ ...site, hp: 1, kind: "station", radius: 80 }];
  model.interact();
  expect(model.state.docked).toBe(site.id);
}

function outfitter() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.unlocked = [1, 2];
  model.state.economy.stardust = 100_000;
  model.startGalaxy(1);
  const flight = model.state.flight!;
  const site = worldStationsNear(
    flightStationContext(flight),
    ECONOMY,
    1,
    40_000,
    flight.player,
  ).find(({ id }) => stationSpecialty(1, id) === "equipment")!;
  expect(site).toBeDefined();
  model.state.progress[1].stations.push(site.id);
  dock(model, site);
  const row = model.shopRows("ship").find(({ item }) => item.kind === "track")!;
  expect(row).toBeDefined();
  return { model, row, site };
}

function purchase(model: GameModel, item: ShopItem) {
  const balance = model.state.economy.stardust;
  model.state.economy.stardust = 0;
  expect(model.buy(item)).toEqual({ kind: "refused", reason: "cantAfford" });
  expect(model.state.stationRestock).toBeUndefined();
  model.state.economy.stardust = balance;
  expect(model.requestPurchase(item).kind).toBe("confirm");
  expect(model.saveDocument()).not.toHaveProperty("stationRestock");
  expect(model.buy(item).kind).toBe("bought");
}

function jump(model: GameModel, galaxy: GalaxyNumber) {
  expect(model.openGalaxyMap()).toBe(true);
  model.viewGalaxy(ROUTE_POSITION[galaxy]);
  expect(model.jump()).toBe(true);
  expect(model.state.flight?.galaxy).toBe(galaxy);
}

describe("station restock through GameModel and the save codec", () => {
  it("keeps the purchased row through Continue and rotates it only on a later eligible dock", () => {
    const { model, row, site } = outfitter();
    const findRow = (game: GameModel) =>
      game.shopRows("ship").find(({ item }) => JSON.stringify(item) === JSON.stringify(row.item));
    purchase(model, row.item);
    const purchased = findRow(model)!;
    expect(shopRowState(model.state.economy.stardust, purchased)).toBe("owned");
    expect(purchased.level?.current).toBe(row.level!.current + 1);
    expect(model.requestPurchase(row.item)).toEqual({ kind: "refused", reason: "notForSale" });
    model.step(30, idle);
    expect(model.state.stationRestock?.flightSeconds).toBe(0);

    // Resume a real save with most of the cooldown already spent.
    const save = JSON.parse(model.save());
    save.stationRestock.flightSeconds = 299.9;
    const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, save);
    expect(resumed.screen).toBe("start");
    resumed.step(30, idle);
    expect(resumed.state.stationRestock?.flightSeconds).toBe(299.9);
    resumed.continueGame();
    expect(resumed.state.docked).toBe(site.id);
    expect(findRow(resumed)).toEqual(purchased);
    resumed.undock();
    dock(resumed, site);
    expect(findRow(resumed)).toEqual(purchased);
    expect(resumed.buy(row.item)).toEqual({ kind: "refused", reason: "notForSale" });

    resumed.undock();
    jump(resumed, 2);
    const flight = resumed.state.flight!;
    const before = flight.time;
    resumed.step(0.15, idle);
    expect(resumed.state.stationRestock!.flightSeconds - 299.9).toBeCloseTo(flight.time - before);
    expect(resumed.state.stationRestock!.flightSeconds).toBeGreaterThan(300);
    resumed.state.dialogue = null;
    jump(resumed, 1);
    dock(resumed, site);
    expect(findRow(resumed)).toBeUndefined();
    const replacement = resumed.shopRows("ship").find(({ item, price }) => {
      return (
        price !== null &&
        !model.shopRows("ship").some((base) => JSON.stringify(base.item) === JSON.stringify(item))
      );
    });
    expect(replacement).toBeDefined();
    expect(resumed.requestPurchase(replacement!.item).kind).toBe("confirm");
    expect(restoreSave(resumed.save())?.stationRestock).toEqual(resumed.state.stationRestock);
  });

  it("counts only simulated slices when depletion interrupts a step", () => {
    const { model, row } = outfitter();
    purchase(model, row.item);
    model.undock();
    const flight = model.state.flight!;
    endArrivalGrace(flight);
    flight.shield = 0.1;
    flight.shots.push({
      ...flight.player,
      damage: 1,
      enemy: true,
      hitIds: [],
      id: "restock-depletion",
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    });
    const before = flight.time;
    model.step(0.2, idle);
    const elapsed = flight.time - before;
    expect(model.state.flight).toBeNull();
    expect(elapsed).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(0.2);
    expect(model.state.stationRestock?.flightSeconds).toBe(elapsed);
  });

  it("keeps old saves and rejects impossible saved slots, items, duplicate offers and snapshots", () => {
    const { model, row, site } = outfitter();
    expect(restoreSave(model.save())).not.toHaveProperty("stationRestock");
    purchase(model, row.item);
    const document = model.saveDocument();
    const stationKey = JSON.stringify([1, site.id]);
    const slots = document.stationRestock!.stations[stationKey]!;
    const [slot] = Object.keys(slots);
    const entry = Object.values(slots)[0]!;
    const other = model.shopRows("ship").find(({ purchased }) => !purchased)!;
    expect(restoreSave(document)?.stationRestock).toEqual(document.stationRestock);

    const withSlots = (changed: unknown) => ({
      ...document,
      stationRestock: { ...document.stationRestock, stations: { [stationKey]: changed } },
    });
    for (const malformed of [
      { ["equipment:99"]: entry },
      { [slot!]: { ...entry, item: { kind: "track", track: "__proto__" } } },
      { [slot!]: { ...entry, item: { kind: "holodisk" } } },
      { [slot!]: { ...entry, purchased: { ...entry.purchased, availableAfter: 301 } } },
      { [slot!]: { ...entry, purchased: { ...entry.purchased, level: { current: 99, max: 99 } } } },
      { [slot!]: { item: other.item } },
    ]) {
      expect(restoreSave(withSlots(malformed))).toBeNull();
    }
  });
});
