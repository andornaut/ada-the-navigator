import { compactLevelName } from "./compactLevelName.ts";
import { createProse } from "./prose.ts";

export interface ItemDetail {
  readonly name: string;
  readonly level?: number;
  readonly description: string | readonly string[];
}

export function renderItemDetailHeader(title: HTMLElement, name: string, icon?: HTMLElement): void {
  const label = document.createElement("span");
  label.textContent = name;
  title.classList.add("ada-detail-header");
  title.replaceChildren(...(icon ? [icon] : []), label);
}

export function renderItemDetailDescription(
  description: HTMLElement,
  text: ItemDetail["description"],
): void {
  if (typeof text === "string") {
    description.textContent = text;
    return;
  }
  description.replaceChildren(
    ...text.map((line) => {
      const paragraph = document.createElement("span");
      paragraph.style.display = "block";
      paragraph.textContent = line;
      return paragraph;
    }),
  );
}

export function itemDetailName(item: ItemDetail): string {
  return compactLevelName(item.level, item.name);
}

export function itemDetailProse(text: ItemDetail["description"]): HTMLParagraphElement {
  const description = createProse();
  renderItemDetailDescription(description, text);
  return description;
}
