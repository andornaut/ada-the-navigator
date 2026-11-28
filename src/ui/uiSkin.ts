import {
  type ButtonSkin,
  createButtonSkin,
} from "@andornaut/game-kit/runtime/web/ui/dom/buttonSkin";

import { BUTTON_SHEETS, type ButtonTag } from "./layout/dom.ts";

export { BUTTON_SHEETS, buttonProperty } from "./layout/dom.ts";

const BUTTON_TAGS: readonly ButtonTag[] = ["normal", "pressed", "disabled"];
const UI_ROOT = "/art/ui/";

// The kit's frame URLs live for the page. Share their fetch/decode/cut work across Ada's roots
// without retaining the roots or registering input listeners.
const skins = new WeakMap<Document, ButtonSkin>();

export async function applyButtonSkin(root: HTMLElement): Promise<void> {
  const document = root.ownerDocument;
  let skin = skins.get(document);
  if (!skin) {
    skin = createButtonSkin(document, {
      manifestUrl: `${UI_ROOT}manifest.json`,
      sheets: BUTTON_SHEETS,
      tags: BUTTON_TAGS,
    });
    skins.set(document, skin);
  }
  await skin.apply(root);
}
