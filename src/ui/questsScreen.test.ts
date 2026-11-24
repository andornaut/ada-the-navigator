import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { BUTTON_SLICE } from "../data/layout.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import type { MapPlace } from "../model/map.ts";
import type { QuestEntry } from "../model/questDetails.ts";
import * as actionBinding from "./actionBinding.ts";
import { fixtureActionRoot } from "./actionRootFixture.ts";
import { slice, units } from "./layout/css.ts";
import { MAP_SCREEN } from "./layout/mapScreen.ts";
import { QUEST_ICON, QUESTS_SCREEN_STYLE } from "./layout/questsScreen.ts";
import { mapScreenLabels } from "./mapScreen.ts";
import { createQuestsScreen, questRoute } from "./questsScreen.ts";

const entry: QuestEntry = {
  galaxy: 1,
  id: "story:1:1",
  line: {
    destination: "workshop",
    kind: "story",
    source: "growers",
    target: "growers",
    text: "Food",
  },
  locations: [
    { id: "growers", label: "Growers", symbol: "growers" },
    { id: "workshop", label: "Workshop", symbol: "workshop" },
  ],
};
const place = (id: string) => ({ id }) as MapPlace;
describe("quest detail routes", () => {
  it("keeps the final destination distinct from the pickup target before collection", () => {
    expect(
      questRoute(entry, [place("growers"), place("workshop")]).map(({ kind, location, place }) => [
        kind,
        location?.id,
        place?.id,
      ]),
    ).toEqual([
      ["source", "growers", "growers"],
      ["target", "workshop", "workshop"],
    ]);
  });
  it("does not reveal an explicit unknown destination or fall back to its pickup target", () => {
    const route = questRoute({ ...entry, line: { ...entry.line, destination: null } }, [
      place("growers"),
    ]);
    expect(route[1]).toEqual({ kind: "target", location: null, place: null });
  });
  it("shows known location labels from another galaxy without enabling current-map locating", () => {
    const route = questRoute(entry, []);
    expect(route.map(({ location }) => location?.label)).toEqual(["Growers", "Workshop"]);
    expect(route.every(({ place }) => place === null)).toBe(true);
  });
  it("uses the legacy target only when the destination is omitted and never guesses hidden labels", () => {
    const line = { kind: "job" as const, target: "unknown", text: "Survey" };
    expect(questRoute({ ...entry, line }, [])).toEqual([
      { kind: "target", location: null, place: null },
    ]);
    expect(
      questRoute({ ...entry, line: { ...line, target: "workshop" } }, [place("workshop")])[0]
        ?.location?.label,
    ).toBe("Workshop");
  });
});

describe("quest objective presentation", () => {
  it("keeps the current revealed action for every legacy quest without generating future steps", async () => {
    const { questChecklist } = await import("./questsScreen.ts");
    for (const kind of ["story", "job"] as const) {
      const current = { ...entry, line: { kind, target: null, text: "Find the known signal" } };
      expect(questChecklist(current)).toEqual([{ checked: false, label: "Find the known signal" }]);
    }
  });

  it("retains supplied completion and quantities and uses the same canonical identity icons", async () => {
    const { questChecklist, questObjectiveIcon } = await import("./questsScreen.ts");
    const { CARGO_ICONS } = await import("./statusPill.ts");
    const objectives = [
      { checked: true, itemKind: "ore" as const, label: "Collect Ore" },
      { checked: false, count: "35 / 100", itemKind: "ore" as const, label: "Deliver Ore" },
    ];
    const current = { ...entry, line: { ...entry.line, objectives } };
    expect(questChecklist(current)).toBe(objectives);
    expect(questObjectiveIcon(current, objectives[0]!)).toBe(CARGO_ICONS.ore);
    expect(
      questObjectiveIcon(current, { checked: false, label: "Visit", location: "growers" }),
    ).toBe(uiIconUrl("map-growers"));
    expect(
      questObjectiveIcon(current, { checked: false, label: "Visit", location: "unrevealed" }),
    ).toBeNull();
  });
});

