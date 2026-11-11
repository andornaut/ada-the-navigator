import type { ButtonTag } from "./modal.ts";

// Art's button sheets hold their normal, pressed and disabled frames side by side; a CSS nine-slice
// takes one image, so each tag's frame is cut out once into its own image and given to the modal
// styles as a custom property (--ui-button-normal, --ui-button-primary-pressed and so on).

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
  return `--${sheet}-${tag}`;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

// Cuts each button frame out of its sheet and sets it on root. A missing sheet leaves the flat
// fallback colours in place.
export async function applyButtonSkin(root: HTMLElement): Promise<void> {
  const manifest = (await (await fetch(`${UI_ROOT}manifest.json`)).json()) as {
    sprites?: readonly { readonly json: string; readonly key: string; readonly png: string }[];
  };
  await Promise.all(
    BUTTON_SHEETS.map(async (key) => {
      const entry = manifest.sprites?.find((sprite) => sprite.key === key);
      if (!entry) {
        return;
      }
      const [sheet, image] = await Promise.all([
        fetch(`${UI_ROOT}${entry.json}`).then(
          (response) => response.json() as Promise<FramedSheet>,
        ),
        loadImage(`${UI_ROOT}${entry.png}`),
      ]);
      for (const [tag, rect] of Object.entries(buttonFrames(sheet)) as [ButtonTag, Rect][]) {
        const canvas = document.createElement("canvas");
        canvas.width = rect.w;
        canvas.height = rect.h;
        canvas
          .getContext("2d")
          ?.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
        root.style.setProperty(buttonProperty(key, tag), `url(${canvas.toDataURL()})`);
      }
    }),
  );
}
