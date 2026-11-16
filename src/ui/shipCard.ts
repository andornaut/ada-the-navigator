import {
  type LayoutComponentPorts,
  mountLayout,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { ECONOMY } from "../data/economy.ts";
import { GALAXY_COUNT } from "../data/galaxies.ts";
import type { Weapon } from "../data/types.ts";
import { WEAPON_LEVEL_COUNT } from "../data/weaponCatalog.ts";
import { weaponGlyphPath } from "../data/weaponGlyphs.ts";
import { fill, weaponName } from "../model/shop.ts";
import type { Aboard } from "../model/types.ts";
import { bindAdaAction } from "./actionBinding.ts";
import { applyAdaControlTheme, createAdaPageDivider } from "./buttonPresentation.ts";
import { compactLevelName } from "./compactLevelName.ts";
import { SCROLL } from "./layout/contentCard.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { TEXT_TOKENS } from "./modal.ts";
import { type ShipHeadings, shipItemKey, type ShipLayoutSchema, shipTree } from "./shipTree.ts";
import { stardustCount } from "./statusPill.ts";

export { SHIP_CARD, SHIP_CARD_STYLE } from "./layout/shipCard.ts";
export { shipItemKey } from "./shipTree.ts";

// Cargo, Equipment and Weapons occupy three inventory columns.

const SPRITES = "/art/ui/sprites/";

export interface ShipWeapon {
  readonly id: Weapon;
  readonly level: number;
  /** Shots left; null for the weapon without ammunition. */
  readonly ammo: number | null;
}

export interface ShipView {
  readonly aboard: Aboard | null;
  /** Canonical held quest identity for cargo details, when one exists. */
  readonly aboardQuestId?: string;
  readonly engine: number;
  readonly holodisks: number;
  /** Ore carried this flight. */
  readonly ore: number;
  /** The ship paint's name. */
  readonly paint: string;
  readonly shield: number;
  readonly stardust: number;
  readonly tractor: number;
  /** Owned weapons in the HUD weapon icons' order. */
  readonly weapons: readonly ShipWeapon[];
}

/** A row's icon: a sprite sheet's first frame, or a vector glyph masked in cream. */
export type ShipIcon =
  { readonly frames: number; readonly sprite: string } | { readonly mask: string };

/** Canonical inventory identities route details without reading player-facing labels. */
export type ShipItem =
  | { readonly kind: "resource"; readonly id: "ore" | "stardust" }
  | { readonly kind: "cargo"; readonly id: "aboard" | "holodisks" }
  | { readonly kind: "equipment"; readonly id: "engine" | "paint" | "shield" | "tractor" }
  | { readonly kind: "weapon"; readonly id: Weapon };

/** One row: its icon, label, and a count or a level, with a weapon's ammunition last. */
export interface ShipRow {
  readonly item: ShipItem;
  /** Live quest identity supplied by the inventory fact, independent of its display label. */
  readonly questId?: string;
  readonly icon: ShipIcon;
  readonly label: string;
  readonly count?: string;
  readonly level?: string;
  /** Canonical numeric level, used only for the compact visible name suffix. */
  readonly tier?: number;
  /** A weapon row: its ammunition, empty for the weapon without it. */
  readonly ammo?: string;
}

export interface ShipSections {
  /** Cargo rows in reading order. */
  readonly cargo: readonly ShipRow[];
  /** Systems and paint for Equipment, then the independent Weapons list. */
  readonly equipment: readonly [readonly ShipRow[], readonly ShipRow[]];
}

type Labels = Readonly<Record<string, string>>;

const sprite = (name: string, frames = 1): ShipIcon => ({ frames, sprite: name });

/** "Carrying: {item}" or "Towing: {craft}", the Ship card's line and the status pill's label. */
export function aboardLabel(labels: Labels, aboard: Aboard): string {
  return aboard.kind === "towing"
    ? fill(labels.shipTowing ?? "", { craft: aboard.name })
    : fill(labels.shipCarrying ?? "", { item: aboard.name });
}

/**
 * The card's sections from player copy. Cargo: Stardust and ore with exact counts, the
 * holodisks, and what Ada carries or tows. Equipment: the shield, engine and tractor beam with
 * their levels and the paint, followed by each owned weapon in the HUD order, with
 * its level and, apart from the unlimited one, its shots left.
 */
export function shipSections(labels: Labels, view: ShipView): ShipSections {
  const level = (value: number, max: number) => fill(labels.shipLevel ?? "", { max, n: value });
  const cargo: ShipRow[] = [
    {
      count: stardustCount(view.stardust),
      icon: sprite("icon-stardust-20"),
      item: { id: "stardust", kind: "resource" },
      label: labels.stardust ?? "",
    },
    {
      count: stardustCount(view.ore),
      icon: sprite("icon-ore-20"),
      item: { id: "ore", kind: "resource" },
      label: labels.ore ?? "",
    },
    {
      icon: sprite("icon-holodisk-20"),
      item: { id: "holodisks", kind: "cargo" },
      label: fill(labels.shipHolodisks ?? "", { n: view.holodisks, total: GALAXY_COUNT }),
    },
  ];
  if (view.aboard) {
    cargo.push({
      icon: sprite(view.aboard.kind === "towing" ? "icon-tow-20" : "icon-cargo-20"),
      item: { id: "aboard", kind: "cargo" },
      label: aboardLabel(labels, view.aboard),
      ...(view.aboardQuestId ? { questId: view.aboardQuestId } : {}),
    });
  }
  const left: ShipRow[] = [
    {
      icon: sprite("icon-shop-engine-tuning", 2),
      item: { id: "engine", kind: "equipment" },
      label: labels.engine ?? "",
      level: level(view.engine, ECONOMY.trackPrices.engine.length + 1),
      tier: view.engine,
    },
    {
      icon: sprite("icon-shop-shield", 2),
      item: { id: "shield", kind: "equipment" },
      label: labels.shield ?? "",
      level: level(view.shield, ECONOMY.trackPrices.shield.length + 1),
      tier: view.shield,
    },
    {
      icon: sprite("icon-shop-tractor-beam", 2),
      item: { id: "tractor", kind: "equipment" },
      label: labels.tractorBeam ?? "",
      level: level(view.tractor, ECONOMY.trackPrices.tractor.length + 1),
      tier: view.tractor,
    },
    {
      icon: sprite("icon-shop-ship-paint", 2),
      item: { id: "paint", kind: "equipment" },
      label: fill(labels.shipPaintName ?? "", { paint: view.paint }),
    },
  ];
  const right: ShipRow[] = view.weapons.map((weapon): ShipRow => ({
    ammo: weapon.ammo === null ? "" : stardustCount(weapon.ammo),
    icon: { mask: weaponGlyphPath(weapon.id) },
    item: { id: weapon.id, kind: "weapon" },
    label: weaponName(labels, weapon.id),
    level: level(weapon.level, WEAPON_LEVEL_COUNT),
    tier: weapon.level,
  }));
  return { cargo, equipment: [left, right] };
}

export function shipIconNode(icon: ShipIcon): HTMLSpanElement {
  const node = document.createElement("span");
  node.className = "ada-ship-icon";
  node.setAttribute("aria-hidden", "true");
  if ("mask" in icon) {
    node.style.background = TEXT_TOKENS.label;
    node.style.setProperty("-webkit-mask", `url('${icon.mask}') center / 100% 100% no-repeat`);
    node.style.setProperty("mask", `url('${icon.mask}') center / 100% 100% no-repeat`);
  } else {
    node.style.background = `url('${SPRITES}${icon.sprite}.png') 0 0 / ${icon.frames * 100}% 100% no-repeat`;
  }
  return node;
}

function rowPart(onItem: (row: ShipRow, origin: HTMLButtonElement) => void, initial: ShipRow) {
  let row = initial;
  let disposed = false;
  const line = document.createElement("button");
  line.type = "button";
  const binding = bindAdaAction(
    {
      click: { availability: () => ({ kind: "available" }), run: () => onItem(row, line) },
      current: () => !disposed,
      slopPx: () => SCROLL.dragThreshold * readViewUnit(line),
    },
    line,
  );
  const update = (next: ShipRow) => {
    row = next;
    line.dataset.item = shipItemKey(row.item);
    line.replaceChildren();
    if (row.tier === undefined) {
      delete line.dataset.level;
    }
    line.className = "ada-ship-row";
    const label = document.createElement("span");
    label.className = "ada-ship-label";
    label.textContent = compactLevelName(row.tier, row.label);
    line.setAttribute(
      "aria-label",
      [row.label, row.level, row.count, row.ammo].filter(Boolean).join(", "),
    );
    if (row.tier !== undefined) {
      line.dataset.level = String(row.tier);
    }
    const content = document.createElement("span");
    content.className = "ada-ship-text";
    content.append(label);
    line.append(shipIconNode(row.icon), content);
    for (const [part, text] of [
      ["count", row.count],
      ["ammo", row.ammo],
    ] as const) {
      if (text !== undefined) {
        const value = document.createElement("span");
        value.className = `ada-ship-${part}`;
        value.textContent = text;
        content.append(value);
      }
    }
  };
  update(initial);
  return {
    dispose() {
      disposed = true;
      binding.dispose();
    },
    element: line,
    slots: {},
    update,
  };
}

const sectionLayouts = new WeakMap<HTMLElement, ReturnType<typeof mountLayout<ShipLayoutSchema>>>();

/** Release retained row callbacks before a view replaces or disposes these sections. */
export function disposeShipSections(root: HTMLElement): void {
  sectionLayouts.get(root)?.dispose();
  sectionLayouts.delete(root);
}

/** Three inventory columns composed by the published renderer from the shared Ship tree. */
export function renderShipSections(
  headings: ShipHeadings,
  sections: ShipSections,
  onItem: (row: ShipRow, origin: HTMLButtonElement) => void = () => undefined,
): HTMLDivElement {
  const host = document.createElement("div");
  const components: LayoutComponentPorts<ShipLayoutSchema> = {
    inventoryColumn: {
      create(initial) {
        const section = document.createElement("section");
        section.className = "ada-ship-section";
        const heading = document.createElement("h3");
        const grid = document.createElement("div");
        grid.className = "ada-ship-grid";
        section.append(heading, grid);
        const update = (next: ShipLayoutSchema["inventoryColumn"]["props"]) => {
          section.dataset.section = next.id;
          section.setAttribute("aria-label", next.heading);
          heading.textContent = next.heading;
        };
        update(initial);
        return { dispose() {}, element: section, slots: { rows: grid }, update };
      },
      slots: ["rows"],
    },
    inventoryRow: { create: (row) => rowPart(onItem, row), slots: [] },
    pageDivider: {
      create() {
        return { dispose() {}, element: createAdaPageDivider(document), slots: {}, update() {} };
      },
      slots: [],
    },
  };
  const layout = mountLayout({ components, host }, shipTree(headings, sections));
  const root = host.firstElementChild as HTMLDivElement;
  root.classList.add("ada-ship-sections");
  root.dataset.inkTop = "0";
  applyAdaControlTheme(root);
  sectionLayouts.set(root, layout);
  return root;
}
