import { existsSync, readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StationServices } from "../model/stationServices.ts";
import { createModalLayer } from "./modalLayer.ts";
import { currentView, rootPressGuard } from "./pressScope.ts";
import {
  jobAction,
  rowAction,
  STATION_STYLE,
  stationBack,
  stationJobsShown,
  stationTabs,
  weaponItemGlyph,
} from "./station.ts";
import { buttonProperty } from "./uiSkin.ts";

describe("station card back steps", () => {
  it("returns from the shop and the job board to the station card and undocks only from it", () => {
    expect(stationBack("shop", false)).toBe("card");
    expect(stationBack("jobs", false)).toBe("card");
    expect(stationBack("card", false)).toBe("undock");
  });

  it("cancels an open confirm back to the card under it", () => {
    expect(stationBack("shop", true)).toBe("shop");
    expect(stationBack("jobs", true)).toBe("jobs");
  });
});

describe("job row taps", () => {
  it("accept offers, keep refused offers tappable so they refuse, and drop the held job", () => {
    expect(jobAction("offer")).toBe("accept");
    expect(jobAction("busy")).toBe("accept");
    expect(jobAction("held")).toBe("drop");
  });
});

describe("shop row taps", () => {
  it("keeps unaffordable rows tappable so they refuse", () => {
    expect(rowAction("unaffordable")).toBe("request");
    expect(rowAction("forSale")).toBe("request");
  });

  it("applies an owned paint at once and ignores owned and in-use rows", () => {
    expect(rowAction("selectable")).toBe("select");
    expect(rowAction("owned")).toBe("none");
    expect(rowAction("inUse")).toBe("none");
  });
});

describe("weapon shop glyphs", () => {
  it("draws every weapon's two-frame shop sheet", () => {
    for (const weapon of [
      "laser",
      "rapidMissile",
      "multiLaser",
      "heavyMissile",
      "scattershot",
      "phaser",
    ] as const) {
      expect(weaponItemGlyph(weapon)).toEqual({
        key: `icon-shop-weapon-${weapon}`,
        kind: "sprite",
      });
    }
    expect(STATION_STYLE).not.toContain("ada-glyph-weapon");
  });

  it("places an upgrade composite's weapon sheet at (0, 4) under its badge", () => {
    expect(STATION_STYLE).toContain(".ada-controls .ada-glyph-upgrade > .ada-glyph{");
    expect(STATION_STYLE).not.toContain(".ada-glyph-upgrade .ada-glyph-weapon{");
  });
});

