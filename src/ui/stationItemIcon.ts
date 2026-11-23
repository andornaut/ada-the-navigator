import type { Weapon } from "../data/types.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import { weaponGlyphPath } from "../data/weaponGlyphs.ts";

export type ItemGlyph =
  | { readonly kind: "stateVector"; readonly key: string }
  | { readonly kind: "mask"; readonly path: string }
  | { readonly kind: "vector"; readonly key: string }
  | { readonly kind: "upgrade"; readonly weapon: Weapon }
  | { readonly kind: "swatch"; readonly path: string };

/** A weapon uses the same mask in its shop and flight controls. */
export function weaponItemGlyph(weapon: Weapon): ItemGlyph {
  return { kind: "mask", path: weaponGlyphPath(weapon) };
}

export function createStationItemIcon(glyph: ItemGlyph): HTMLElement {
  if (glyph.kind === "swatch") {
    const image = document.createElement("img");
    image.className = "ada-glyph-swatch";
    if (glyph.path) {
      image.src = glyph.path;
    }
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    return image;
  }
  const node = document.createElement("span");
  node.setAttribute("aria-hidden", "true");
  if (glyph.kind === "upgrade") {
    node.className = "ada-glyph-upgrade";
    const badge = document.createElement("span");
    badge.className = "ada-glyph-badge";
    node.append(createStationItemIcon(weaponItemGlyph(glyph.weapon)), badge);
    return node;
  }
  if (glyph.kind === "stateVector") {
    node.className = "ada-glyph ada-glyph-state-vector";
    node.style.setProperty("--state-icon", `url('${uiIconUrl(glyph.key)}')`);
    node.style.setProperty("--state-icon-disabled", `url('${uiIconUrl(`${glyph.key}-disabled`)}')`);
    return node;
  }
  if (glyph.kind === "vector") {
    node.className = "ada-glyph ada-glyph-vector";
    node.style.setProperty("--icon", `url('${uiIconUrl(glyph.key)}')`);
    return node;
  }
  node.className = "ada-glyph ada-glyph-mask";
  node.style.setProperty("--icon", `url('${glyph.path}')`);
  return node;
}

/** Rows and detail headers share the canonical item glyph, including upgrade markers. */
export function setStationItemTitle(glyph: ItemGlyph, title: string, header: HTMLElement): void {
  header.classList.add("ada-detail-header");
  const name = header.ownerDocument.createElement("span");
  name.textContent = title;
  const icon = createStationItemIcon(glyph);
  icon.style.flex = "none";
  header.replaceChildren(icon, name);
}
