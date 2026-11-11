import { createUpdateFlow } from "@andornaut/game-kit/web/pwa/dom/updateReady";
import { describe, expect, it, vi } from "vitest";

import { createUpdateOffer, trackStartScreen } from "./updateOffer.ts";

// The kit's update flow on a page an older version controls, with a newer one waiting or not,
// wired the way index.ts wires it.
function updating(waiting: boolean) {
  const container = Object.assign(new EventTarget(), { controller: {} });
  const worker = Object.assign(new EventTarget(), {
    postMessage: vi.fn(() => container.dispatchEvent(new Event("controllerchange"))),
    state: "installed",
  });
  const registration = Object.assign(new EventTarget(), {
    installing: null,
    update: () => Promise.resolve(),
    waiting: waiting ? worker : null,
  });
  const reload = vi.fn();
  const shown = vi.fn();
  let accept = () => undefined as void;
  let dismiss = () => undefined as void;
  const offer = createUpdateOffer(
    () => accept(),
    () => dismiss(),
  );
  offer.subscribe(shown);
  const flow = createUpdateFlow(
    container,
    () => 0,
    () => true,
    reload,
    offer.setVisible,
    {
      activationPolicy: "manual",
    },
  );
  accept = () => flow.accept();
  dismiss = () => flow.dismissOffer();
  const start = trackStartScreen(flow.setOfferVisible);
  flow.noteInteraction();
  flow.watch(registration);
  return { flow, offer, reload, shown, start, worker };
}

describe("start-screen update offer", () => {
  it("shows only on the start screen while a newer version waits", () => {
    const idle = updating(false);
    idle.start.shown(true);
    expect(idle.shown).toHaveBeenLastCalledWith(false);
    const waiting = updating(true);
    expect(waiting.shown).toHaveBeenLastCalledWith(false);
    waiting.start.shown(true);
    expect(waiting.shown).toHaveBeenLastCalledWith(true);
    waiting.start.shown(false);
    expect(waiting.shown).toHaveBeenLastCalledWith(false);
  });

  it("is suppressed while Settings or the cheats card cover the start screen", () => {
    const { shown, start } = updating(true);
    start.shown(true);
    start.cover("settings", true);
    expect(shown).toHaveBeenLastCalledWith(false);
    start.cover("cheats", true);
    start.cover("settings", false);
    expect(shown).toHaveBeenLastCalledWith(false);
    start.cover("cheats", false);
    expect(shown).toHaveBeenLastCalledWith(true);
  });

  it("defers for the rest of the visit and offers again on the next visit", () => {
    const { flow, offer, reload, shown, start } = updating(true);
    start.shown(true);
    offer.defer();
    expect(shown).toHaveBeenLastCalledWith(false);
    start.cover("settings", true);
    start.cover("settings", false);
    expect(shown).toHaveBeenLastCalledWith(false);
    start.shown(false);
    flow.beginOfferVisit();
    start.shown(true);
    expect(shown).toHaveBeenLastCalledWith(true);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads into the waiting version only on Update now", () => {
    const { offer, reload, start, worker } = updating(true);
    start.shown(true);
    offer.accept();
    expect(worker.postMessage).toHaveBeenCalledWith("skip-waiting");
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("native update offer bridge", () => {
  it.each(["accept", "defer"] as const)(
    "delegates %s once only while its controls are visible",
    (action) => {
      const accept = vi.fn();
      const dismiss = vi.fn();
      const shown = vi.fn();
      const offer = createUpdateOffer(accept, dismiss);
      offer.subscribe(shown);
      offer[action]();
      expect(accept).not.toHaveBeenCalled();
      expect(dismiss).not.toHaveBeenCalled();
      offer.setVisible(true);
      offer[action]();
      offer[action]();
      expect(shown.mock.calls).toEqual([[false], [true], [false]]);
      expect(accept).toHaveBeenCalledTimes(action === "accept" ? 1 : 0);
      expect(dismiss).toHaveBeenCalledTimes(action === "defer" ? 1 : 0);
    },
  );

  it("stops calling a listener once it unsubscribes", () => {
    const offer = createUpdateOffer(vi.fn(), vi.fn());
    const shown = vi.fn();
    offer.subscribe(shown)();
    offer.setVisible(true);
    expect(shown.mock.calls).toEqual([[false]]);
  });
});
