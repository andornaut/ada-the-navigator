import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
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
function setup() {
  const actions = {
    choose: vi.fn(),
    continueGame: vi.fn(),
    dismissNotice: vi.fn(),
    reducedMotion: () => false,
    restart: vi.fn(),
    start: vi.fn(),
  };
  shell = new StoryShell(actions);
  const model = new GameModel(CONTENT);
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
