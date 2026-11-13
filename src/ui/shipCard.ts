import { ECONOMY } from "../data/economy.ts";
import { GALAXY_COUNT } from "../data/galaxies.ts";
import type { Weapon } from "../data/types.ts";
import { WEAPON_LEVEL_COUNT } from "../data/weaponCatalog.ts";
import { weaponGlyphPath } from "../data/weaponGlyphs.ts";
import { fill, weaponName } from "../model/shop.ts";
import type { Aboard } from "../model/types.ts";
import { compactLevelName } from "./compactLevelName.ts";
import { font, units } from "./layout/css.ts";
import { SHIP_CARD } from "./layout/shipCard.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { TEXT_TOKENS, UI_SCOPE } from "./modal.ts";
import { stardustCount } from "./statusPill.ts";

export { SHIP_CARD } from "./layout/shipCard.ts";

// Equipment and Cargo share the left pane; Weapons occupies the equal-width right pane.

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
      label: labels.stardust ?? "",
    },
    { count: stardustCount(view.ore), icon: sprite("icon-ore-20"), label: labels.ore ?? "" },
    {
      icon: sprite("icon-holodisk-20"),
      label: fill(labels.shipHolodisks ?? "", { n: view.holodisks, total: GALAXY_COUNT }),
    },
  ];
  if (view.aboard) {
    cargo.push({
      icon: sprite(view.aboard.kind === "towing" ? "icon-tow-20" : "icon-cargo-20"),
      label: aboardLabel(labels, view.aboard),
    });
  }
  const left: ShipRow[] = [
    {
      icon: sprite("icon-shop-engine-tuning", 2),
      label: labels.engine ?? "",
      level: level(view.engine, ECONOMY.trackPrices.engine.length + 1),
      tier: view.engine,
    },
    {
      icon: sprite("icon-shop-shield", 2),
      label: labels.shield ?? "",
      level: level(view.shield, ECONOMY.trackPrices.shield.length + 1),
      tier: view.shield,
    },
    {
      icon: sprite("icon-shop-tractor-beam", 2),
      label: labels.tractorBeam ?? "",
      level: level(view.tractor, ECONOMY.trackPrices.tractor.length + 1),
      tier: view.tractor,
    },
    {
      icon: sprite("icon-shop-ship-paint", 2),
      label: fill(labels.shipPaintName ?? "", { paint: view.paint }),
    },
  ];
  const right: ShipRow[] = view.weapons.map((weapon) => ({
    ammo: weapon.ammo === null ? "" : stardustCount(weapon.ammo),
    icon: { mask: weaponGlyphPath(weapon.id) },
    label: weaponName(labels, weapon.id),
    level: level(weapon.level, WEAPON_LEVEL_COUNT),
    tier: weapon.level,
  }));
  return { cargo, equipment: [left, right] };
}