describe("shop style", () => {
  it("draws rows with the ui-button-tile frames", () => {
    for (const tag of ["normal", "pressed", "disabled"] as const) {
      expect(STATION_STYLE).toContain(`var(${buttonProperty("ui-button-tile", tag)})`);
    }
  });

  it("draws every tile row's second line and Owned in row supporting, and busy rows in row disabled", () => {
    const rule = (selector: string) => {
      const from = STATION_STYLE.indexOf(`${selector}{`);
      expect(from, selector).toBeGreaterThanOrEqual(0);
      return STATION_STYLE.slice(from, STATION_STYLE.indexOf("}", from));
    };
    expect(rule(".ada-controls .ada-shop-level")).toContain("color:#c0bbd0");
    expect(rule(".ada-controls [data-state=unaffordable] .ada-shop-level")).toContain(
      "color:#a6a2b8",
    );
    expect(rule(".ada-controls .ada-owned")).toContain("color:#c0bbd0");
    expect(rule(".ada-controls .ada-shop-row[data-state=unaffordable]")).toContain("color:#a6a2b8");
  });

  it("gives job rows their type's sheet and a compact action that takes no press of its own", () => {
    for (const type of ["survey", "delivery", "rescue", "hunt", "activity"]) {
      expect(
        existsSync(new URL(`../../public/art/ui/sprites/icon-job-${type}.png`, import.meta.url)),
      ).toBe(true);
    }
    expect(STATION_STYLE).toContain(".ada-controls .ada-job-action.ada-compact{");
    expect(STATION_STYLE).toContain("pointer-events:none");
    expect(STATION_STYLE).toContain("var(--ui-button-primary-disabled)");
    // No row keeps a placeholder flat mark: the activity row takes its sheet too.
    expect(STATION_STYLE).not.toMatch(/ada-job-glyph\[data-type=/u);
  });
});

describe("canonical station service presentation", () => {
  const exchangeOnly: StationServices = {
    equipment: false,
    exchange: true,
    heldTask: false,
    jobs: false,
    projects: false,
    weaponsAmmo: false,
  };

  it.each([
    ["equipment", ["ship", "exchange"], false],
    ["weaponsAmmo", ["weapons", "exchange"], false],
    ["jobs", ["exchange"], true],
  ] as const)("shows only the %s specialty while retaining Exchange", (service, tabs, jobs) => {
    const actual = { ...exchangeOnly, [service]: true };
    expect(stationTabs(actual)).toEqual(tabs);
    expect(stationJobsShown(actual)).toBe(jobs);
  });

  it("keeps held-task Drop and existing Projects independent of specialist offers", () => {
    const held = { ...exchangeOnly, heldTask: true, projects: true };
    expect(stationJobsShown(held)).toBe(true);
    expect(stationTabs(held)).toEqual(["projects", "exchange"]);
    expect(stationTabs(exchangeOnly)).toEqual(["exchange"]);
    expect(stationJobsShown(exchangeOnly)).toBe(false);
  });

  it("keeps every existing hub capability and exposes nothing off dock", () => {
    const hub = {
      equipment: true,
      exchange: true as const,
      heldTask: true,
      jobs: true,
      projects: true,
      weaponsAmmo: true,
    };
    expect(stationTabs(hub)).toEqual(["weapons", "ship", "projects", "exchange"]);
    expect(stationJobsShown(hub)).toBe(true);
    expect(stationTabs(null)).toEqual([]);
    expect(stationJobsShown(null)).toBe(false);
  });
});

const strictCleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of strictCleanup.splice(0)) {
    dispose();
  }
  vi.unstubAllGlobals();
});

