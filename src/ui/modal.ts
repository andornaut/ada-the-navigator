import { setControlPlacement } from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";

import { bindAdaAction } from "./actionBinding.ts";
import { CARD_CONTENT, cardHeaderLayout, listCardHeader } from "./layout/cardFrame.ts";
import { type CardSize, SCROLL } from "./layout/contentCard.ts";
import { type ButtonTag, FOCUS_RING } from "./layout/controls.ts";
import { units } from "./layout/css.ts";
import { TYPE } from "./layout/tokens.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layout/viewScale.ts";

// Ada's modal cards and their controls, as art/controls.md sets them (Chibi's control rules in
// the dark lavender palette) and art/layout.md sizes them: Settings, the install steps, the update
// offer, the cheats card, Paused and Travel share these styles and builders. Every size is a
// logical px through src/ui/layout.

export { BUTTON_SLICE, type ButtonTag } from "./layout/controls.ts";
export { BUTTON_FACE, TEXT_TOKENS, UI_SCOPE } from "./layout/tokens.ts";

export type ButtonRole = "primary" | "secondary";

// The sheet tag a button shows.
export function buttonTag(disabled: boolean, pressed: boolean): ButtonTag {
  if (disabled) {
    return "disabled";
  }
  return pressed ? "pressed" : "normal";
}

// Paired actions in reading order: secondary on the left, primary on the right.
export function actionOrder<T extends { readonly role: ButtonRole }>(actions: readonly T[]): T[] {
  return [
    ...actions.filter((action) => action.role === "secondary"),
    ...actions.filter((action) => action.role === "primary"),
  ];
}

export {
  FOCUS_STYLE,
  LEGACY_TEXT_BUTTON,
  MODAL_LAYER,
  MODAL_STYLE,
  SETTINGS_INSTALL_BUTTON,
  STANDARD_CARD_TEXT_BUTTON,
  SWITCH_FRAME,
} from "./modal/style.ts";

export interface CardParts {
  // The scroll group: append the card's groups here.
  readonly body: HTMLDivElement;
  readonly card: HTMLElement;
  readonly frame: HTMLDivElement;
  readonly header: HTMLElement;
  readonly title: HTMLHeadingElement;
  // Stops refitting the card as the view resizes.
  dispose(): void;
  // Sizes the shown card to its content (src/ui/layout/contentCard.ts); call after its content
  // changes.
  fit(): void;
}

// An element's laid-out size in logical px, independent of the frame turn's transform.
function logicalSize(element: HTMLElement, unit: number): { height: number; width: number } {
  const style = getComputedStyle(element);
  return { height: parseFloat(style.height) / unit, width: parseFloat(style.width) / unit };
}

// Fits a shown card's header within its fixed preset width, balancing its vertical gaps.
// A group's data-ink-top gives the distance from its top to its first visible content.
function fitCard(
  parts: Pick<CardParts, "body" | "card" | "title">,
  close: boolean,
  list: boolean,
): void {
  const { body, card, title } = parts;
  const layer = card.closest<HTMLElement>(".ada-modal, .ada-start");
  if (!layer || card.getClientRects().length === 0) {
    return;
  }
  const unit = readViewUnit(card);
  const groups = [...body.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.getClientRects().length > 0,
  );
  const text = title.textContent ?? "";
  const titleHeight = text ? logicalSize(title, unit).height : undefined;
  const first = groups[0];
  const { bodyTop, titleTop } = list
    ? listCardHeader(TYPE.label)
    : cardHeaderLayout(close, first ? Number(first.dataset.inkTop ?? 0) : undefined, titleHeight);
  // Layout measures from the card's outer edge; its content starts inside the frame.
  card.style.setProperty("--title-top", units(titleTop - CARD_CONTENT.frameBorder));
  card.style.setProperty("--body-gap", units(bodyTop - titleTop - (titleHeight ?? 0)));
  const group = body.querySelector<HTMLElement>(":scope > .ada-scroll");
  if (group) {
    reserveScrollbar(group);
  } else if (body.classList.contains(SCROLL_RESERVE_CLASS)) {
    reserveScrollbar(body);
  }
}

// A card body that scrolls as a whole but keeps a group's scroll reserve, as the job list does.
export const SCROLL_RESERVE_CLASS = "ada-scroll-reserve";

/**
 * While group scrolls, it keeps the scroll reserve (SCROLL.gap + SCROLL.track, 14) on its right in
 * every browser: right padding makes up whatever the browser's own scrollbar leaves of it, so its
 * rows keep one width whether that scrollbar is drawn, thin or hidden. Call it after the group's
 * height can change.
 */
export function reserveScrollbar(group: HTMLElement): void {
  group.style.removeProperty("padding-right");
  group.classList.remove("ada-scrolls");
  if (group.scrollHeight <= group.clientHeight + 1) {
    return;
  }
  const unit = readViewUnit(group);
  const style = getComputedStyle(group);
  const border = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
  const bar = Math.max(0, group.offsetWidth - group.clientWidth - border) / unit;
  const padding = parseFloat(style.paddingRight) / unit;
  group.classList.add("ada-scrolls");
  group.style.paddingRight = units(padding + Math.max(0, SCROLL.gap + SCROLL.track - bar));
}

type CardHeading = { readonly fontRole?: string; readonly title: string };
type PageCardOptions = CardHeading & { readonly page: true };
type DialogCardOptions = CardHeading & {
  readonly close: HTMLButtonElement;
  /** Fixed preset width, clamped to the modal game-area rect. */
  readonly size?: CardSize;
  /** Chibi's list header (listCardHeader), for a card whose body opens with a list. */
  readonly list?: boolean;
};
type DialogCardParts = CardParts & { readonly close: HTMLButtonElement };