export const SHIP_CARD_STYLE = `
${UI_SCOPE} .ada-card-frame[data-card-size=full]:has(> .ada-card[data-dialog=ship]),
${UI_SCOPE} .ada-card-frame[data-card-size=full] > .ada-card[data-dialog=ship]{
  height:auto
}
${UI_SCOPE} .ada-ship-sections{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  column-gap:${units(SHIP_CARD.gutter)};
  position:relative;
  width:100%;
  max-width:100%;
  flex:none;
  align-items:stretch
}
${UI_SCOPE} .ada-ship-pane{
  display:flex;
  flex-direction:column;
  gap:${units(SHIP_CARD.sectionGap)};
  min-width:0
}
${UI_SCOPE} .ada-ship-section{
  display:flex;
  flex-direction:column;
  gap:${units(SPACING.gap)};
  min-width:0;
  margin:0
}
${UI_SCOPE} .ada-ship-sections::before{
  content:"";
  position:absolute;
  left:50%;
  top:0;
  bottom:0;
  width:${units(SHIP_CARD.divider)};
  transform:translateX(-50%);
  background:${TEXT_TOKENS.supporting}
}
${UI_SCOPE} .ada-ship-section h3{
  margin:0;
  overflow-wrap:anywhere;
  font:${font(TYPE.label)};
  line-height:${units(SHIP_CARD.row)};
  color:${TEXT_TOKENS.supporting}
}
${UI_SCOPE} .ada-ship-grid,
${UI_SCOPE} .ada-ship-column{
  display:grid;
  grid-template-columns:minmax(0,1fr);
  row-gap:${units(SPACING.rowGap)};
  min-width:0;
  align-items:start
}
${UI_SCOPE} .ada-ship-grid[data-equipment]{
  grid-template-columns:${units(SHIP_CARD.icon)} minmax(0,1fr) max-content;
  column-gap:0;
  row-gap:${units(SPACING.rowGap)}
}
${UI_SCOPE} .ada-ship-row{
  display:flex;
  align-items:flex-start;
  min-width:0;
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
${UI_SCOPE} [data-equipment] .ada-ship-column,
${UI_SCOPE} [data-equipment] .ada-ship-row{
  display:grid;
  grid-template-columns:subgrid;
  grid-column:1 / -1
}
${UI_SCOPE} [data-equipment] .ada-ship-label{
  padding-left:${units(SPACING.markGap)}
}
${UI_SCOPE} [data-equipment] .ada-ship-level,
${UI_SCOPE} [data-equipment] .ada-ship-ammo{
  padding-left:${units(SHIP_CARD.valueGap)}
}
${UI_SCOPE} [data-equipment] .ada-ship-icon{
  margin-right:0
}
${UI_SCOPE} [data-equipment] .ada-ship-text{
  display:contents
}
${UI_SCOPE} .ada-ship-text{
  display:flex;
  flex:1;
  flex-wrap:wrap;
  gap:0 ${units(SHIP_CARD.valueGap)};
  min-width:0
}
${UI_SCOPE} .ada-ship-label{
  flex:1 1 auto;
  min-width:0;
  overflow-wrap:anywhere
}
${UI_SCOPE} .ada-ship-count,
${UI_SCOPE} .ada-ship-level,
${UI_SCOPE} .ada-ship-ammo{
  min-width:0;
  max-width:100%;
  overflow-wrap:anywhere;
  text-align:right
}
${UI_SCOPE} .ada-ship-count,
${UI_SCOPE} .ada-ship-ammo{
  font:${font(TYPE.label)};
  line-height:${units(SHIP_CARD.row)}
}
${UI_SCOPE} .ada-ship-level{
  color:${TEXT_TOKENS.supporting}
}
${UI_SCOPE} .ada-ship-section[data-section=weapons]{
  display:grid;
  grid-template-columns:${units(SHIP_CARD.icon)} minmax(0,1fr) max-content;
  column-gap:0;
  align-content:start
}
${UI_SCOPE} .ada-ship-weapon-headings,
${UI_SCOPE} [data-section=weapons] .ada-ship-grid{
  display:grid;
  grid-template-columns:subgrid;
  grid-column:1 / -1
}
${UI_SCOPE} .ada-ship-weapon-headings > h3:first-child{
  grid-column:1 / 3
}
${UI_SCOPE} .ada-ship-ammo-heading{
  grid-column:3;
  display:grid;
  padding-left:${units(SHIP_CARD.valueGap)}
}
${UI_SCOPE} .ada-ship-ammo-heading > span{
  grid-area:1 / 1
}
${UI_SCOPE} .ada-ship-ammo-measure{
  visibility:hidden
}
${UI_SCOPE} .ada-ship-ammo{
  text-align:left
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
  label.textContent = compactLevelName(row.tier, row.label);
  line.setAttribute("role", "listitem");
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
  line.append(iconNode(row.icon), content);
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
  return line;
}

/** Three named sections arranged in two equal panes. */
export function renderShipSections(
  headings: {
    readonly ammo: string;
    readonly cargo: string;
    readonly equipment: string;
    readonly weapons: string;
  },
  sections: ShipSections,
): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "ada-ship-sections";
  root.dataset.inkTop = "0";
  const left = document.createElement("div");
  const right = document.createElement("div");
  left.className = right.className = "ada-ship-pane";
  root.append(left, right);
  const section = (
    pane: HTMLDivElement,
    key: "cargo" | "equipment" | "weapons",
    rows: readonly ShipRow[],
  ) => {
    const name = headings[key];
    const node = document.createElement("section");
    node.className = "ada-ship-section";
    node.dataset.section = key;
    node.setAttribute("aria-label", name);
    const heading = document.createElement("h3");
    heading.textContent = name;
    const grid = document.createElement("div");
    grid.className = "ada-ship-grid";
    grid.setAttribute("role", "list");
    if (key !== "cargo") {
      grid.dataset.equipment = "";
    }
    grid.append(...rows.map(rowNode));
    if (key === "weapons") {
      const header = document.createElement("div");
      header.className = "ada-ship-weapon-headings";
      const ammo = document.createElement("h3");
      ammo.className = "ada-ship-ammo-heading";
      const label = document.createElement("span");
      label.textContent = headings.ammo;
      const measure = document.createElement("span");
      measure.className = "ada-ship-ammo-measure";
      measure.textContent = stardustCount(ECONOMY.ammo.capacity);
      measure.setAttribute("aria-hidden", "true");
      ammo.append(label, measure);
      header.append(heading, ammo);
      node.append(header, grid);
    } else {
      node.append(heading, grid);
    }
    pane.append(node);
  };
  section(left, "equipment", sections.equipment[0]);
  section(left, "cargo", sections.cargo);
  section(right, "weapons", sections.equipment[1]);
  return root;
}
