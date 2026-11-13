import {
  type ButtonSkin,
  buttonSkinProperty,
  createButtonSkin,
} from "@andornaut/game-kit/web/ui/dom/buttonSkin";

import type { ButtonTag } from "./modal.ts";

export const BUTTON_SHEETS = ["ui-button", "ui-button-primary", "ui-button-tile"] as const;
const BUTTON_TAGS: readonly ButtonTag[] = ["normal", "pressed", "disabled"];
const UI_ROOT = "/art/ui/";

interface Rect {
  readonly h: number;
  readonly w: number;
  readonly x: number;
  readonly y: number;
}

interface FramedSheet {
  readonly frames: Readonly<Record<string, { readonly frame: Rect }>>;
  readonly meta: {
    readonly frameTags?: readonly { readonly from: number; readonly name: string }[];
  };
}

// Each button tag's first frame in the sheet, by the sheet's own frame order.
export function buttonFrames(sheet: FramedSheet): Partial<Record<ButtonTag, Rect>> {
  const frames = Object.values(sheet.frames);
  const rects: Partial<Record<ButtonTag, Rect>> = {};
  for (const tag of sheet.meta.frameTags ?? []) {
    const frame = frames[tag.from]?.frame;
    if (frame && (BUTTON_TAGS as readonly string[]).includes(tag.name)) {
      rects[tag.name as ButtonTag] = frame;
    }
  }
  return rects;
}

// The custom property a sheet's tag sets.
export function buttonProperty(sheet: (typeof BUTTON_SHEETS)[number], tag: ButtonTag): string {
  return buttonSkinProperty(sheet, tag);
}

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
