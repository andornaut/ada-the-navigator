import { afterEach, expect, it, vi } from "vitest";

import { WEAPON_DETAIL_LABELS, weaponDetailLines } from "../data/weaponDetails.ts";
import { compactLevelName } from "./compactLevelName.ts";
import { createWeaponDetailCard } from "./weaponDetailCard.ts";

const fixture = vi.hoisted(() => {
  class Node extends EventTarget {
    children: Node[] = [];
    className = "";
    dataset: Record<string, string> = {};
    hidden = false;
    textContent = "";
    style = { display: "", setProperty: vi.fn() };
    replaceChildren(...nodes: Node[]) {
      this.children = nodes;
    }
    setAttribute() {}
    removeAttribute() {}
    focus = vi.fn();
    remove = vi.fn();
    append(...nodes: Node[]) {
      this.children.push(...nodes);
    }
  }
  const card = {
    body: new Node(),
    card: new Node(),
    close: new Node(),
    dispose: vi.fn(),
    fit: vi.fn(),
    frame: new Node(),
    title: new Node(),
  };
  return { Node, card };
});
vi.mock("./modal.ts", () => ({
  createActions: (actions: { button: InstanceType<typeof fixture.Node> }[]) => {
    const node = new fixture.Node();
    node.append(...actions.map((action) => action.button));
    return node;
  },
  createButton: () => new fixture.Node(),
  createCard: () => fixture.card,
  isTap: () => true,
  setFooterAction: (action: string, row: { dataset: Record<string, string> }) => {
    row.dataset.footerAction = action;
  },
}));
vi.mock("./layout/viewScale.ts", () => ({ readViewUnit: () => 1 }));
vi.mock("@andornaut/game-kit/web/ui/dom/focusModality", () => ({
  focusTarget: (node: { focus(): void }) => node.focus(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  fixture.card.body.children = [];
  fixture.card.title.children = [];
});

it("uses the shared card and reports exactly one pause/close transition, restoring origin focus", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const root = new fixture.Node();
  const origin = new fixture.Node();
  const onOpenChange = vi.fn();
  const resource = createWeaponDetailCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange,
  });
  expect(resource.isOpen()).toBe(false);
  resource.open("Ore", ["Approved description"], origin as unknown as HTMLElement);
  expect(resource.isOpen()).toBe(true);
  expect(fixture.card.title.textContent).toBe("Ore");
  expect(fixture.card.body.children[0]!.children[0]!.textContent).toBe("Approved description");
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  expect(fixture.card.fit).toHaveBeenCalledOnce();
  fixture.card.body.children.at(-1)!.children[0]!.dispatchEvent(new Event("click"));
  resource.close();
  expect(resource.isOpen()).toBe(false);
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(origin.focus).toHaveBeenCalledOnce();
  resource.dispose();
  expect(fixture.card.dispose).toHaveBeenCalledOnce();
});

it("reopens with current content and traps Tab on the close control", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const root = new fixture.Node();
  const origin = new fixture.Node();
  const resource = createWeaponDetailCard(root as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange: vi.fn(),
  });
  resource.open("Ore", ["First"], origin as unknown as HTMLElement);
  resource.close();
  resource.open("Stardust", ["Second"], origin as unknown as HTMLElement);
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperty(event, "key", { value: "Tab" });
  root.children[0]!.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(fixture.card.title.textContent).toBe("Stardust");
  expect(fixture.card.body.children[0]!.children[0]!.textContent).toBe("Second");
  resource.dispose();
});

it.each([1, 2, 3])(
  "shows canonical icon and level %s in the owned title instead of a description row",
  (level) => {
    vi.stubGlobal("document", { createElement: () => new fixture.Node() });
    const detail = createWeaponDetailCard(new fixture.Node() as unknown as HTMLElement, {
      closeLabel: "Close",
      onOpenChange: vi.fn(),
    });
    detail.open(
      "Rapid Missile",
      weaponDetailLines("rapidMissile", level),
      new fixture.Node() as unknown as HTMLElement,
      { ammo: 0, ammoLabel: "Ammo", id: "rapidMissile", level },
    );
    const [icon, label] = fixture.card.title.children;
    expect(label!.textContent).toBe(compactLevelName(level, "Rapid Missile"));
    expect(icon!.dataset).toEqual({ level: String(level), state: "idle", weapon: "rapidMissile" });
    expect(icon!.children[0]!.style.setProperty).toHaveBeenCalledWith(
      "--glyph",
      "url('/art/ui/icons/weapon-rapidMissile.svg')",
    );
    expect(icon!.children[1]!.children).toHaveLength(level === 1 ? 0 : level);
    const lines = fixture.card.body.children[0]!.children.map((node) => node.textContent);
    expect(lines).not.toContain("Ammo: 0 left");
    const row = fixture.card.body.children[1]!;
    expect(row.hidden).toBe(false);
    expect(row.children[0]!.className).toBe("ada-detail-ammo-icon");
    expect(row.children[1]!.textContent).toBe("0");
    expect(lines.some((line) => line.startsWith("Level "))).toBe(false);
    detail.dispose();
  },
);

it("keeps an unowned preview unnumbered without inventing owned level metadata", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const detail = createWeaponDetailCard(new fixture.Node() as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange: vi.fn(),
  });
  detail.open(
    "Rapid Missile",
    [WEAPON_DETAIL_LABELS.detailIncludesAmmo],
    new fixture.Node() as unknown as HTMLElement,
    { id: "rapidMissile" },
  );
  const [icon, label] = fixture.card.title.children;
  expect(label!.textContent).toBe("Rapid Missile");
  expect(icon!.dataset).not.toHaveProperty("level");
  expect(icon!.children[1]!.children).toHaveLength(0);
  expect(fixture.card.body.children[0]!.children[0]!.textContent).toBe(
    WEAPON_DETAIL_LABELS.detailIncludesAmmo,
  );
  detail.dispose();
});

it("renders basic Laser's existing glyph and Unlimited row without a level-one suffix or repeated ammo prose", () => {
  vi.stubGlobal("document", { createElement: () => new fixture.Node() });
  const detail = createWeaponDetailCard(new fixture.Node() as unknown as HTMLElement, {
    closeLabel: "Close",
    onOpenChange: vi.fn(),
  });
  detail.open(
    "Laser",
    weaponDetailLines("laser", 1),
    new fixture.Node() as unknown as HTMLElement,
    { ammo: null, ammoLabel: "Ammo", id: "laser", level: 1 },
  );
  expect(fixture.card.title.children[1]!.textContent).toBe("Laser");
  const row = fixture.card.body.children[1]!;
  expect(row.children[0]!.className).toBe("ada-detail-unlimited-icon");
  expect(row.children[1]!.textContent).toBe("Unlimited");
  expect(fixture.card.body.children[0]!.children.map((node) => node.textContent)).toEqual(
    weaponDetailLines("laser", 1),
  );
  detail.close();
  detail.open(
    "Rapid Missile",
    [WEAPON_DETAIL_LABELS.detailIncludesAmmo],
    new fixture.Node() as unknown as HTMLElement,
    { id: "rapidMissile" },
  );
  expect(row.hidden).toBe(true);
  expect(row.children).toEqual([]);
  detail.dispose();
});
