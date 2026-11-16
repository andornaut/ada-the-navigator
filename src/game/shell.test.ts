import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import { GameModel } from "../model/game.ts";
import { resolveAdaHoldAction } from "../ui/actionBinding.ts";
import { bindAdaActionRoot } from "../ui/holdActionsAdapter.ts";
import { rootPressGuard } from "../ui/pressScope.ts";
import { StoryShell } from "./shell.ts";

vi.mock("../ui/uiSkin.ts", () => ({ applyButtonSkin: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({ focusTarget: vi.fn() }));

class Element extends EventTarget {
  children: Element[] = [];
  disabled = false;
  id = "";
  readonly attributes = new Map<string, string>();
  className = "";
  dataset: Record<string, string> = {};
  hidden = false;
  inert = false;
  parent: Element | null = null;
  get parentElement(): Element | null {
    return this.parent;
  }
  get isConnected(): boolean {
    return this === (document.body as unknown) || (this.parent?.isConnected ?? false);
  }
  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }
  readonly nodeType = 1;
  get ownerDocument() {
    return document;
  }
  get parentNode() {
    return this.parent;
  }
  get firstChild() {
    return this.children[0] ?? null;
  }
  get nextSibling() {
    return this.parent?.children[this.parent.children.indexOf(this) + 1] ?? null;
  }
  readonly style = { removeProperty() {}, setProperty() {} };
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  toggleAttribute(name: string, enabled: boolean) {
    if (enabled) {
      this.attributes.set(name, "");
    } else {
      this.attributes.delete(name);
    }
  }
  matches(selector: string) {
    return selector === ":disabled" && this.disabled;
  }
  insertBefore(node: Element, before: Element | null): void {
    if (node === before) {
      return;
    }
    node.remove();
    node.parent = this;
    this.children.splice(
      before === null ? this.children.length : this.children.indexOf(before),
      0,
      node,
    );
  }
  textContent = "";
  type = "";
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  append(...nodes: Element[]): void {
    for (const node of nodes) {
      this.insertBefore(node, null);
    }
  }
  prepend(...nodes: Element[]): void {
    for (const node of [...nodes].reverse()) {
      this.insertBefore(node, this.firstChild);
    }
  }
  replaceChildren(...nodes: Element[]): void {
    this.children = [];
    this.append(...nodes);
  }
  remove(): void {
    if (this.parent) {
      this.parent.children = this.parent.children.filter((node) => node !== this);
      this.parent = null;
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
  closest(selector: string): Element | null {
    return (selector.includes("[hidden]") && this.hidden) ||
      (selector.includes("[inert]") && this.inert)
      ? this
      : (this.parent?.closest(selector) ?? null);
  }
  click(): void {
    this.dispatchEvent(new Event("click"));
  }
}

let host: Element;
let shell: StoryShell;
let actionRoot: ReturnType<typeof bindAdaActionRoot> | undefined;
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
  actionRoot = undefined;
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), {
      activeElement: null,
      body: host,
      createElement: () => new Element(),
      defaultView: Object.assign(new EventTarget(), {
        HTMLElement: Element,
        Node: Element,
        clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
        performance: { now: () => Date.now() },
        setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
      }),
      getElementById: () => host,
      hidden: false,
    }),
  );
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
});
afterEach(() => {
  shell.dispose();
  actionRoot?.dispose();
  vi.useRealTimers();
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

function holdFixture() {
  vi.useFakeTimers();
  const ui = setup();
  const root = host as unknown as HTMLElement;
  actionRoot = bindAdaActionRoot(
    { guard: rootPressGuard(root), requiredReady: () => true, subscribeRequired: () => () => {} },
    root,
  );
  const event = (type: string, target: Element) => {
    const value = new Event(type, { cancelable: true });
    Object.defineProperties(
      value,
      Object.fromEntries(
        Object.entries({
          button: 0,
          clientX: 0,
          clientY: 0,
          detail: type === "click" ? 1 : 0,
          isPrimary: true,
          pointerId: 7,
          target,
        }).map(([key, property]) => [key, { value: property }]),
      ),
    );
    return value;
  };
  const down = (target: Element) => {
    document.dispatchEvent(event("pointerdown", target));
    host.dispatchEvent(event("pointerdown", target));
  };
  const release = (target: Element) => {
    document.dispatchEvent(event("pointerup", target));
    const click = event("click", target);
    host.dispatchEvent(click);
    if (!click.defaultPrevented) {
      target.dispatchEvent(event("click", target));
    }
    return click;
  };
  const dialogue = (id = "choice", refused = false) => {
    ui.model.state.dialogue = {
      choices: [{ id, label: "Choice", refused }],
      context: "fixture",
      text: "Text",
      title: "Title",
    };
    ui.shell.render(ui.model.state, "space");
    return ui.buttons()[0]!;
  };
  return {
    ...ui,
    dialogue,
    down,
    release,
    resolve: (node: Element) => resolveAdaHoldAction(root, node),
  };
}
it("holds the current dialogue callback once and keeps keyboard activation and refusal feedback", () => {
  const f = holdFixture(),
    button = f.dialogue();
  f.down(button);
  vi.advanceTimersByTime(499);
  expect(f.actions.choose).not.toHaveBeenCalled();
  const current = vi.fn();
  f.actions.choose = current;
  vi.advanceTimersByTime(1);
  expect(current).toHaveBeenCalledExactlyOnceWith("choice");
  expect(f.release(button).defaultPrevented).toBe(true);
  expect(current).toHaveBeenCalledOnce();
  button.click();
  expect(current).toHaveBeenCalledTimes(2);
  const refused = f.dialogue("locked", true);
  expect(f.resolve(refused)?.available()).toBe(true);
  f.down(refused);
  vi.advanceTimersByTime(500);
  expect(f.release(refused).defaultPrevented).toBe(true);
  expect(current).toHaveBeenCalledTimes(2);
  expect(refused.attributes.size).toBeGreaterThan(0);
});
it("unregisters replaced dialogue choices and disposed notice actions without replaying stale captures", () => {
  const f = holdFixture(),
    old = f.dialogue("old");
  f.down(old);
  const next = f.dialogue("next");
  expect(f.resolve(old)).toBeNull();
  vi.advanceTimersByTime(500);
  f.release(old);
  old.click();
  expect(f.actions.choose).not.toHaveBeenCalled();
  f.down(next);
  vi.advanceTimersByTime(500);
  f.release(next);
  expect(f.actions.choose).toHaveBeenCalledExactlyOnceWith("next");
  f.model.state.notice = "Current notice";
  f.shell.render(f.model.state, "space");
  const status = host.children.find((node) => node.id === "game-status")!;
  f.down(status);
  const dismiss = vi.fn();
  f.actions.dismissNotice = dismiss;
  vi.advanceTimersByTime(500);
  expect(dismiss).toHaveBeenCalledOnce();
  expect(f.release(status).defaultPrevented).toBe(true);
  f.model.state.notice = "";
  f.shell.render(f.model.state, "space");
  expect(f.resolve(status)?.available()).toBe(false);
  status.click();
  expect(dismiss).toHaveBeenCalledOnce();
  f.shell.dispose();
  expect(f.resolve(status)).toBeNull();
  expect(f.resolve(next)).toBeNull();
  status.click();
  next.click();
  expect(dismiss).toHaveBeenCalledOnce();
  expect(f.actions.choose).toHaveBeenCalledOnce();
});
