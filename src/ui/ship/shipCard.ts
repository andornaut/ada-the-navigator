import { createButton } from "@andornaut/game-kit/runtime/web/ui/dom/button";
import {
  type LayoutComponentPorts,
  mountLayout,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { ECONOMY } from "../../data/economy.ts";
import { GALAXY_COUNT } from "../../data/galaxies.ts";
import type { Weapon } from "../../data/types.ts";
import { uiIconUrl } from "../../data/uiIconUrl.ts";
import { WEAPON_LEVEL_COUNT } from "../../data/weaponCatalog.ts";
import { weaponGlyphPath } from "../../data/weaponGlyphs.ts";
import { fill, weaponName } from "../../model/shop.ts";
import type { Aboard, ShipItemFact } from "../../model/types.ts";
import { ADA_ACTION_HOLD_MS, assertAdaActionMetadata, bindAdaAction } from "../actionBinding.ts";
import { applyAdaControlTheme, createAdaPageDivider } from "../buttonPresentation.ts";
import { compactLevelName } from "../compactLevelName.ts";
import { SCROLL } from "../layout/contentCard.ts";
import { readViewUnit } from "../layout/viewScale.ts";
import { TEXT_TOKENS } from "../modal.ts";
import { spriteIconPath } from "../spriteIconPath.ts";
import { stardustCount } from "../statusPill.ts";
import { type ShipHeadings, shipItemKey, type ShipLayoutSchema, shipTree } from "./shipTree.ts";

export { shipItemKey } from "./shipTree.ts";

// Cargo, Equipment and Weapons occupy three inventory columns.

export interface ShipWeapon {
  readonly id: Weapon;
  readonly level: number;
  /** Shots left; null for the weapon without ammunition. */
  readonly ammo: number | null;
}

export interface ShipView {
  readonly aboard: Aboard | null;
  /** Independent model facts; omitted only by legacy component callers. */
  readonly carrying?: readonly ShipItemFact[];
  readonly towing?: ShipItemFact | null;
  /** Canonical held quest identity for cargo details, when one exists. */
  readonly aboardQuestId?: string;
  readonly engine: number;
  readonly holodisks: number;
  /** Ore carried this flight. */
  readonly ore: number;
  /** The ship paint's name. */
  readonly paint: string;
  readonly paintSwatch?: string;
  readonly shield: number;
  readonly shieldHealth?: {
    readonly capacity: number;
    readonly rechargeDelay: number;
    readonly shield: number;
  };
  readonly stardust: number;
  readonly tractor: number;
  /** Owned weapons in the HUD weapon icons' order. */
  readonly weapons: readonly ShipWeapon[];
}

/** A row's icon: colour art or a glyph masked in cream. */
export type ShipIcon =
  | { readonly frames: number; readonly sprite: string }
  | { readonly mask: string }
  | { readonly vector: string };

/** Canonical inventory identities route details without reading player-facing labels. */
export type ShipItem =
  | { readonly kind: "resource"; readonly id: "ore" | "stardust" }
  | { readonly kind: "cargo"; readonly id: string }
  | { readonly kind: "equipment"; readonly id: "engine" | "paint" | "shield" | "tractor" }
  | { readonly kind: "weapon"; readonly id: Weapon };

/** One row: its icon, label, and a count or a level, with a weapon's ammunition last. */
export interface ShipRow {
  readonly item: ShipItem;
  /** Live quest identity supplied by the inventory fact, independent of its display label. */
  readonly questId?: string;
  /** Empty status rows have no details action. */
  readonly interactive?: boolean;
  readonly icon: ShipIcon;
  readonly label: string;
  /** A hint naming the action of the existing row button. */
  readonly actionLabel?: string;
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

const sprite = (name: string): ShipIcon => ({ frames: 1, sprite: name });
const equipmentIcon = (key: string): ShipIcon => ({ vector: uiIconUrl(`icon-shop-${key}`) });

/** "Carrying: {item}" or "Towing: {craft}", the status pill's label. */
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
      count: fill(labels.shipHolodiskCount ?? "", { n: view.holodisks, total: GALAXY_COUNT }),
      icon: sprite("icon-holodisk-20"),
      item: { id: "holodisks", kind: "cargo" },
      label: labels.shipHolodisks ?? "",
    },
  ];
  const legacy = view.aboard
    ? {
        id: "aboard",
        name: view.aboard.name,
        ...(view.aboardQuestId ? { questId: view.aboardQuestId } : {}),
      }
    : null;
  const carrying = view.carrying ?? (view.aboard?.kind === "carrying" && legacy ? [legacy] : []);
  const towing =
    view.towing === undefined ? (view.aboard?.kind === "towing" ? legacy : null) : view.towing;
  const seen = new Set<string>();
  const carried = carrying.filter(({ id }) => {
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
  const status = (kind: Aboard["kind"], fact: ShipItemFact | null): ShipRow => ({
    count: fact?.name ?? labels.shipNothing ?? "",
    icon: sprite(kind === "towing" ? "icon-tow-20" : "icon-cargo-20"),
    item: {
      id: fact?.id === "aboard" ? "aboard" : `${kind}:${fact?.id ?? "empty"}`,
      kind: "cargo",
    },
    label: (kind === "towing" ? labels.shipTowingTitle : labels.shipCarryingTitle) ?? "",
    ...(fact?.questId ? { questId: fact.questId } : {}),
    ...(!fact ? { interactive: false } : {}),
  });
  cargo.push(
    ...(carried.length
      ? carried.map((fact) => status("carrying", fact))
      : [status("carrying", null)]),
  );
  cargo.push(status("towing", towing));
  const left: ShipRow[] = [
    {
      icon: equipmentIcon("engine-tuning"),
      item: { id: "engine", kind: "equipment" },
      label: labels.engine ?? "",
      level: level(view.engine, ECONOMY.trackPrices.engine.length + 1),
      tier: view.engine,
    },
    {
      icon: equipmentIcon("shield"),
      item: { id: "shield", kind: "equipment" },
      label: labels.shield ?? "",
      level: level(view.shield, ECONOMY.trackPrices.shield.length + 1),
      tier: view.shield,
    },
    {
      icon: equipmentIcon("tractor-beam"),
      item: { id: "tractor", kind: "equipment" },
      label: labels.tractorBeam ?? "",
      level: level(view.tractor, ECONOMY.trackPrices.tractor.length + 1),
      tier: view.tractor,
    },
    {
      actionLabel: labels.shipChangePaint ?? "",
      icon: view.paintSwatch ? { vector: view.paintSwatch } : equipmentIcon("ship-paint"),
      item: { id: "paint", kind: "equipment" },
      label: fill(labels.shipPaintName ?? "{paint}", { paint: view.paint }),
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
  } else if ("vector" in icon) {
    node.style.background = `url('${icon.vector}') 0 0 / 100% 100% no-repeat`;
    node.style.imageRendering = "auto";
  } else {
    node.style.background = `url('${spriteIconPath(icon.sprite)}') 0 0 / ${icon.frames * 100}% 100% no-repeat`;
  }
  return node;
}

function rowPart(onItem: (row: ShipRow, origin: HTMLButtonElement) => void, initial: ShipRow) {
  let row = initial;
  let disposed = false;
  const kit = createButton(document, {
    appearance: { layout: "caller" },
    content: { kind: "icon", name: initial.label.trim() || "Ship" },
    getAction: () => binding,
    getState: () => ({
      availability: { kind: row.interactive === false ? "disabled" : "available" },
    }),
    rule: { holdMs: ADA_ACTION_HOLD_MS, slopPx: SCROLL.dragThreshold },
  });
  const line = kit.element;
  const binding = bindAdaAction(
    {
      click: {
        availability: () => ({ kind: row.interactive === false ? "omitted" : "available" }),
        run: () => onItem(row, line),
      },
      current: () => !disposed,
      nativeClickOwner: "factory",
      slopPx: () => SCROLL.dragThreshold * readViewUnit(line),
    },
    line,
  );
  const update = (next: ShipRow) => {
    row = next;
    line.dataset.item = shipItemKey(row.item);
    kit.refresh();
    line.tabIndex = row.interactive === false ? -1 : 0;
    // Keep the row's own icon and text as direct children for its existing flex layout.
    line.replaceChildren();
    if (row.tier === undefined) {
      delete line.dataset.level;
    }
    line.className = "ada-ship-row";
    const label = document.createElement("span");
    label.className = "ada-ship-label";
    label.textContent = compactLevelName(row.tier, row.label);
    const name = row.actionLabel ? `${row.label} ${row.actionLabel}` : row.label;
    line.setAttribute(
      "aria-label",
      [name, row.level, row.count, row.ammo].filter(Boolean).join(", "),
    );
    if (row.tier !== undefined) {
      line.dataset.level = String(row.tier);
    }
    const content = document.createElement("span");
    content.className = "ada-ship-text";
    content.append(label);
    if (row.actionLabel) {
      const action = document.createElement("span");
      action.className = "ada-ship-action-label";
      action.textContent = row.actionLabel;
      label.append(action);
    }
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
      kit.dispose();
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
  assertAdaActionMetadata(root);
  sectionLayouts.set(root, layout);
  return root;
}
