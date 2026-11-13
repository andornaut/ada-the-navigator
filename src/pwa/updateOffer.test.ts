import { startOfflinePlay } from "@andornaut/game-kit/web/pwa/dom/offlinePlay";
import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GameModel } from "../model/game.ts";
import { playOpening } from "../testing/launch.ts";
import { createUpdateOffer, trackStartScreen } from "./updateOffer.ts";

// Lets the registration, its check and the reads after it settle.
const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

// Ada's room page, reached by returning home from a flight: Back to title's second route.
function enterRoomPage(model: GameModel): void {
  model.state.progress[1].opened = true;
  model.state.prologueSeen = true;
  model.startGalaxy(1);
  model.state.flight!.objects = [];
  model.returnHome();
}

// The kit's offline play on a page an older version controls, with a newer one waiting or not,
// wired the way index.ts wires it. hide and show move the page out of view and back.
async function updating(waiting: boolean) {
  const worker = Object.assign(new EventTarget(), {
    postMessage: vi.fn(() => {
      container.controller = worker;
      container.dispatchEvent(new Event("controllerchange"));
    }),
    state: "installed",
  });
  const registration = Object.assign(new EventTarget(), {
    active: null,
    installing: null,
    update: vi.fn(() => Promise.resolve()),
    waiting: waiting ? worker : null,
  });
  const container = Object.assign(new EventTarget(), {
    controller: {} as unknown,
    // No staged worker at genuine launch; a later register discovers the candidate.
    getRegistration: vi.fn(async () => undefined),
    register: vi.fn(() => Promise.resolve(registration)),
  });
  const visibilitySource = Object.assign(new EventTarget(), {
    visibilityState: "visible" as DocumentVisibilityState,
  });
  const turn = (state: DocumentVisibilityState) => {
    visibilitySource.visibilityState = state;
    visibilitySource.dispatchEvent(new Event("visibilitychange"));
  };
  const reload = vi.fn();
  const shown = vi.fn();
  let accept = () => undefined as void;
  let dismiss = () => undefined as void;
  const offer = createUpdateOffer(
    () => accept(),
    () => dismiss(),
  );
  offer.subscribe(shown);
  const play = startOfflinePlay(
    { onRequireNewer: vi.fn(), onUpdateShown: offer.setVisible, serviceWorkerUrl: "/sw.js" },
    {
      container,
      eventTarget: new EventTarget(),
      now: () => 0,
      online: () => true,
      reload,
      session: undefined,
      visibilitySource,
    },
  );
  await play.launchReady();
  const { flow } = play;
  accept = () => {
    void flow.accept();
  };
  dismiss = () => flow.dismissOffer();
  const start = trackStartScreen(flow);
  await settle();
  return {
    checks: () => registration.update.mock.calls.length,
    flow,
    hide: () => turn("hidden"),
    offer,
    reload,
    show: () => turn("visible"),
    shown,
    start,
    worker,
  };
}

describe("start-screen update offer", () => {
  it("shows only on the start screen while a newer version waits", async () => {
    const idle = await updating(false);
    idle.start.shown(true);
    expect(idle.shown).toHaveBeenLastCalledWith(false);
    const waiting = await updating(true);
    expect(waiting.shown).toHaveBeenLastCalledWith(false);
    waiting.start.shown(true);
    expect(waiting.shown).toHaveBeenLastCalledWith(true);
    waiting.start.shown(false);
    expect(waiting.shown).toHaveBeenLastCalledWith(false);
  });

  it("checks for a newer version on the first launch's arrival", async () => {
    const { checks, start } = await updating(false);
    const before = checks();
    start.shown(true);
    expect(checks()).toBe(before + 1);
  });

  it("is suppressed while Settings or the cheats card cover the start screen", async () => {
    const { shown, start } = await updating(true);
    start.shown(true);
    start.cover("settings", true);
    expect(shown).toHaveBeenLastCalledWith(false);
    start.cover("cheats", true);
    start.cover("settings", false);
    expect(shown).toHaveBeenLastCalledWith(false);
    start.cover("cheats", false);
    expect(shown).toHaveBeenLastCalledWith(true);
  });

  it("keeps a cancelled offer hidden, with no check, as a card over it closes", async () => {
    const { checks, offer, shown, start } = await updating(true);
    start.shown(true);
    offer.defer();
    // The arrival's check settles first, since one under way would skip another.
    await settle();
    const before = checks();
    for (const card of ["settings", "cheats", "achievements"] as const) {
      start.cover(card, true);
      start.cover(card, false);
      expect(shown, `${card} closing`).toHaveBeenLastCalledWith(false);
    }
    expect(checks()).toBe(before);
  });

  it("offers a cancelled update again on every Back to title, checking each time", async () => {
    const { checks, offer, reload, shown, start } = await updating(true);
    // The model's screen drives the start screen as the scene does, each arrival a transition.
    const model = new GameModel(CONTENT);
    const follow = () => start.shown(model.screen === "start");
    const arrivals: string[] = [];
    const arrive = async (how: string) => {
      // The previous check settles first, since one under way skips the next.
      await settle();
      const before = checks();
      follow();
      expect(model.screen, how).toBe("start");
      expect(checks(), `${how} checks for a version`).toBe(before + 1);
      expect(shown, `${how} offers the update`).toHaveBeenLastCalledWith(true);
      offer.defer();
      expect(shown, `${how} then cancels it`).toHaveBeenLastCalledWith(false);
      arrivals.push(how);
    };
    await arrive("the first launch");
    // Back to title from flight.
    model.startGalaxy(1);
    playOpening(model);
    follow();
    model.backToTitle();
    await arrive("Back to title");
    // Back to title from Ada's room page.
    enterRoomPage(model);
    follow();
    expect(model.roomPage).toBe(true);
    model.backToTitle();
    await arrive("the return from Ada's room");
    expect(arrivals).toHaveLength(3);
    expect(reload).not.toHaveBeenCalled();
  });

  it("offers a cancelled update again as the page resumes on the start screen", async () => {
    const { hide, offer, show, shown, start } = await updating(true);
    start.shown(true);
    offer.defer();
    hide();
    expect(shown).toHaveBeenLastCalledWith(false);
    show();
    expect(shown).toHaveBeenLastCalledWith(true);
  });

  it("keeps a cancelled offer hidden after a resume behind a card", async () => {
    const { hide, offer, show, shown, start } = await updating(true);
    start.shown(true);
    offer.defer();
    start.cover("settings", true);
    hide();
    show();
    start.cover("settings", false);
    expect(shown).toHaveBeenLastCalledWith(false);
  });

  it("still forces the update for a newer save after the offer was cancelled", async () => {
    const { flow, offer, reload, start, worker } = await updating(true);
    start.shown(true);
    offer.defer();
    flow.requireNewer();
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "skip-waiting" }),
      expect.any(Array),
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("restores a blocked async Update now offer for an explicit retry", async () => {
    const { offer, reload, shown, start, worker } = await updating(true);
    start.shown(true);
    worker.postMessage.mockImplementationOnce(() => {
      throw new Error("switch refused");
    });
    offer.accept();
    offer.accept();
    await settle();
    expect(reload).not.toHaveBeenCalled();
    expect(worker.postMessage).toHaveBeenCalledOnce();
    expect(shown).toHaveBeenLastCalledWith(true);
    offer.accept();
    await settle();
    expect(reload).toHaveBeenCalledOnce();
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
  });

  it("reloads into the waiting version only on Update now", async () => {
    const { offer, reload, start, worker } = await updating(true);
    start.shown(true);
    offer.accept();
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "skip-waiting" }),
      expect.any(Array),
    );
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
