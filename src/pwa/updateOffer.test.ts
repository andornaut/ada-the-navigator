import { createUpdateFlow } from "@andornaut/game-kit/web/pwa/dom/updateReady";
import { describe, expect, it, vi } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { GameModel } from "../model/game.ts";
import { playOpening } from "../testing/launch.ts";
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
    active: null,
    installing: null,
    update: vi.fn(() => Promise.resolve()),
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
    { container, now: () => 0, online: () => true, reload, session: undefined },
    () => Promise.resolve(),
    { onRequireNewer: vi.fn(), onUpdateShown: offer.setVisible },
  );
  accept = () => flow.accept();
  dismiss = () => flow.dismissOffer();
  const start = trackStartScreen(flow.setOfferVisible);
  flow.noteInteraction();
  flow.watch(registration);
  return { flow, offer, registration, reload, shown, start, worker };
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

  it("keeps a cancelled offer hidden for the page's lifetime, checking at every arrival", () => {
    const { offer, registration, reload, shown, start } = updating(true);
    // The model's screen drives the start screen as the scene does, each arrival a transition.
    const model = new GameModel(PROTOTYPE);
    const follow = () => start.shown(model.screen === "start");
    follow();
    expect(shown).toHaveBeenLastCalledWith(true);
    offer.defer();
    expect(shown).toHaveBeenLastCalledWith(false);
    // Settings covering the start screen and closing again keep it hidden.
    start.cover("settings", true);
    start.cover("settings", false);
    expect(shown).toHaveBeenLastCalledWith(false);
    const checks = () => registration.update.mock.calls.length;
    const arrivals: string[] = [];
    const arrive = (how: string) => {
      const before = checks();
      follow();
      expect(model.screen, how).toBe("start");
      expect(checks(), `${how} checks for a version`).toBe(before + 1);
      expect(shown, `${how} keeps the offer hidden`).toHaveBeenLastCalledWith(false);
      arrivals.push(how);
    };
    // Back to title from flight.
    model.startSector(1);
    playOpening(model);
    follow();
    model.backToTitle();
    arrive("Back to title");
    // Back to title from Ada's room page.
    model.state.progress[1].opened = true;
    model.state.prologueSeen = true;
    model.startSector(1);
    model.state.flight!.objects = [];
    model.returnHome();
    follow();
    expect(model.roomPage).toBe(true);
    model.backToTitle();
    arrive("the return from Ada's room");
    expect(arrivals).toHaveLength(2);
    expect(reload).not.toHaveBeenCalled();
  });

  it("still forces the update for a newer save after the offer was cancelled", () => {
    const { flow, offer, reload, start, worker } = updating(true);
    start.shown(true);
    offer.defer();
    flow.requireNewer();
    expect(worker.postMessage).toHaveBeenCalledWith("skip-waiting");
    expect(reload).toHaveBeenCalledTimes(1);
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
