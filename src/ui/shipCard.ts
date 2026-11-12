import type { Weapon } from "../data/types.ts";
import { weaponGlyphPath } from "../data/weaponGlyphs.ts";
import { fill, weaponName } from "../model/shop.ts";
import type { Aboard } from "../model/types.ts";
import { font, units } from "./layout/css.ts";
import { BUTTON_GAP, SPACING, TYPE } from "./layout/tokens.ts";
import { TEXT_TOKENS, UI_SCOPE } from "./modal.ts";
import { stardustCount } from "./statusPill.ts";

// The Ship card (gameplay/rules.md "Pause", art/layout.md "Ship card"): opened from the Paused
// card, it lists what Ada carries under Cargo and her equipment under Equipment, each section
// in two columns.

/** The Ship card's geometry in logical px (art/layout.md "Ship card"). */
export const SHIP_CARD = {
  /** The ammunition column: "999 left" in TYPE.label, right-aligned at the column's right. */
  ammo: 55.14,
  /** Each column: the widest row, a weapon's. */
  column: 279,
  columnGap: BUTTON_GAP,
  icon: 20,
  row: 20,
  /** Between a label and its value, and between a level and the ammunition. */
  valueGap: SPACING.gap,
} as const;

const SPRITES = "/art/ui/sprites/";

export interface ShipWeapon {
  readonly id: Weapon;
  readonly level: number;
  /** Shots left; null for the weapon without ammunition. */
  readonly ammo: number | null;
}