it("uses the shipped holodisk SVG only for the revealed current item", async () => {
  const { questChecklist, questObjectiveIcon } = await import("./questsScreen.ts");
  const current = {
    ...entry,
    line: {
      currentItemKind: "holodisk" as const,
      kind: "story" as const,
      target: null,
      text: "Find the holodisk",
    },
  };
  const row = questChecklist(current)[0]!;
  expect(questObjectiveIcon(current, row)).toBe(uiIconUrl("icon-holodisk-20"));
  expect(
    questObjectiveIcon(
      { ...current, line: { kind: "story", target: null, text: "Explore" } },
      { checked: false, label: "Explore" },
    ),
  ).toBeNull();
});

it("presents only canonical supplied quest identities and never uses a label dictionary as links", async () => {
  const { questContextIcon } = await import("./questsScreen.ts");
  expect(questContextIcon(null)).toBeNull();
  expect(questContextIcon({ quests: [] })).toBeNull();
  expect(questContextIcon({ quests: [{ ...entry, jobType: "survey" }] })).toBe(
    uiIconUrl("map-job-survey"),
  );
  expect(questContextIcon({ quests: [entry, { ...entry, id: "other" }] })).toBe(
    uiIconUrl("map-destination"),
  );
  const unknown = { ...entry, line: { kind: "story" as const, target: null, text: "Explore" } };
  expect(questContextIcon({ quests: [unknown] })).toBe(uiIconUrl("map-destination"));
});

