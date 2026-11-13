import { describe, expect, it } from "vitest";

import { ANDROMEDA_CONVERSATIONS, ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import {
  ANDROMEDA_PARTS,
  ANDROMEDA_RUNTIME,
  andromedaAction,
  andromedaConversation,
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

function fresh(): ChapterContext {
  const progress = newProgress();
  return { content: CONTENT, flight: createFlight(CONTENT, 5, 1234, progress), progress };
}

function finish(context: ChapterContext, initial: ChapterResult | undefined): ChapterResult {
  return chooseAndromeda(context, initial!.dialogue!, "continue")!;
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
    for (const line of ANDROMEDA_CONVERSATIONS.arrival.lines) {
      expect(initial.dialogue?.text).toContain(`${line.speaker}: ${line.text}`);
    }
    expect(initial.dialogue?.context).toBe("andromeda:arrival");
    expect(initial.dialogue?.title).toBe("Wick");
    expect(context.progress.stage).toBe(0);
    const panel = initial.dialogue!;
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
    const panel = initial.dialogue!;
    expect(context.progress.stage).toBe(1);
    chooseAndromeda(context, panel, "continue");
    expect(context.progress.stage).toBe(3);
    expect(andromedaObjective(context)).toBe(expected.id);
    expect(context.flight.objects.some((object) => object.id === expected.id)).toBe(true);
    expect(chooseAndromeda(context, panel, "continue")).toBeUndefined();
    expect(useAndromeda(context, "darkBeacon")).toBeUndefined();
  });

  it("keeps optional questions local and commits only the whole panel's Continue", () => {
    const context = introduced();
    const panel = useAndromeda(context, "pip")!.dialogue!;
    expect(panel.context).toBe("andromeda:confession");
    expect(panel.title).toBe("Pip");
    expect(panel.choices).toEqual([{ id: "continue", label: CONTENT.labels.continue }]);
    const before = JSON.stringify(context.progress);
    expect(andromedaConversation(context.progress, "confession").questions).toEqual(
      ANDROMEDA_CONVERSATIONS.confession.questions,
    );
    expect(chooseAndromeda(context, panel, "ask:0")).toBeUndefined();
    expect(chooseAndromeda(context, panel, "skip")).toBeUndefined();
    expect(JSON.stringify(context.progress)).toBe(before);
    chooseAndromeda(context, panel, "continue");
    expect(context.progress.stage).toBe(3);
  });

  it("uses the approved confession for both approach orders without adding an inspection gate", () => {
    const direct = introduced();
    const unseen = useAndromeda(direct, "pip")!.dialogue!;
    expect(unseen.text).toContain("Pip, do you know what happened to the beacon?");
    expect(unseen.text).toContain("Pip: It was me. I was late, I flew too fast, and I clipped it.");
    expect(unseen.text).not.toContain("You saw the dent?");
    const inspected = introduced();
    finish(inspected, useAndromeda(inspected, "darkBeacon"));
    expect(inspected.progress.stage).toBe(2);
    const seen = useAndromeda(inspected, "pip")!.dialogue!;
    expect(seen.text).toContain("Pip, did you see the dent in the beacon?");
    expect(seen.text).toContain("You saw the dent? It was me.");
    for (const line of ANDROMEDA_CONVERSATIONS.confession.lines.slice(2)) {
      expect(unseen.text).toContain(line.text);
      expect(seen.text).toContain(line.text);
    }
    finish(direct, { dialogue: unseen });
    finish(inspected, { dialogue: seen });
    expect(direct.progress.stage).toBe(3);
    expect(inspected.progress.stage).toBe(3);
  });

  it("reports due Talk and Deliver actions without changing state or replacing normal docking", () => {
    const context = fresh();
    const station = nearestSettlerStation(ECONOMY, context.flight.player);
    let before = JSON.stringify(context);
    expect(andromedaAction(context, station.id)).toBe("talk");
    expect(JSON.stringify(context)).toBe(before);
    finish(context, useAndromeda(context, station.id));
    expect(andromedaAction(context, station.id)).toBeUndefined();
    expect(andromedaAction(context, "pip")).toBe("talk");
    confession(context);
    const stationId = andromedaObjective(context)!;
    expect(andromedaAction(context, stationId)).toBe("talk");
    finish(context, useAndromeda(context, stationId));
    const settlement = andromedaObjective(context)!;
    before = JSON.stringify(context);
    expect(andromedaAction(context, settlement)).toBe("deliver");
    expect(andromedaAction(context, "darkBeacon")).toBeUndefined();
    expect(JSON.stringify(context)).toBe(before);
    useAndromeda(context, settlement);
    expect(andromedaAction(context, "darkBeacon")).toBe("deliver");
    finish(context, useAndromeda(context, "darkBeacon"));
    context.progress.questComplete = true;
    expect(andromedaAction(context, "pip")).toBe("talk");
    context.progress.holodisk = true;
    expect(andromedaAction(context, "pip")).toBeUndefined();
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
