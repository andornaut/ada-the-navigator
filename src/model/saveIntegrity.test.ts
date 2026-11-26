import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { createAdaSaves, SAVE_KEYS } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { routeBlocked, routeGuardPlanResult } from "./flight.ts";
import { GameModel, newGameState } from "./game.ts";
import { readRequiredPlan } from "./requiredEncounterPlans.ts";
import { restoreSave, SAVE_VERSION } from "./save.ts";
import { inspectAdaSave, preV1SaveResetAllowed } from "./saveIntegrity.ts";

describe("Ada save integrity policy", () => {
  it("limits reset permission to explicit pre-v1 application versions", () => {
    expect(preV1SaveResetAllowed()).toBe(true);
    expect(preV1SaveResetAllowed("0.9.1-rc.2")).toBe(true);
    for (const version of ["1.0.0", "13", "0", "unknown", "0.01.2"]) {
      expect(preV1SaveResetAllowed(version)).toBe(false);
    }
  });
  it("preserves a valid home save and distinguishes first visit from corrupt data", () => {
    const state = newGameState();
    const raw = JSON.stringify(state);
    expect(inspectAdaSave(null)).toEqual({ status: "new" });
    expect(inspectAdaSave(raw)).toEqual({ save: state, status: "valid" });
    expect(JSON.stringify(state)).toBe(raw);
    for (const invalid of [
      "",
      "{broken",
      "null",
      "{}",
      JSON.stringify({ ...state, version: SAVE_VERSION + 1 }),
    ]) {
      expect(inspectAdaSave(invalid)).toEqual({ problem: "invalid-save", status: "issue" });
    }
  });
});

function legacyOpener() {
  const model = new GameModel(CONTENT, supportEntropy);
  model.startGalaxy(1);
  const flight = model.state.flight!,
    progress = model.state.progress[1];
  const pending = structuredClone(readRequiredPlan(flight, "growers")!);
  delete flight.requiredPlans;
  progress.known = ["growers"];
  progress.introduced = false;
  progress.stage = 0;
  flight.objects.push(pending.site);
  return { flight, model, pending, progress };
}

it.each([false, true])(
  "resets an unknown known-opener guard with admissionRecorded=%s",
  async (admissionRecorded) => {
    const { flight, model } = legacyOpener();
    if (admissionRecorded) {
      flight.combat ??= { initialPackSizes: {}, routeEncounters: [] };
      flight.combat.routeEncounters = ["growers"];
    }
    const raw = model.save();
    expect(restoreSave(raw)).not.toBeNull();
    expect(routeGuardPlanResult(flight, "growers")).toEqual({
      admissionRecorded,
      status: "unknown",
    });
    expect(routeBlocked("growers", flight)).toBe(false);
    expect(inspectAdaSave(raw)).toEqual({ problem: "invalid-save", status: "issue" });
    const values = new Map<string, string>([[SAVE_KEYS.save, raw]]);
    const store = createAdaSaves({
      read: async (key) => values.get(key) ?? null,
      write: async (key, value) => {
        values.set(key, value);
      },
    });
    const loaded = await store.load();
    expect(loaded.status).toBe("loaded");
    expect(loaded.save).toEqual(newGameState());
    expect(values.get(SAVE_KEYS.backup)).toBe(raw);
  },
);
it("preserves legitimate legacy progression, pending ownership and actual casualty evidence", () => {
  const { model, pending } = legacyOpener();
  const source = model.saveDocument();
  const allowed = [
    (save: typeof source) => {
      save.progress[1].introduced = true;
      save.progress[1].stage = 1;
    },
    (save: typeof source) => {
      save.progress[1].known = [];
    },
    (save: typeof source) => {
      save.progress[1].questComplete = true;
    },
    (save: typeof source) => {
      save.flight!.world.notables["route:growers"] = null;
    },
    (save: typeof source) => {
      save.flight!.objects.push(structuredClone(pending.leader));
    },
    (save: typeof source) => {
      const actor = structuredClone(pending.leader);
      actor.hp = 0;
      actor.enemy!.hp = 0;
      save.flight!.objects.push(actor);
    },
    (save: typeof source) => {
      const actor = structuredClone(pending.leader);
      actor.enemy!.disabled = true;
      save.flight!.world.notables[actor.id] = actor;
    },
    (save: typeof source) => {
      save.flight!.objects = save.flight!.objects.filter(({ id }) => id !== "growers");
      save.flight!.requiredPlans = { growers: pending };
    },
  ];
  for (const edit of allowed) {
    const save = structuredClone(source);
    edit(save);
    expect(restoreSave(save)).not.toBeNull();
    expect(inspectAdaSave(JSON.stringify(save))).toEqual({ save, status: "valid" });
  }
});