class QuestNode extends EventTarget {
  parentElement: QuestNode | null = null;
  children: QuestNode[] = [];
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly style = { removeProperty: vi.fn(), setProperty: vi.fn() };
  readonly classList = {
    add: (name: string) => this.classList.toggle(name, true),
    remove: (name: string) => this.classList.toggle(name, false),
    toggle: (name: string, enabled: boolean) => {
      const classes = new Set(this.className.split(" ").filter(Boolean));
      if (enabled) {
        classes.add(name);
      } else {
        classes.delete(name);
      }
      this.className = [...classes].join(" ");
      return enabled;
    },
  };
  attached = false;
  className = "";
  disabled = false;
  hidden = false;
  focus = vi.fn();
  get tabIndex(): number {
    return Number(this.getAttribute("tabindex") ?? 0);
  }
  set tabIndex(value: number) {
    this.setAttribute("tabindex", String(value));
  }
  private text = "";
  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }
  set textContent(value: string) {
    this.replaceChildren();
    this.text = value;
  }
  readonly tag: string;
  constructor(tag = "div") {
    super();
    this.tag = tag;
  }
  get ownerDocument() {
    return document;
  }
  get parentNode() {
    return this.parentElement;
  }
  get isConnected(): boolean {
    return this.parentElement?.isConnected ?? this.attached;
  }
  get firstElementChild(): QuestNode | null {
    return this.children[0] ?? null;
  }
  get childElementCount() {
    return this.children.length;
  }
  get nextSibling(): QuestNode | null {
    return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null;
  }
  matches(selector: string): boolean {
    return selector.split(",").some((item) => {
      const part = item.trim();
      switch (part) {
        case ":disabled":
          return this.disabled;
        case "[hidden]":
          return this.hidden;
        case "[data-action]":
          return this.dataset.action !== undefined || this.attributes.has("data-action");
        case '[aria-disabled="true" i]':
          return this.getAttribute("aria-disabled")?.toLowerCase() === "true";
        case '[role="button"]':
          return this.getAttribute("role") === "button";
        case "[inert]":
          return this.attributes.has("inert");
        default:
          return part.startsWith(".")
            ? this.className.split(" ").includes(part.slice(1))
            : this.tag === part;
      }
    });
  }
  closest(selector: string): QuestNode | null {
    return this.matches(selector) ? this : (this.parentElement?.closest(selector) ?? null);
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  querySelectorAll(selector: string): QuestNode[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  contains(target: unknown): boolean {
    return target === this || this.children.some((child) => child.contains(target));
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      this.parentElement = null;
    }
  }
  insertBefore(node: QuestNode, before: QuestNode | null) {
    node.remove();
    node.parentElement = this;
    this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, node);
    return node;
  }
  append(...nodes: QuestNode[]) {
    for (const node of nodes) {
      this.insertBefore(node, null);
    }
  }
  prepend(node: QuestNode) {
    this.insertBefore(node, this.firstElementChild);
  }
  replaceChildren(...nodes: QuestNode[]) {
    for (const node of [...this.children]) {
      node.remove();
    }
    this.append(...nodes);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  toggleAttribute(name: string, enabled: boolean) {
    if (enabled) {
      this.setAttribute(name, "");
    } else {
      this.removeAttribute(name);
    }
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
}

const producer = vi.hoisted(() => ({
  disposeCard: vi.fn(),
  fit: vi.fn(),
  reveal: vi.fn(),
  scroll: vi.fn<(card: { readonly body: QuestNode }, group: QuestNode) => void>(),
}));
vi.mock("./modal.ts", async (load) => ({
  ...(await load<typeof import("./modal.ts")>()),
  createButton: (label: string) => Object.assign(new QuestNode("button"), { textContent: label }),
  createCard: ({ close }: { close: QuestNode }) => {
    const frame = new QuestNode();
    const card = new QuestNode();
    const body = new QuestNode();
    card.append(body);
    frame.append(card, close);
    return { body, card, close, dispose: producer.disposeCard, fit: producer.fit, frame };
  },
  setScrollGroup: producer.scroll,
}));
vi.mock("./modalLayer.ts", () => ({
  createModalLayer: () => ({ dispose() {}, open: producer.reveal.mockReturnValue(() => {}) }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  producer.disposeCard.mockClear();
  producer.reveal.mockClear();
  producer.scroll.mockClear();
});
function screenFixture(owned = true, beforeCreate?: (root: QuestNode) => void) {
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    createElement: (tag: string) => new QuestNode(tag),
    createElementNS: (_namespace: string, tag: string) => new QuestNode(tag),
    createTextNode: (text: string) => Object.assign(new QuestNode("#text"), { textContent: text }),
    defaultView: { HTMLElement: QuestNode, Node: QuestNode },
  });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
  const root = new QuestNode();
  if (owned) {
    fixtureActionRoot(root);
  }
  root.attached = true;
  beforeCreate?.(root);
  const onClose = vi.fn();
  const onLocate = vi.fn();
  const screen = createQuestsScreen(root as unknown as HTMLElement, {
    labels: mapScreenLabels(CONTENT.labels),
    onClose,
    onLocate,
    reducedMotion: () => true,
  });
  return { onClose, onLocate, root, screen };
}

it("publishes the hidden Quests modal with its original Close already registered", () => {
  const publication: { bound: boolean; hidden: boolean }[] = [];
  const { root, screen } = screenFixture(true, (root) => {
    const append = root.append.bind(root);
    vi.spyOn(root, "append").mockImplementation((...nodes) => {
      append(...nodes);
      const [modal] = nodes;
      expect(modal?.isConnected).toBe(true);
      const controls = modal!.querySelectorAll("button");
      expect(controls).toHaveLength(1);
      let bound = true;
      try {
        actionBinding.assertAdaActionMetadata(controls[0] as unknown as HTMLElement);
      } catch {
        bound = false;
      }
      publication.push({ bound, hidden: modal!.hidden });
    });
  });
  expect(publication).toEqual([{ bound: true, hidden: true }]);
  expect(screen.isOpen()).toBe(false);
  screen.dispose();
  expect(root.children).toEqual([]);
});

it("rejects a missing permanent Quests binding before first attachment", () => {
  vi.spyOn(actionBinding, "bindAdaAction").mockImplementationOnce(() => ({
    activate: () => false,
    dispose() {},
    update() {},
  }));
  const attached = vi.fn();
  expect(() =>
    screenFixture(true, (root) => {
      vi.spyOn(root, "append").mockImplementation(attached);
    }),
  ).toThrow("no registered action binding");
  expect(attached).not.toHaveBeenCalled();
  expect(producer.disposeCard).toHaveBeenCalledOnce();
});

it("releases the permanent Quests binding if attachment throws after insertion", () => {
  let publishedRoot: QuestNode | undefined;
  let close: HTMLElement | undefined;
  expect(() =>
    screenFixture(true, (root) => {
      publishedRoot = root;
      const append = root.append.bind(root);
      vi.spyOn(root, "append").mockImplementation((...nodes) => {
        append(...nodes);
        close = nodes[0]!.querySelectorAll("button")[0] as unknown as HTMLElement;
        actionBinding.assertAdaActionMetadata(close);
        throw Error("attachment failed");
      });
    }),
  ).toThrow("attachment failed");
  expect(publishedRoot?.children).toEqual([]);
  expect(close).toBeDefined();
  expect(() => actionBinding.assertAdaActionMetadata(close!)).toThrow(
    "no registered action binding",
  );
  expect(producer.disposeCard).toHaveBeenCalledOnce();
});

it("audits completed Quests rows on semantic changes, including disabled routes, before reveal", () => {
  const audit = vi.spyOn(actionBinding, "assertAdaActionBindings");
  const original = actionBinding.bindAdaAction;
  const policy = vi.fn(() => {
    throw Error("construction evaluated runtime policy");
  });
  vi.spyOn(actionBinding, "bindAdaAction").mockImplementation((options, node) =>
    original(
      { ...options, click: { ...options.click, availability: policy }, current: policy },
      node,
    ),
  );
  const { screen } = screenFixture();
  screen.setState([entry], [], 1);
  screen.open();
  expect(audit).toHaveBeenCalledTimes(1);
  screen.setState([entry], [], 1);
  expect(audit).toHaveBeenCalledTimes(1);
  screen.setState([entry, { ...entry, id: "other" }], [], 1);
  expect(audit).toHaveBeenCalledTimes(2);
  screen.open(entry.id, "ship");
  expect(audit).toHaveBeenCalledTimes(3);
  expect(policy).not.toHaveBeenCalled();
  expect(producer.reveal).toHaveBeenCalledTimes(3);
  screen.dispose();
});

it("rejects a missing dynamic Quests row binding before reveal", () => {
  const { screen } = screenFixture();
  screen.setState([entry], [], 1);
  vi.spyOn(actionBinding, "bindAdaAction").mockImplementationOnce(() => ({
    activate: () => false,
    dispose() {},
    update() {},
  }));
  expect(() => screen.open()).toThrow("no registered action binding");
  expect(producer.reveal).not.toHaveBeenCalled();
  screen.dispose();
});

it("rejects an unowned connected Quests subtree before reveal without evaluating readiness", () => {
  const { screen } = screenFixture(false);
  screen.setState([entry], [], 1);
  expect(() => screen.open()).toThrow("no live action root");
  expect(producer.reveal).not.toHaveBeenCalled();
  screen.dispose();
});

it("keeps Back outside the quest detail's scroll group", () => {
  const { screen } = screenFixture();
  screen.setState([entry], [place("growers")], 1);
  screen.open(entry.id);
  expect(producer.scroll).toHaveBeenCalledOnce();
  const [card, detail] = producer.scroll.mock.lastCall!;
  expect(detail.className).toBe("ada-quest-content");
  const [body, footer] = card.body.children;
  expect(body).toBe(detail);
  expect(footer?.className).toBe("ada-quest-footer");
  expect(footer?.querySelectorAll("button")[0]?.dataset.action).toBe("quest-back");
  screen.dispose();
});

it("refuses visible pager boundaries and keeps replaced actions inert", () => {
  const { onClose, root, screen } = screenFixture();
  screen.setState([entry, { ...entry, id: "extra" }, { ...entry, id: "last" }], [], 1);
  screen.open();
  const labels = mapScreenLabels(CONTENT.labels);
  const buttons = () =>
    root.querySelectorAll(".ada-quest-footer")[0]!.querySelectorAll(".ui-standard-button");
  const button = (label: string) => buttons().find((node) => node.textContent === label)!;
  const hold = (node: QuestNode) =>
    actionBinding.resolveAdaHoldAction(root as unknown as HTMLElement, node);
  const click = (node: QuestNode) => node.dispatchEvent(new Event("click", { cancelable: true }));
  expect(buttons().map(({ textContent }) => textContent)).toEqual([
    labels.previous,
    labels.next,
    labels.close,
  ]);
  const previous = button(labels.previous);
  const next = button(labels.next);
  expect(previous.disabled).toBe(false);
  expect(previous.getAttribute("aria-disabled")).toBe("true");
  expect(previous.tabIndex).toBe(-1);
  expect(previous.hidden).toBe(false);
  expect(hold(previous)?.ownAriaDisabled).toBe("refusal-feedback");
  click(previous);
  expect(previous.hasAttribute("data-ui-refusal-red")).toBe(false);
  hold(previous)!.activate();
  expect(previous.hasAttribute("data-ui-refusal-red")).toBe(true);
  expect(previous.hasAttribute("data-ui-refusal-shake")).toBe(false);
  expect(root.querySelectorAll("output")[0]?.textContent).toBe("1/2");
  expect(button(labels.next)).toBe(next);

  const paging = hold(next)!;
  expect(paging.available()).toBe(true);
  paging.activate();
  expect(paging.available()).toBe(false);
  const lastNext = button(labels.next);
  expect(lastNext.getAttribute("aria-disabled")).toBe("true");
  expect(lastNext.tabIndex).toBe(-1);
  expect(button(labels.previous).tabIndex).toBe(0);
  hold(lastNext)!.activate();
  expect(lastNext.hasAttribute("data-ui-refusal-red")).toBe(true);
  expect(root.querySelectorAll("output")[0]?.textContent).toBe("2/2");
  click(next);
  expect(
    root
      .querySelectorAll("button")
      .filter(({ dataset }) => dataset.questId)
      .map(({ dataset }) => dataset.questId),
  ).toEqual(["last"]);
  const row = root.querySelectorAll("button").find(({ dataset }) => dataset.questId === "last")!;
  expect(row.matches(".ui-standard-button")).toBe(true);
  expect(row.children[0]?.className).toBe("ada-quest-icon");
  expect(row.querySelectorAll(".ui-control-label")[0]?.textContent).toBe(entry.line.text);
  click(row);
  expect(hold(row)).toBeNull();
  click(button(labels.questBack ?? labels.close));
  expect(producer.reveal.mock.lastCall?.[0].focus.dataset.questId).toBe("last");

  const close = button(labels.close);
  expect(close.getAttribute("data-ui-button-role")).toBe("primary");
  click(close);
  click(close);
  expect(onClose).toHaveBeenCalledOnce();
  screen.dispose();
});

it("resumes the selected endpoint and original filtered list page after locating", () => {
  const { onClose, onLocate, root, screen } = screenFixture();
  const quests = [entry, { ...entry, id: "extra" }, { ...entry, id: "last" }];
  const places = [place("growers"), place("workshop")];
  screen.setState([...quests, { ...entry, id: "unrelated" }], places, 1);
  screen.openContext({ quests, targetId: "growers" });
  const buttons = () => root.querySelectorAll("button");
  const click = (button: QuestNode) => button.dispatchEvent(new Event("click"));
  click(buttons().find(({ textContent }) => textContent === CONTENT.labels.next)!);
  click(buttons().find(({ dataset }) => dataset.questId === "last")!);
  const original = buttons().find(
    (node) => node.getAttribute("aria-label") === "Show on map: Workshop",
  )!;
  click(original);
  expect(onLocate).toHaveBeenCalledExactlyOnceWith("workshop");
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.isOpen()).toBe(false);
  expect(screen.isSuspended()).toBe(true);

  screen.resume();
  expect(screen.isOpen()).toBe(true);
  expect(screen.isSuspended()).toBe(false);
  const restored = producer.reveal.mock.lastCall?.[0].focus;
  expect(restored).not.toBe(original);
  expect(restored.getAttribute("aria-label")).toBe("Show on map: Workshop");
  screen.back();
  expect(
    buttons()
      .filter(({ dataset }) => dataset.questId)
      .map(({ dataset }) => dataset.questId),
  ).toEqual(["last"]);
  expect(producer.reveal.mock.lastCall?.[0].focus.dataset.questId).toBe("last");
  screen.back();
  expect(onClose).toHaveBeenCalledOnce();
  screen.dispose();
});

