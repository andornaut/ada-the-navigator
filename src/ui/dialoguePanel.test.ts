import { existsSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { CAST, castSheet } from "../data/cast.ts";
import { CONTENT } from "../data/content.ts";
import { createConversationBox, createInteractionCard } from "./conversation.ts";
import { createDialoguePanel } from "./dialoguePanel.ts";
import { STORY_PORTRAITS, storyPortrait, storyPortraitFrame, storyTabColour } from "./storybook.ts";

class Element {
  readonly attributes = new Map<string, string>();
  children: Element[] = [];
  className = "";
  readonly classList = {
    add: (...names: string[]) => {
      this.className += ` ${names.join(" ")}`;
    },
    toggle: vi.fn(),
  };
  readonly dataset: Record<string, string> = {};
  hidden = false;
  readonly listeners = new Map<string, ((event: Partial<PointerEvent>) => void)[]>();
  readonly style: Record<string, string> = {};
  textContent = "";
  addEventListener(type: string, callback: (event: Partial<PointerEvent>) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  append(...nodes: Element[]) {
    this.children.push(...nodes);
  }
  readonly setPointerCapture = vi.fn();
  dispatch(type: string, values: Partial<PointerEvent> = {}) {
    const event = {
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
      isPrimary: false,
      pointerId: 7,
      pointerType: "touch",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      ...values,
    };
    this.listeners.get(type)?.forEach((callback) => callback(event));
  }
  click() {
    this.dispatch("click", { detail: 0 });
  }
  focus() {}
  querySelector(selector: string): Element | null {
    return (
      this.all().find((node) =>
        selector === "button"
          ? node.tag === "button"
          : node.className.split(" ").includes(selector.slice(1)),
      ) ?? null
    );
  }
  readonly tag: string;
  constructor(tag: string) {
    this.tag = tag;
  }
  all(): Element[] {
    return this.children.flatMap((node) => [node, ...node.all()]);
  }
  remove() {}
  replaceChildren(...nodes: Element[]) {
    this.children = nodes;
  }
  toggleAttribute(name: string, on: boolean) {
    if (on) {
      this.attributes.set(name, "");
    } else {
      this.attributes.delete(name);
    }
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}
afterEach(() => vi.unstubAllGlobals());
const setup = () => vi.stubGlobal("document", { createElement: (tag: string) => new Element(tag) });

describe("shared Earth and space dialogue presentation", () => {
  it("resolves every authored cast member to their own existing sheet and tab", () => {
    for (const [key, member] of Object.entries(CAST)) {
      const portrait = storyPortrait(member.name)!;
      expect(portrait.speaker).toBe(key);
      expect(STORY_PORTRAITS[portrait.speaker]?.url).toBe(
        castSheet(key as keyof typeof CAST, false),
      );
      expect(
        existsSync(
          new URL(`../../public${STORY_PORTRAITS[portrait.speaker]!.url}`, import.meta.url),
        ),
      ).toBe(true);
      expect(storyTabColour(member.name)).toBe(member.tab);
    }
  });
  it("uses Trista and Bin profiles for Mom and Dad without changing spoken family addresses", () => {
    setup();
    const panel = createDialoguePanel({
      closeAction: "close",
      closeLabel: "Close",
      title: "Dialogue",
    });
    for (const [address, name, key, url] of [
      ["Mom", "Trista", "mom", "trista"],
      ["Dad", "Bin", "dad", "mr-b"],
    ] as const) {
      panel.showLine(address, `Hello, ${address}.`);
      expect(panel.body.querySelector(".ada-story-tab")?.textContent).toBe(name);
      expect(panel.body.querySelector(".ada-story-paragraph")?.textContent).toBe(
        `Hello, ${address}.`,
      );
      const portrait = storyPortrait(address)!;
      expect(portrait.speaker).toBe(key);
      expect(storyPortraitFrame(true, portrait, 0)).toBe(1);
      expect(STORY_PORTRAITS[key]?.url).toBe(`/art/portraits/${url}.png`);
      expect(existsSync(new URL(`../../public${STORY_PORTRAITS[key]!.url}`, import.meta.url))).toBe(
        true,
      );
    }
  });

  it("changes portrait and name with the actual line speaker and leaves narration unnamed", () => {
    setup();
    const panel = createDialoguePanel({
      closeAction: "close",
      closeLabel: "Close",
      title: "Dialogue",
    });
    panel.showLine("Rivet", "A line");
    expect(panel.body.querySelector<HTMLElement>(".ada-story-portrait")?.dataset.speaker).toBe(
      "rivet",
    );
    expect(panel.body.querySelector(".ada-story-tab")?.textContent).toBe("Rivet");
    panel.showLine("Ada", "Her reply");
    expect(panel.body.querySelector<HTMLElement>(".ada-story-portrait")?.dataset.speaker).toBe(
      "ada",
    );
    expect(panel.body.querySelector(".ada-story-tab")?.textContent).toBe("Ada");
    panel.showLine(undefined, "Narration");
    expect((panel.body.querySelector(".ada-story-tab") as HTMLElement).hidden).toBe(true);
    expect((panel.body.querySelector(".ada-story-frame") as HTMLElement).hidden).toBe(true);
  });
  it("shows a station-specific name while using only the canonical keeper portrait and tab", () => {
    setup();
    const panel = createDialoguePanel({
      closeAction: "close",
      closeLabel: "Close",
      title: "Station",
    });
    panel.showLine(
      { displayName: "Station-specific keeper", portraitName: "Slate" },
      "Current greeting",
    );
    expect(panel.body.querySelector(".ada-story-tab")?.textContent).toBe("Station-specific keeper");
    expect(panel.body.querySelector<HTMLElement>(".ada-story-tab")?.style.background).toBe(
      storyTabColour("Slate"),
    );
    expect(panel.body.querySelector<HTMLElement>(".ada-story-portrait")?.dataset.speaker).toBe(
      "slate",
    );
    expect(panel.body.querySelector<HTMLElement>(".ada-story-frame")?.hidden).toBe(false);
    expect(panel.body.querySelector(".ada-story-paragraph")?.textContent).toBe("Current greeting");
    panel.showLine("Ada", "Her reply");
    expect(panel.body.querySelector(".ada-story-tab")?.textContent).toBe("Ada");
    expect(panel.body.querySelector<HTMLElement>(".ada-story-portrait")?.dataset.speaker).toBe(
      "ada",
    );
  });

  it("separates neutral topics from navigation and keeps Skip in the shared Earth top slot", () => {
    setup();
    const parent = new Element("div");
    const interaction = createInteractionCard(parent as unknown as HTMLElement, {
      choose: vi.fn(),
      close: vi.fn(),
      skip: vi.fn(),
    });
    interaction.show(1, {
      choices: [{ id: "continue", label: CONTENT.labels.next! }],
      context: "deliveryComplete",
      text: "",
      title: "Rivet",
    });
    const navigation = parent
      .all()
      .find((node) => node.className.includes("ada-dialogue-controls"))!;
    const buttons = () => parent.all().filter((node) => node.tag === "button");
    expect(buttons().filter((node) => node.textContent === CONTENT.labels.skip)).toHaveLength(1);
    expect(buttons().filter((node) => node.textContent === "Close")).toHaveLength(0);
    expect(buttons().filter((node) => node.dataset.action === "conversation-close")).toHaveLength(
      1,
    );
    navigation.children.find((node) => node.textContent === "Ask more")!.click();
    const choices = parent.all().find((node) => node.className === "ada-story-choices")!;
    expect(choices.children.length).toBeGreaterThan(0);
    expect(choices.children.every((node) => !node.className.includes("ada-primary"))).toBe(true);
    expect(navigation.children.some((node) => node.textContent === CONTENT.labels.next)).toBe(
      false,
    );
    const skip = buttons().find((node) => node.textContent === CONTENT.labels.skip)!;
    expect(skip.className).toContain("ada-compact");
    expect(skip.className).toContain("ada-story-skip");
    expect(navigation.children).not.toContain(skip);
    expect(
      parent
        .all()
        .find((node) => node.className.includes("ada-dialogue-panel"))!
        .all(),
    ).not.toContain(skip);
    expect(skip.hidden).toBe(false);
    expect(
      buttons().filter((node) => node.className.includes("ada-primary")).length,
    ).toBeLessThanOrEqual(1);
    interaction.dispose();
  });
  it("hides Skip at material decisions and cannot bypass or select an outcome", () => {
    setup();
    const parent = new Element("div");
    const choose = vi.fn(),
      skip = vi.fn();
    const interaction = createInteractionCard(parent as unknown as HTMLElement, {
      choose,
      close: vi.fn(),
      skip,
    });
    interaction.show(1, {
      choices: [
        { id: "accept", label: "Accept" },
        { id: "decline", label: "Decline" },
      ],
      context: "test-decision",
      text: "Decision",
      title: "Rivet",
    });
    const skipButton = parent.all().find((node) => node.dataset.action === "dialogue-skip")!;
    expect(skipButton.hidden).toBe(true);
    skipButton.click();
    expect(skip).not.toHaveBeenCalled();
    expect(choose).not.toHaveBeenCalled();
    expect(
      parent
        .all()
        .filter((node) => node.tag === "button" && node.textContent === CONTENT.labels.next),
    ).toHaveLength(0);
    parent
      .all()
      .find((node) => node.tag === "button" && node.textContent === "Accept")!
      .click();
    expect(choose).toHaveBeenCalledExactlyOnceWith("accept");
    interaction.dispose();
  });

  it("returns from a selected background answer to essential dialogue without reopening the menu", () => {
    setup();
    const parent = new Element("div");
    const interaction = createInteractionCard(parent as unknown as HTMLElement, {
      choose: vi.fn(),
      close: vi.fn(),
      skip: vi.fn(),
    });
    interaction.show(1, {
      choices: [{ id: "continue", label: CONTENT.labels.next! }],
      context: "deliveryComplete",
      text: "",
      title: "Rivet",
    });
    const paragraph = () =>
      parent.all().find((node) => node.className === "ada-story-paragraph")!.textContent;
    const initial = paragraph();
    parent
      .all()
      .find((node) => node.tag === "button" && node.textContent === "Ask more")!
      .click();
    const topics = parent.all().find((node) => node.className === "ada-story-choices")!;
    topics.children[0]!.click();
    expect(paragraph()).not.toBe(initial);
    parent
      .all()
      .find((node) => node.tag === "button" && node.textContent === CONTENT.labels.next)!
      .click();
    expect(paragraph()).toBe(initial);
    expect(topics.children).toHaveLength(0);
    parent
      .all()
      .find((node) => node.tag === "button" && node.textContent === CONTENT.labels.next)!
      .click();
    expect(paragraph()).not.toBe(initial);
    interaction.dispose();
  });

  it.each(["ada", "penny"] as const)(
    "advances %s on a secondary touch without relying on a synthesized click",
    (speaker) => {
      const host = new Element("div");
      vi.stubGlobal("document", {
        createElement: (tag: string) => new Element(tag),
        getElementById: () => host,
      });
      const advance = vi.fn();
      const box = createConversationBox(advance);
      box.render(
        {
          elapsed: 0,
          key: speaker,
          mood: "neutral",
          name: speaker,
          named: false,
          side: speaker === "ada" ? "left" : "right",
          speaker,
          text: "A line",
        },
        true,
        true,
      );
      const button = host.children[0]!;
      button.dispatch("pointerdown");
      expect(button.setPointerCapture).toHaveBeenCalledWith(7);
      expect(advance).not.toHaveBeenCalled();
      button.dispatch("pointerup");
      expect(advance).toHaveBeenCalledTimes(1);
      button.dispatch("click");
      expect(advance).toHaveBeenCalledTimes(1);
      button.click();
      expect(advance).toHaveBeenCalledTimes(2);
      box.dispose();
    },
  );

  it.each(["pointercancel", "lostpointercapture"])("cancels a held message press on %s", (type) => {
    const host = new Element("div");
    vi.stubGlobal("document", {
      createElement: (tag: string) => new Element(tag),
      getElementById: () => host,
    });
    const advance = vi.fn();
    const box = createConversationBox(advance);
    const button = host.children[0]!;
    button.dispatch("pointerdown");
    button.dispatch(type);
    button.dispatch("pointerup");
    button.dispatch("click");
    expect(advance).not.toHaveBeenCalled();
    button.dispatch("pointerdown", { isPrimary: true });
    button.dispatch("pointerup", { isPrimary: true });
    expect(advance).not.toHaveBeenCalled();
    button.dispatch("click", { isPrimary: true });
    expect(advance).toHaveBeenCalledTimes(1);
    box.dispose();
  });

  it("has no separate ambient Skip button and retains the existing tap advance route", () => {
    const host = new Element("div");
    vi.stubGlobal("document", {
      createElement: (tag: string) => new Element(tag),
      getElementById: () => host,
    });
    const advance = vi.fn();
    const legacySkip = vi.fn();
    const box = createConversationBox(advance, legacySkip);
    box.render(
      {
        elapsed: 0,
        key: "ambient",
        mood: "neutral",
        name: "Penny",
        named: false,
        side: "left",
        speaker: "penny",
        text: "A line",
      },
      true,
      true,
    );
    expect(host.all().filter((node) => node.tag === "button")).toHaveLength(1);
    expect(host.all().find((node) => node.dataset.action === "conversation-skip")).toBeUndefined();
    host.children[0]!.click();
    expect(advance).toHaveBeenCalledTimes(1);
    expect(legacySkip).not.toHaveBeenCalled();
    box.dispose();
  });
});
