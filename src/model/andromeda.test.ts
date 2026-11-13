import { describe, expect, it } from "vitest";

import { ANDROMEDA_CONVERSATIONS, ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import {
  ANDROMEDA_PARTS,
  ANDROMEDA_RUNTIME,
  andromedaObjective,
  andromedaObjectiveIndex,
  chooseAndromeda,
  ensureAndromedaWorld,
  pageAndromedaWorld,
  stepAndromeda,
  useAndromeda,
  validAndromedaProgress,
} from "./andromeda.ts";
import { nearestSettlement, nearestSettlerStation } from "./andromedaPlaces.ts";
import type { ChapterContext, ChapterResult } from "./chapterProtocol.ts";
import { createFlight, ensureStation } from "./flight.ts";
import { newProgress } from "./progress.ts";
import type { DialogueState } from "./types.ts";

function fresh(): ChapterContext {
  const progress = newProgress();
  return { content: CONTENT, flight: createFlight(CONTENT, 5, 1234, progress), progress };
}

function last(context: ChapterContext, initial: ChapterResult | undefined): DialogueState {
  let panel = initial!.dialogue!;
  for (let count = 0; count < 20; count++) {
    const [, id, , index] = panel.context.split(":");
    const script = ANDROMEDA_CONVERSATIONS[id as keyof typeof ANDROMEDA_CONVERSATIONS];
    if (Number(index) === script.lines.length - 1) {
      return panel;
    }
    panel = chooseAndromeda(context, panel, "continue")!.dialogue!;
  }
  throw new Error("Conversation never finishes");
}

function finish(context: ChapterContext, initial: ChapterResult | undefined): ChapterResult {
  const panel = last(context, initial);
  return chooseAndromeda(context, panel, "continue")!;
}

function introduced(): ChapterContext {
  const context = fresh();
  const station = nearestSettlerStation(ECONOMY, context.flight.player);
  finish(context, useAndromeda(context, station.id));
  return context;
}

function confession(context: ChapterContext): string {
  const station = nearestSettlerStation(ECONOMY, context.flight.player);
  finish(context, useAndromeda(context, ANDROMEDA_PLACES.pip));
  return station.id;
}

describe("Andromeda chapter runtime", () => {
  it("starts at a real encountered station and waits for the final Continue", () => {
    const context = fresh();
    expect(stepAndromeda(context)).toBeUndefined();
    const station = nearestSettlerStation(ECONOMY, context.flight.player);
    ensureStation(CONTENT, station.id, context.flight);
    Object.assign(context.flight.player, station);
    context.progress.stations.push(station.id);
    const initial = stepAndromeda(context)!;
    expect(initial.dialogue?.text).toBe(ANDROMEDA_CONVERSATIONS.arrival.lines[0].text);
    expect(context.progress.stage).toBe(0);
    const panel = last(context, initial);
    expect(context.progress.stage).toBe(0);
    chooseAndromeda(context, panel, "continue");
    // A completed panel cannot replay its transition.
    expect(chooseAndromeda(context, panel, "continue")).toBeUndefined();
    expect(context.progress.introduced).toBe(true);
  });

  it("allows Pip's confession without making the optional dent inspection a prerequisite", () => {
    const context = introduced();
    Object.assign(context.flight.player, { x: 23000, y: -17000 });
    const expected = nearestSettlerStation(ECONOMY, context.flight.player);
    const initial = useAndromeda(context, "pip")!;
    expect(context.progress.stage).toBe(1);
    const panel = last(context, initial);
    expect(context.progress.stage).toBe(1);
    chooseAndromeda(context, panel, "continue");
    expect(context.progress.stage).toBe(3);
    expect(andromedaObjective(context)).toBe(expected.id);
    expect(context.flight.objects.some((object) => object.id === expected.id)).toBe(true);
    expect(chooseAndromeda(context, panel, "continue")).toBeUndefined();
    expect(useAndromeda(context, "darkBeacon")).toBeUndefined();
  });

  it("offers optional answers without consuming the final Continue or advancing the story", () => {
    const context = introduced();
    let panel = useAndromeda(context, "pip")!.dialogue!;
    for (let index = 1; index < ANDROMEDA_CONVERSATIONS.confession.lines.length; index++) {
      panel = chooseAndromeda(context, panel, "continue")!.dialogue!;
    }
    expect(context.progress.stage).toBe(1);
    const answer = chooseAndromeda(context, panel, "ask:0")!.dialogue!;
    expect(answer.text).toBe(ANDROMEDA_CONVERSATIONS.confession.questions[0].text);
    expect(context.progress.stage).toBe(1);
    const returned = chooseAndromeda(context, answer, "continue")!.dialogue!;
    expect(returned).toEqual(panel);
    expect(chooseAndromeda(context, panel, "ask:99")).toBeUndefined();
    chooseAndromeda(context, returned, "continue");
    expect(context.progress.stage).toBe(3);
  });

  it("captures a separate settlement from the accepted station and preserves the parts until repair", () => {
    const context = introduced();
    const stationId = confession(context);
    const station = nearestSettlerStation(ECONOMY, context.flight.player);
    const settlement = nearestSettlement(ECONOMY, station);
    expect(useAndromeda(context, "station:100,100")).toBeUndefined();
    finish(context, useAndromeda(context, stationId));
    expect(context.progress.stage).toBe(4);
    expect(andromedaObjective(context)).toBe(settlement.id);
    expect(context.flight.objects.find((object) => object.id === settlement.id)?.role).toBe(
      "settlement",
    );
    expect(useAndromeda(context, "settlement:100,100")).toBeUndefined();
    expect(useAndromeda(context, settlement.id)).toEqual({});
    expect(context.progress.questItem).toBe(ANDROMEDA_PARTS);
    expect(context.progress.stage).toBe(5);
    const initial = useAndromeda(context, "darkBeacon")!;
    expect(context.progress.questComplete).toBe(false);
    expect(context.progress.questItem).toBe(ANDROMEDA_PARTS);
    const result = finish(context, initial);
    expect(result).toEqual({ complete: true });
    expect(context.progress.questItem).toBeNull();
    expect(context.progress.stage).toBe(6);
    expect(context.progress.questComplete).toBe(false);
    expect(useAndromeda(context, "pip")).toBeUndefined();
    // Only the central model commits shared completion and holodisk effects.
    context.progress.questComplete = true;
    const handover = useAndromeda(context, "pip")!;
    expect(context.progress.holodisk).toBe(false);
    expect(finish(context, handover)).toEqual({ holodisk: { giver: "Pip" } });
    expect(context.progress.holodisk).toBe(false);
    context.progress.holodisk = true;
    expect(useAndromeda(context, "pip")).toBeUndefined();
    expect(andromedaObjective(context)).toBeNull();
    expect(andromedaObjectiveIndex(context.progress)).toBe(7);
  });

  it("rebinds saved trip targets in a fresh flight without changing objectives on read", () => {
    const original = introduced();
    const station = confession(original);
    finish(original, useAndromeda(original, station));
    const progress = JSON.parse(JSON.stringify(original.progress));
    expect(validAndromedaProgress(progress.andromeda)).toBe(true);
    const context: ChapterContext = {
      content: CONTENT,
      flight: createFlight(CONTENT, 5, 99, progress),
      progress,
    };
    const before = JSON.stringify(progress);
    const target = andromedaObjective(context);
    ensureAndromedaWorld(context);
    ensureAndromedaWorld(context);
    expect(JSON.stringify(progress)).toBe(before);
    const places = context.flight.objects.filter((object) => object.id === target);
    expect(places).toHaveLength(1);
    expect(places[0]?.kind).toBe("destination");
    expect(places[0]?.role).toBe("settlement");
    expect(validAndromedaProgress({ station: "hub" })).toBe(false);
    expect(validAndromedaProgress({ settlement: "station:1,1" })).toBe(false);
    expect(validAndromedaProgress({ extra: 1 })).toBe(false);
  });

  it("pages separate outposts across world chunks and leaves other chapters untouched", () => {
    const context = fresh();
    const site = nearestSettlement(ECONOMY, context.flight.player);
    Object.assign(context.flight.player, site);
    pageAndromedaWorld(context);
    expect(context.flight.objects.find((object) => object.id === site.id)).toMatchObject({
      kind: "destination",
      role: "settlement",
      x: site.x,
      y: site.y,
    });
    const count = context.flight.objects.length;
    pageAndromedaWorld(context);
    expect(context.flight.objects).toHaveLength(count);
    const elsewhere: ChapterContext = { ...context, flight: { ...context.flight, galaxy: 1 } };
    const before = JSON.stringify(elsewhere);
    ANDROMEDA_RUNTIME.init!(elsewhere);
    ANDROMEDA_RUNTIME.beforeStep!(elsewhere, 1);
    expect(useAndromeda(elsewhere, "pip")).toBeUndefined();
    expect(stepAndromeda(elsewhere)).toBeUndefined();
    expect(JSON.stringify(elsewhere)).toBe(before);
  });
});
