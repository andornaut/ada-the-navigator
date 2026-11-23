import { uiIconUrl } from "../data/uiIconUrl.ts";
const VECTOR_ICONS = new Set([
  "icon-cargo-20",
  "icon-holodisk-20",
  "icon-ore-20",
  "icon-stardust-20",
  "icon-tow-20",
]);

/** Resolve shared inventory art while keeping existing multi-frame sheets. */
export function spriteIconPath(key: string): string {
  return VECTOR_ICONS.has(key) ? uiIconUrl(key) : `/art/ui/sprites/${key}.png`;
}