it("focuses dismissal when the located endpoint is no longer on the map", () => {
  const { onClose, root, screen } = screenFixture();
  screen.setState([entry], [place("growers"), place("workshop")], 1);
  screen.openContext({ quests: [entry], targetId: "growers" });
  const target = root
    .querySelectorAll("button")
    .find((node) => node.className === "ada-quest-endpoint")!;
  target.dispatchEvent(new Event("click"));
  expect(screen.isSuspended()).toBe(true);
  screen.setState([entry], [place("workshop")], 1);
  screen.resume();
  expect(producer.reveal.mock.lastCall?.[0].focus.dataset.action).toBe("quest-close");
  expect(onClose).not.toHaveBeenCalled();
  screen.back();
  expect(onClose).toHaveBeenCalledOnce();
  screen.dispose();
});

it("returns to the caller when a suspended filtered context becomes empty", () => {
  const { onClose, root, screen } = screenFixture();
  screen.setState([entry], [place("growers")], 1);
  screen.openContext({ quests: [entry], targetId: "growers" });
  root
    .querySelectorAll("button")
    .find((node) => node.className === "ada-quest-endpoint")!
    .dispatchEvent(new Event("click"));
  expect(screen.isSuspended()).toBe(true);
  screen.setState([{ ...entry, id: "unrelated" }], [place("growers")], 1);
  expect(onClose).not.toHaveBeenCalled();
  screen.resume();
  expect(screen.isSuspended()).toBe(false);
  expect(screen.isOpen()).toBe(false);
  expect(onClose).toHaveBeenCalledOnce();
  screen.dispose();
});