// A dialog mounts the caller's close control beside the card. A page only mounts its heading and body.
export function createCard(options: DialogCardOptions): DialogCardParts;
export function createCard(options: PageCardOptions): CardParts;
export function createCard(
  options: DialogCardOptions | PageCardOptions,
): CardParts | DialogCardParts {
  const page = "page" in options;
  const frame = document.createElement("div");
  frame.className = "ada-card-frame";
  const size = !page ? (options.size ?? "medium") : "medium";
  frame.dataset.cardSize = size;
  const card = document.createElement("section");
  card.className = page ? "ada-card ada-page-card" : "ada-card";
  if (!page) {
    frame.setAttribute("role", "dialog");
    frame.setAttribute("aria-modal", "true");
  }
  frame.setAttribute("aria-label", options.title);
  const header = document.createElement("header");
  const title = document.createElement(page ? "h1" : "h2");
  title.textContent = options.title;
  if (options.fontRole) {
    title.dataset.fontRole = options.fontRole;
  }
  header.append(title);
  const body = document.createElement("div");
  body.className = "ada-card-body";
  card.append(header, body);
  const close = page ? undefined : options.close;
  frame.append(card);
  if (close) {
    frame.append(close);
  }
  const fit = () => fitCard({ body, card, title }, !page, !page && options.list === true);
  // Keyboard focus scrolls the focused control fully into view, its focus ring included.
  body.addEventListener("focusin", (event) => {
    if (event.target instanceof HTMLElement) {
      event.target.style.scrollMargin = units(FOCUS_RING.outset);
      event.target.scrollIntoView({ block: "nearest" });
    }
  });
  window.addEventListener("resize", fit);
  window.addEventListener(VIEW_SCALE_EVENT, fit);
  return {
    body,
    card,
    ...(close ? { close } : {}),
    dispose: () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener(VIEW_SCALE_EVENT, fit);
    },
    fit,
    frame,
    header,
    title,
  };
}

// Makes group the card's scroll group: only it scrolls when the card is taller than its rect.
export function setScrollGroup(parts: Pick<CardParts, "body">, group: HTMLElement): void {
  for (const other of parts.body.querySelectorAll(".ada-scroll")) {
    other.classList.remove("ada-scroll");
  }
  group.classList.add("ada-scroll");
  parts.body.classList.add("ada-has-scroll");
}

// Whether a press that began at from and ended at to is a tap: it moved no further than the
// scroll drag threshold, in logical px at unit CSS px each.
export function isTap(
  unit: number,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) <= SCROLL.dragThreshold * unit;
}

// A control row's parts, left to right, as in Chibi: icon, label (with any note) and switch.
export const SWITCH_ROW_PARTS = ["icon", "text", "switch"] as const;

export type SwitchTag = "off" | "on";

// The ui-switch tag and ARIA state a row shows for its setting.
export function switchState(on: boolean): {
  readonly ariaChecked: string;
  readonly tag: SwitchTag;
} {
  return { ariaChecked: String(on), tag: on ? "on" : "off" };
}

// A control row: one switch button at least a control row high holding icon, label, optional note and switch, so the
// whole row is the press target. show sets its state.
export function createSwitchRow(options: {
  readonly align?: "top" | "center";
  readonly current: () => boolean;
  readonly icon: HTMLElement;
  readonly id: string;
  readonly label: string;
  readonly note?: string | undefined;
  readonly run: () => void;
}) {
  const row = document.createElement("button");
  row.type = "button";
  const action = bindAdaAction(
    {
      click: { availability: () => ({ kind: "available" }), run: () => options.run() },
      current: () => options.current(),
      slopPx: () => SCROLL.dragThreshold * readViewUnit(row),
    },
    row,
  );
  row.className = "ada-row";
  setControlPlacement(options.align ?? "top", row);
  row.setAttribute("role", "switch");
  row.setAttribute("aria-label", options.label);
  const text = document.createElement("span");
  text.className = "ada-setting-text";
  const caption = document.createElement("span");
  caption.textContent = options.label;
  text.append(caption);
  if (options.note) {
    const note = document.createElement("span");
    note.className = "ada-setting-note";
    note.id = `ada-note-${options.id}`;
    note.textContent = options.note;
    text.append(note);
    row.setAttribute("aria-describedby", note.id);
  }
  const toggle = document.createElement("span");
  toggle.className = "ada-switch";
  toggle.setAttribute("aria-hidden", "true");
  const parts = { icon: options.icon, switch: toggle, text };
  row.append(...SWITCH_ROW_PARTS.map((part) => parts[part]));
  return {
    dispose: action.dispose,
    row,
    show(on: boolean) {
      const state = switchState(on);
      row.setAttribute("aria-checked", state.ariaChecked);
      toggle.dataset.tag = state.tag;
    },
  };
}

/** Footer intent is explicit and independent of translated labels or entry context. */
export function setFooterAction(action: "back" | "close", footer: HTMLElement): void {
  footer.dataset.footerAction = action;
  setControlPlacement("footer", footer);
}

// Place secondary actions before primary actions.
export function createActions(
  buttons: readonly { readonly button: HTMLButtonElement; readonly role: ButtonRole }[],
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "ada-actions";
  row.dataset.inkTop = "0";
  row.append(...actionOrder(buttons).map(({ button }) => button));
  return row;
}
