import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import { GameModel } from "../model/game.ts";
import { StoryShell } from "./shell.ts";

vi.mock("../ui/uiSkin.ts", () => ({ applyButtonSkin: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@andornaut/game-kit/web/ui/dom/focusModality", () => ({ focusTarget: vi.fn() }));

class Element extends EventTarget {
  children: Element[] = [];
  className = "";
  dataset: Record<string, string> = {};
  hidden = false;
  parent: Element | null = null;
  style = {};
  textContent = "";
  type = "";
  setAttribute(): void {}
  append(...nodes: Element[]): void {
    this.children.push(...nodes);
    nodes.forEach((node) => {
      node.parent = this;
    });
  }
  prepend(...nodes: Element[]): void {
    this.children.unshift(...nodes);
    nodes.forEach((node) => {
      node.parent = this;
    });
  }
  replaceChildren(...nodes: Element[]): void {
    this.children = [];
    this.append(...nodes);
  }
  remove(): void {
    if (this.parent) {
      this.parent.children = this.parent.children.filter((node) => node !== this);
    }
  }
  querySelectorAll(selector: string): Element[] {
    const all = this.children.flatMap((node) => [node, ...node.querySelectorAll("button")]);
    return all.filter(
      (node) =>
        node.type === "button" &&
        (!selector.includes("ada-primary") || node.className.includes("ada-primary")),
    );
  }
  querySelector(selector: string): Element | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  closest(): null {
    return null;
  }
  click(): void {
    this.dispatchEvent(new Event("click"));
  }
}

let host: Element;
let shell: StoryShell;
function setup(model = new GameModel(CONTENT)) {
  const actions = {
    choose: vi.fn(),
    continueGame: vi.fn(() => model.continueGame()),
    dismissNotice: vi.fn(),
    reducedMotion: () => false,
    restart: vi.fn(),
    start: vi.fn(() => model.start()),
  };
  shell = new StoryShell(actions);
  const buttons = () => host.querySelectorAll("button");
  const ids = () => buttons().map((node) => node.dataset.action);
  return { actions, buttons, ids, model, shell };
}
beforeEach(() => {
  vi.clearAllMocks();
  host = new Element();
  vi.stubGlobal("document", {
    activeElement: null,
    body: host,
    createElement: () => new Element(),
    getElementById: () => host,
  });
});
afterEach(() => {
  shell.dispose();
  vi.unstubAllGlobals();
});

describe("title Continue permission", () => {
  it("keeps legacy two-argument callers tied to started", () => {
    const { ids, model, shell } = setup();
    shell.render(model.state, "start");
    expect(ids()).toEqual(["start"]);
    model.state.started = true;
    shell.render(model.state, "start");
    expect(ids()).toEqual(["restart", "continue"]);
  });

  it("shows and focuses a real Continue control without starting the first flight", () => {
    const { actions, buttons, ids, model, shell } = setup();
    shell.render(model.state, "start", true);
    expect(ids()).toEqual(["restart", "continue"]);
    const resume = buttons().find((node) => node.dataset.action === "continue")!;
    expect(focusTarget).toHaveBeenLastCalledWith(resume);
    resume.click();
    expect(actions.continueGame).toHaveBeenCalledOnce();
    expect(actions.start).not.toHaveBeenCalled();
    expect(model.state.started).toBe(false);
    expect(model.state.flight).toBeNull();
  });

  it("redraws when only Continue permission changes and preserves unchanged controls", () => {
    const { buttons, ids, model, shell } = setup();
    shell.render(model.state, "start", false);
    expect(ids()).toEqual(["start"]);
    shell.render(model.state, "start", true);
    expect(ids()).toEqual(["restart", "continue"]);
    const resume = buttons()[1];
    shell.render(model.state, "start", true);
    expect(buttons()[1]).toBe(resume);
    shell.render(model.state, "start", false);
    expect(ids()).toEqual(["start"]);
    expect(model.state.started).toBe(false);
  });

  it.each(["unavailable", "updating"] as const)(
    "keeps a forced %s update fenced despite Continue permission",
    (state) => {
      const { actions, ids, model, shell } = setup();
      shell.setRequiredUpdate(state);
      shell.render(model.state, "start", true);
      expect(ids()).toEqual([]);
      expect(actions.continueGame).not.toHaveBeenCalled();
      expect(actions.start).not.toHaveBeenCalled();
    },
  );
});

describe("held story title consumer", () => {
  function opening() {
    const model = new GameModel(CONTENT);
    model.start();
    CONTENT.premise.gardenArrival.forEach(() => model.storyNext());
    expect(model.storyView?.page.id).toBe("opening");
    expect(model.storyView!.choices.length).toBeGreaterThan(1);
    return model;
  }

  function continueFromTitle(model: GameModel) {
    const ui = setup(model);
    ui.shell.render(model.state, model.screen, model.canContinue);
    expect(ui.ids()).toEqual(["restart", "continue"]);
    const button = ui.buttons()[1]!;
    expect(button.textContent).toBe(CONTENT.labels.continue);
    button.click();
    expect(ui.actions.continueGame).toHaveBeenCalledOnce();
    expect(ui.actions.start).not.toHaveBeenCalled();
    return ui;
  }

  it.each([false, true])(
    "resumes the real initial unanswered choice through Continue (reload=%s)",
    (reload) => {
      const model = opening();
      const state = structuredClone(model.state);
      const page = structuredClone(model.storyView);
      model.backToTitle();
      expect(model.screen).toBe("start");
      expect(model.state.started).toBe(false);
      const active = reload ? new GameModel(CONTENT, model.save()) : model;
      expect(active.canContinue).toBe(true);
      expect(active.state.started).toBe(false);
      continueFromTitle(active);
      expect(active.state).toEqual(state);
      expect(active.state.started).toBe(false);
      expect(active.state.flight).toBeNull();
      expect(active.storyView?.page).toEqual(page?.page);
      expect(active.storyView?.choices).toEqual(page?.choices);
      active.storyNext();
      expect(active.storyView?.page).toEqual(page?.page);
    },
  );

  it("retains asked questions and Previous through reload and a visible Continue click", () => {
    const model = opening();
    model.storyChoose(0);
    for (let turn = 0; turn < 60 && !model.storyView?.page.questions?.length; turn++) {
      model.storyNext();
    }
    expect(model.storyView?.page.questions?.length).toBeGreaterThan(0);
    const questions = model.storyView!.choices.length;
    model.storyChoose(0);
    model.storyNext();
    const before = structuredClone(model.storyView);
    const state = structuredClone(model.state);
    expect(before!.choices.length).toBe(questions - 1);
    model.backToTitle();
    const active = new GameModel(CONTENT, model.save());
    continueFromTitle(active);
    expect(active.state).toEqual(state);
    expect(active.storyView?.page).toEqual(before?.page);
    expect(active.storyView?.choices).toEqual(before?.choices);
    expect(active.storyView?.canGoBack).toBe(true);
    active.storyPrevious();
    expect(active.storyView?.page.id).toContain(":answer:");
    expect(active.state.started).toBe(false);
    expect(active.state.prologueSeen).toBe(false);
  });

  it("continues the remaining sleep clock after reload instead of replaying the interlude", () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    const flight = model.state.flight!;
    flight.shield = CONTENT.tuning.hazardDamage;
    flight.objects = [{ ...flight.player, hp: 1, id: "depletion", kind: "hazard", radius: 1000 }];
    model.step(0.1, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    model.storyNext();
    expect(model.storyView?.page.sleep).toBe(true);
    model.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.seconds / 2);
    const saved = model.saveDocument();
    model.backToTitle();
    const active = new GameModel(CONTENT, model.save());
    continueFromTitle(active);
    expect(active.saveDocument()).toEqual(saved);
    expect(active.storyView?.page.sleep).toBe(true);
    active.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.seconds / 2);
    expect(active.storyView?.page.id).toBe("morning");
  });
});
