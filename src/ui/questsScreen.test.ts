import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { BUTTON_SLICE } from "../data/layout.ts";
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
    ).toBe("/art/ui/icons/map-growers.svg");
    expect(
      questObjectiveIcon(current, { checked: false, label: "Visit", location: "unrevealed" }),
    ).toBeNull();
  });
});

it("uses the canonical holodisk notice icon only for the revealed current item", async () => {
  const { questChecklist, questObjectiveIcon } = await import("./questsScreen.ts");
  const { gainNotice } = await import("./itemNotice.ts");
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
  const { icon } = gainNotice({}, { kind: "holodisk" });
  expect(questObjectiveIcon(current, row)).toBe(
    "sprite" in icon ? `/art/ui/sprites/${icon.sprite}.png` : icon.mask,
  );
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
    "/art/ui/icons/map-job-survey.svg",
  );
  expect(questContextIcon({ quests: [entry, { ...entry, id: "other" }] })).toBe(
    "/art/ui/icons/map-destination.svg",
  );
  const unknown = { ...entry, line: { kind: "story" as const, target: null, text: "Explore" } };
  expect(questContextIcon({ quests: [unknown] })).toBe("/art/ui/icons/map-destination.svg");
});

class QuestNode extends EventTarget {
  parentElement: QuestNode | null = null;
  children: QuestNode[] = [];
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly style = { removeProperty: vi.fn(), setProperty: vi.fn() };
  readonly classList = { add: vi.fn(), remove: vi.fn() };
  attached = false;
  className = "";
  disabled = false;
  hidden = false;
  textContent = "";
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
    return selector === ":disabled"
      ? this.disabled
      : this.tag === "button" || this.attributes.has("data-action");
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
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
}

const producer = vi.hoisted(() => ({ fit: vi.fn(), reveal: vi.fn() }));
vi.mock("./modal.ts", async (load) => ({
  ...(await load<typeof import("./modal.ts")>()),
  createButton: (label: string) => Object.assign(new QuestNode("button"), { textContent: label }),
  createCard: () => {
    const frame = new QuestNode();
    const card = new QuestNode();
    const body = new QuestNode();
    const close = new QuestNode("button");
    card.append(body);
    frame.append(card, close);
    return { body, card, close, dispose() {}, fit: producer.fit, frame };
  },
  setScrollGroup: vi.fn(),
}));
vi.mock("./modalLayer.ts", () => ({
  createModalLayer: () => ({ dispose() {}, open: producer.reveal.mockReturnValue(() => {}) }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  producer.reveal.mockClear();
});
function screenFixture(owned = true) {
  vi.stubGlobal("document", {
    createElement: (tag: string) => new QuestNode(tag),
    createElementNS: (_namespace: string, tag: string) => new QuestNode(tag),
    createTextNode: (text: string) => Object.assign(new QuestNode("#text"), { textContent: text }),
    defaultView: { HTMLElement: QuestNode, Node: QuestNode },
  });
  const root = new QuestNode();
  if (owned) {
    fixtureActionRoot(root);
  }
  root.attached = true;
  const screen = createQuestsScreen(root as unknown as HTMLElement, {
    labels: mapScreenLabels(CONTENT.labels),
    onClose: vi.fn(),
    onLocate: vi.fn(),
  });
  return { root, screen };
}

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

it("left-aligns a quest line button's chip and label from the button's inset", () => {
  // art/map.md "Quests modal": content left-aligned, not the base button's centred content.
  const rule = QUESTS_SCREEN_STYLE.match(
    /\.ada-controls \.ada-quest-list \.ada-button\{([^}]+)\}/u,
  )?.[1];
  expect(rule).toContain("justify-content:flex-start");
  expect(rule).toContain("text-align:left");
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