it("left-aligns a quest line button's chip and label from the button's inset", () => {
  // art/map.md "Quests modal": content left-aligned, not the base button's centred content.
  const rule = QUESTS_SCREEN_STYLE.match(
    /\.ada-controls \.ada-quest-list \.ada-button\{([^}]+)\}/u,
  )?.[1];
  expect(rule).toContain("justify-content:flex-start");
  expect(rule).toContain("text-align:left");
  expect(QUESTS_SCREEN_STYLE).toMatch(
    /\[data-quest-id\]>.ui-control-label\{[^}]*text-align:inherit/u,
  );
});

it("starts a quest line's label on the 42 text column, its disc centred in the 28 slot", () => {
  // art/map.md "Quests modal": the 28 chip slot from the face's inset, markGap, then the text.
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  // A declaration's logical length, from the ruleset whose whole selector is the one given.
  const length = (css: string, selector: string, property: string) => {
    const rule = new RegExp(`${escape(selector)}\\{([^}]+)\\}`, "u").exec(css)?.[1] ?? "";
    const value = `(?:0 )?${escape("calc(var(--ada-unit) * ")}([\\d.]+)px\\)`;
    return Number(new RegExp(`(?:^|[\\s;])${property}:${value}`, "u").exec(rule)?.[1]);
  };
  const list = ".ada-controls .ada-quest-list .ada-button";
  const gap = length(QUESTS_SCREEN_STYLE, list, "gap");
  const icon = `${list}>.ada-quest-icon`;
  const iconRule = QUESTS_SCREEN_STYLE.match(new RegExp(`${escape(icon)}\\{([^}]+)\\}`, "u"))?.[1];
  const margin = 2;
  expect(iconRule).toContain(`margin:${units(-2)} ${units(margin)}`);
  const questLine = ".ada-controls .ada-quests-screen .ada-quest-list .ada-button[data-quest-id]";
  expect(QUESTS_SCREEN_STYLE).toContain(
    `${questLine}{\n  padding-inline:calc(${units(8)} - ${slice(BUTTON_SLICE.left)})}`,
  );
  expect({
    gap,
    mapped: MAP_SCREEN.quests.inset + margin + QUEST_ICON + margin + gap,
    slot: margin + QUEST_ICON + margin,
    visibleGap: margin + gap,
  }).toEqual({
    gap: MAP_SCREEN.quests.markGap,
    mapped: MAP_SCREEN.quests.textColumn,
    slot: MAP_SCREEN.quests.chip,
    visibleGap: 8,
  });
  expect(MAP_SCREEN.quests.textColumn).toBe(42);
});