function strictStation() {
  class Node extends EventTarget {
    readonly attributes = new Map<string, string>();
    readonly children: Node[] = [];
    parentElement: Node | null = null;
    hidden = false;
    tabIndex = 0;
    button = false;
    get ownerDocument(): Document {
      return doc as unknown as Document;
    }
    get isConnected(): boolean {
      return this.parentElement?.isConnected ?? true;
    }
    append(...nodes: Node[]) {
      for (const node of nodes) {
        node.parentElement = this;
        this.children.push(node);
      }
    }
    contains(node: unknown): boolean {
      return node === this || this.children.some((child) => child.contains(node));
    }
    hasAttribute(name: string) {
      return name === "hidden" ? this.hidden : this.attributes.has(name);
    }
    getAttribute(name: string) {
      return this.attributes.get(name) ?? null;
    }
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }
    removeAttribute(name: string) {
      this.attributes.delete(name);
    }
    closest(selector: string): Node | null {
      return (selector.includes("hidden") && this.hidden) ||
        (selector.includes("inert") && this.hasAttribute("inert"))
        ? this
        : (this.parentElement?.closest(selector) ?? null);
    }
    querySelectorAll(selector: string): Node[] {
      return this.children.flatMap((child) => [
        ...(selector.includes("button") && child.button ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
    querySelector(): Node | null {
      return this.children[0] ?? null;
    }
    focus() {
      doc.activeElement = this;
    }
  }
  const doc = Object.assign(new EventTarget(), {
    activeElement: null as Node | null,
    defaultView: {
      HTMLElement: Node,
      MutationObserver: class {
        disconnect() {}
        observe() {}
        takeRecords() {
          return [];
        }
      },
      Node,
    },
  });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("HTMLElement", Node);
  const parent = new Node(),
    modal = new Node(),
    confirmModal = new Node(),
    dropHost = new Node();
  const part = () => {
    const frame = new Node(),
      close = new Node();
    close.button = true;
    frame.append(close);
    return { close, frame };
  };
  const stationCard = part(),
    shopCard = part(),
    jobsCard = part(),
    confirmCard = part(),
    drop = part();
  modal.append(stationCard.frame, shopCard.frame, jobsCard.frame);
  dropHost.append(drop.frame);
  confirmModal.append(confirmCard.frame, dropHost);
  parent.append(modal, confirmModal);
  shopCard.frame.hidden = jobsCard.frame.hidden = confirmModal.hidden = dropHost.hidden = true;
  const stationLayer = createModalLayer(modal as unknown as HTMLElement),
    confirmationLayer = createModalLayer(confirmModal as unknown as HTMLElement);
  strictCleanup.push(() => {
    stationLayer.dispose();
    confirmationLayer.dispose();
  });
  const back = vi.fn();
  const context = createContext({
    HTMLElement: Node,
    back,
    confirm: null,
    confirmCard,
    confirmModal,
    confirmationLayer,
    disposed: false,
    document: doc,
    dropHost,
    jobsCard,
    leavePress: undefined,
    modal,
    open: true,
    pressDialog: undefined,
    shopCard,
    stationCard,
    stationLayer,
    view: "card",
  });
  const source = ts.createSourceFile(
    "station.ts",
    readFileSync(new URL("./station.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let initializer: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "syncPressView") {
      initializer = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!initializer) {
    throw new Error("Missing Station foreground synchronizer");
  }
  const sync = runInContext(
    ts.transpileModule(`(${initializer.getText(source)})`, {
      compilerOptions: { target: ts.ScriptTarget.ES2023 },
    }).outputText,
    context,
  ) as () => void;
  return {
    back,
    confirmCard,
    confirmModal,
    context,
    doc,
    drop,
    dropHost,
    jobsCard,
    modal,
    parent: parent as unknown as HTMLElement,
    shopCard,
    stationCard,
    sync,
  };
}

it("isolates the current Station page, invalidates replaced views and releases the closed station", () => {
  const f = strictStation(),
    guard = rootPressGuard(f.parent),
    before = guard.gate.capture();
  f.sync();
  expect(before()).toBe(false);
  expect(currentView(f.parent)).toBe(f.stationCard.frame);
  expect(f.stationCard.frame.hasAttribute("aria-modal")).toBe(true);
  expect(f.stationCard.frame.contains(f.doc.activeElement)).toBe(true);
  const cardPress = guard.gate.capture();
  f.context.view = "shop";
  f.stationCard.frame.hidden = true;
  f.shopCard.frame.hidden = false;
  f.sync();
  expect(cardPress()).toBe(false);
  expect(currentView(f.parent)).toBe(f.shopCard.frame);
  const shopPress = guard.gate.capture();
  f.context.open = false;
  f.modal.hidden = true;
  f.sync();
  expect(shopPress()).toBe(false);
  expect(currentView(f.parent)).toBe(f.parent);
  expect(f.back).not.toHaveBeenCalled();
});

it("uses the actual purchase or drop card as the strict dialog rather than its backdrop", () => {
  const f = strictStation();
  f.context.view = "jobs";
  f.stationCard.frame.hidden = true;
  f.jobsCard.frame.hidden = false;
  f.sync();
  const before = rootPressGuard(f.parent).gate.capture();
  f.context.confirm = { key: "offer" };
  f.confirmModal.hidden = false;
  f.sync();
  expect(before()).toBe(false);
  expect(currentView(f.parent)).toBe(f.confirmCard.frame);
  expect(currentView(f.parent)).not.toBe(f.confirmModal);
  expect(f.modal.hasAttribute("inert")).toBe(true);
  f.context.confirm = { drop: true };
  f.confirmCard.frame.hidden = true;
  f.dropHost.hidden = false;
  f.sync();
  expect(currentView(f.parent)).toBe(f.drop.frame);
  expect(f.drop.frame.contains(f.doc.activeElement)).toBe(true);
  f.context.confirm = null;
  f.confirmModal.hidden = true;
  f.sync();
  expect(currentView(f.parent)).toBe(f.jobsCard.frame);
  expect(f.back).not.toHaveBeenCalled();
});
