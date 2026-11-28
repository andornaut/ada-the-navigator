import { afterEach, describe, expect, it, vi } from "vitest";

import { ECONOMY } from "../../data/economy.ts";
import { uiIconUrl } from "../../data/uiIconUrl.ts";
import type { ShopItem } from "../../model/shop.ts";
import { itemGlyph } from "../shopView.ts";
import { createStationItemIcon, setStationItemTitle } from "./stationItemIcon.ts";

class IconElement {
  alt = "";
  attributes: Record<string, string> = {};
  children: IconElement[] = [];
  className = "";
  classList = {
    add: (name: string) => {
      this.className = [this.className, name].filter(Boolean).join(" ");
    },
  };
  properties: Record<string, string> = {};
  src = "";
  style = {
    flex: "",
    setProperty: (name: string, value: string) => {
      this.properties[name] = value;
    },
  };
  textContent = "";
  readonly tagName: string;
  readonly ownerDocument: { createElement: (name: string) => IconElement };
  constructor(tagName: string, ownerDocument: { createElement: (name: string) => IconElement }) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
  }
  append(...nodes: IconElement[]) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes: IconElement[]) {
    this.children = nodes;
  }
  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }
}
const snapshot = (element: IconElement): unknown => ({
  alt: element.alt,
  attributes: element.attributes,
  children: element.children.map(snapshot),
  className: element.className,
  properties: element.properties,
  src: element.src,
  tagName: element.tagName,
});
afterEach(() => vi.unstubAllGlobals());
const items: ShopItem[] = [
  ...(["rapidMissile", "multiLaser", "heavyMissile", "scattershot", "phaser"] as const).map(
    (weapon) => ({ kind: "weapon" as const, weapon }),
  ),
  ...(["engine", "shield", "tractor"] as const).map((track) => ({ kind: "track" as const, track })),
  ...(["rapidMissile", "multiLaser", "scattershot"] as const).map((weapon) => ({
    kind: "ammo" as const,
    weapon,
  })),
  { kind: "weaponUpgrade", weapon: "laser" },
  { kind: "paint", scheme: "classic" },
  { kind: "paint", scheme: "iris" },
  { kind: "holodisk" },
];

describe("station row and detail header item icons", () => {
  it.each(items)("reuses the canonical icon for $kind without moving the row node", (item) => {
    const doc = { createElement: (name: string): IconElement => new IconElement(name, doc) };
    vi.stubGlobal("document", doc);
    const glyph = itemGlyph(ECONOMY, item);
    const rowIcon = createStationItemIcon(glyph) as unknown as IconElement;
    const before = snapshot(rowIcon);
    const header = doc.createElement("h2");
    setStationItemTitle(glyph, "Canonical item", header as unknown as HTMLElement);
    expect(header.className).toContain("ada-detail-header");
    expect(header.children).toHaveLength(2);
    expect(header.children[0]).not.toBe(rowIcon);
    expect(header.children[0]!.style.flex).toBe("none");
    expect(snapshot(header.children[0]!)).toEqual(before);
    expect(snapshot(rowIcon)).toEqual(before);
    expect(header.children[1]!.textContent).toBe("Canonical item");
    expect(rowIcon.attributes["aria-hidden"]).toBe("true");
    if (glyph.kind === "upgrade") {
      expect(rowIcon.children[1]!.className).toBe("ada-glyph-badge");
      expect(rowIcon.children[0]!.properties["--icon"]).toBe(`url('${uiIconUrl("weapon-laser")}')`);
    } else if (glyph.kind === "swatch") {
      expect(rowIcon.src).toBe(glyph.path);
      expect(rowIcon.tagName).toBe("img");
    } else if (glyph.kind === "stateVector") {
      expect(rowIcon.className).toBe("ada-glyph ada-glyph-state-vector");
      expect(rowIcon.properties).toEqual({
        "--state-icon": `url('${uiIconUrl(glyph.key)}')`,
        "--state-icon-disabled": `url('${uiIconUrl(`${glyph.key}-disabled`)}')`,
      });
    } else if (item.kind === "holodisk") {
      expect(rowIcon.className).toBe("ada-glyph ada-glyph-vector");
      expect(rowIcon.properties).toEqual({ "--icon": `url('${uiIconUrl("icon-holodisk")}')` });
    } else if (glyph.kind === "mask") {
      expect(rowIcon.className).toBe("ada-glyph ada-glyph-mask");
      expect(rowIcon.properties["--icon"]).toBe(`url('${glyph.path}')`);
    }
  });
});