export interface ShipView {
  readonly aboard: Aboard | null;
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

/** One row: its icon, label, and a count or a level, with a weapon's ammunition last. */
export interface ShipRow {
  readonly icon: ShipIcon;
  readonly label: string;
  readonly count?: string;
  readonly level?: string;
  /** A weapon row: its ammunition, empty for the weapon without it. */
  readonly ammo?: string;
}

export interface ShipSections {
  /** Left to right, then down. */
  readonly cargo: readonly ShipRow[];
  /** The left column, then the right. */
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
 * their levels and the paint on the left; each owned weapon in the HUD order on the right, with
 * its level and, apart from the unlimited one, its shots left.
 */
export function shipSections(labels: Labels, view: ShipView): ShipSections {
  const level = (value: number) => fill(labels.shipLevel ?? "", { n: value });
  const cargo: ShipRow[] = [
    {
      count: stardustCount(view.stardust),
      icon: sprite("icon-stardust-20"),
      label: labels.stardust ?? "",
    },
    { count: stardustCount(view.ore), icon: sprite("icon-ore-20"), label: labels.ore ?? "" },
    {
      icon: sprite("icon-holodisk-20"),
      label: fill(labels.shipHolodisks ?? "", { n: view.holodisks }),
    },
  ];
  if (view.aboard) {
    cargo.push({
      icon: sprite(view.aboard.kind === "towing" ? "icon-tow-20" : "icon-cargo-20"),
      label: aboardLabel(labels, view.aboard),
    });
  }
  const left: ShipRow[] = [
    { icon: sprite("icon-shop-shield", 2), label: labels.shield ?? "", level: level(view.shield) },
    {
      icon: sprite("icon-shop-engine-tuning", 2),
      label: labels.engine ?? "",
      level: level(view.engine),
    },
    {
      icon: sprite("icon-shop-tractor-beam", 2),
      label: labels.tractorBeam ?? "",
      level: level(view.tractor),
    },
    {
      icon: sprite("icon-shop-ship-paint", 2),
      label: fill(labels.shipPaintName ?? "", { paint: view.paint }),
    },
  ];
  const right: ShipRow[] = view.weapons.map((weapon) => ({
    ammo: weapon.ammo === null ? "" : fill(labels.shipAmmoLeft ?? "", { count: weapon.ammo }),
    icon: { mask: weaponGlyphPath(weapon.id) },
    label: weaponName(labels, weapon.id),
    level: level(weapon.level),
  }));
  return { cargo, equipment: [left, right] };
}

export const SHIP_CARD_STYLE = `
${UI_SCOPE} .ada-ship-section{
  display:grid;
  row-gap:${units(SPACING.rowGap)};
  margin:0
}
${UI_SCOPE} .ada-ship-section + .ada-ship-section{
  margin-top:${units(SPACING.gap)}
}
${UI_SCOPE} .ada-ship-section h3{
  margin:0;
  font:${font(TYPE.label)};
  line-height:${units(SHIP_CARD.row)};
  color:${TEXT_TOKENS.supporting}
}
${UI_SCOPE} .ada-ship-grid{
  display:grid;
  grid-template-columns:${units(SHIP_CARD.column)} ${units(SHIP_CARD.column)};
  column-gap:${units(SHIP_CARD.columnGap)};
  row-gap:${units(SPACING.rowGap)};
  align-items:start
}
${UI_SCOPE} .ada-ship-column{
  display:grid;
  row-gap:${units(SPACING.rowGap)}
}
${UI_SCOPE} .ada-ship-row{
  display:flex;
  align-items:flex-start;
  min-height:${units(SHIP_CARD.row)};
  margin:0;
  font:${font(TYPE.body)};
  line-height:${units(SHIP_CARD.row)};
  color:${TEXT_TOKENS.label}
}
${UI_SCOPE} .ada-ship-icon{
  flex:none;
  width:${units(SHIP_CARD.icon)};
  height:${units(SHIP_CARD.icon)};
  margin-right:${units(SPACING.markGap)};
  image-rendering:pixelated
}
${UI_SCOPE} .ada-ship-label{
  flex:1 1 auto;
  min-width:0
}
${UI_SCOPE} .ada-ship-count{
  flex:none;
  margin-left:${units(SHIP_CARD.valueGap)};
  font:${font(TYPE.label)};
  line-height:${units(SHIP_CARD.row)}
}
${UI_SCOPE} .ada-ship-level{
  flex:none;
  margin-left:${units(SHIP_CARD.valueGap)};
  color:${TEXT_TOKENS.supporting}
}
${UI_SCOPE} .ada-ship-ammo{
  flex:none;
  width:${units(SHIP_CARD.ammo)};
  margin-left:${units(SHIP_CARD.valueGap)};
  text-align:right;
  font:${font(TYPE.label)};
  line-height:${units(SHIP_CARD.row)}
}
`;

function iconNode(icon: ShipIcon): HTMLSpanElement {
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

function rowNode(row: ShipRow): HTMLDivElement {
  const line = document.createElement("div");
  line.className = "ada-ship-row";
  const label = document.createElement("span");
  label.className = "ada-ship-label";
  label.textContent = row.label;
  line.append(iconNode(row.icon), label);
  for (const [part, text] of [
    ["count", row.count],
    ["level", row.level],
    ["ammo", row.ammo],
  ] as const) {
    if (text !== undefined) {
      const value = document.createElement("span");
      value.className = `ada-ship-${part}`;
      value.textContent = text;
      line.append(value);
    }
  }
  return line;
}

/** The two sections' nodes, built from their rows. */
export function renderShipSections(
  headings: { readonly cargo: string; readonly equipment: string },
  sections: ShipSections,
): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "ada-ship-sections";
  root.dataset.inkTop = "0";
  const section = (key: "cargo" | "equipment", grid: HTMLDivElement) => {
    const node = document.createElement("section");
    node.className = "ada-ship-section";
    node.dataset.section = key;
    const heading = document.createElement("h3");
    heading.textContent = headings[key];
    node.append(heading, grid);
    root.append(node);
  };
  const cargo = document.createElement("div");
  cargo.className = "ada-ship-grid";
  cargo.append(...sections.cargo.map(rowNode));
  section("cargo", cargo);
  const equipment = document.createElement("div");
  equipment.className = "ada-ship-grid";
  for (const rows of sections.equipment) {
    const column = document.createElement("div");
    column.className = "ada-ship-column";
    column.append(...rows.map(rowNode));
    equipment.append(column);
  }
  section("equipment", equipment);
  return root;
}
