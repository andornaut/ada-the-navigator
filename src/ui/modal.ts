import { CARD, cardHeaderLayout, cardTitleReserve, cardWidth } from "./card-layout.ts";
import { PAUSE_BUTTON, pauseButtonPlacement } from "./pause.ts";

// Ada's modal cards and their controls, as art/controls.md sets them (Chibi's control rules in
// the dark lavender palette): Settings, the install steps, the update offer, the cheats card and
// the cards still to come share these styles and builders.

// Text colours on the card face #3b3850.
export const TEXT_TOKENS = {
  buttonLabel: "#181425",
  disabledLabel: "#9a96ad",
  label: "#ead4aa",
  supporting: "#b8b3c9",
  title: "#ffffff",
} as const;

// The button sheets' nine-slice margins (left, top, right, bottom), as the UI manifest gives them.
export const BUTTON_SLICE = { bottom: 6, left: 2, right: 2, top: 4 } as const;

export type ButtonRole = "primary" | "secondary";
export type ButtonTag = "disabled" | "normal" | "pressed";

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

const { bottom, left, right, top } = BUTTON_SLICE;
const SLICE = `${top} ${right} ${bottom} ${left}`;
const WIDTHS = `${top}px ${right}px ${bottom}px ${left}px`;

// Focus: a cream band between ink fringes, 4px outside the control (the HTML form of ui-focus).
const FOCUS = `
  outline:2px solid #ead4aa;
  outline-offset:1px;
  box-shadow:0 0 0 1px #181425,0 0 0 4px #181425`;

export const MODAL_STYLE = `
/* A modal fills the controls layer; its card shrinks to fit and scrolls on a short screen. */
.ada-controls .ada-modal{
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#101926b3;
  pointer-events:auto;
  padding:16px;
  box-sizing:border-box
}

.ada-controls .ada-card-frame{
  position:relative;
  max-width:100%;
  max-height:100%;
  display:flex;
  flex-direction:column
}

/* The last control keeps the card's 16px padding below it when the card scrolls to its end. */
.ada-controls .ada-card::after{
  content:"";
  flex:none;
  height:${CARD.padding - CARD.gap}px
}

/* Chibi's content-fitted card (card-layout.ts sets its width and header gaps): groups stack 8px
   apart, each at its own width, centred in the card's inner width. */
.ada-controls .ada-card{
  box-sizing:border-box;
  width:max-content;
  max-width:100%;
  max-height:100%;
  min-height:0;
  flex:0 1 auto;
  overflow:auto;
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:${CARD.gap}px;
  padding:0 ${CARD.padding}px;
  color:${TEXT_TOKENS.label};
  background:#3b3850;
  border:2px solid #6b6685;
  border-radius:0;
  border-image:url('/art/ui/sprites/ui-settings-card.png') 2 fill / 2px stretch;
  image-rendering:pixelated
}

/* The title centres across the card with the close target's clearance reserved on each side. */
.ada-controls .ada-card header{
  flex:none;
  align-self:stretch;
  box-sizing:border-box;
  margin-top:var(--title-top,${CARD.padding}px);
  padding:0 ${cardTitleReserve(true) - CARD.padding}px
}

.ada-controls .ada-card > header + *{
  margin-top:var(--body-gap,0)
}

.ada-controls .ada-card > *{
  flex:none;
  max-width:100%
}

.ada-controls .ada-card h2{
  font-size:24px;
  line-height:28px;
  text-align:center;
  margin:0;
  font-weight:700;
  color:${TEXT_TOKENS.title};
  overflow-wrap:anywhere
}

.ada-controls .ada-card h3{
  margin:16px 0 4px;
  font-size:16px;
  color:${TEXT_TOKENS.title}
}

.ada-controls .ada-card p{
  margin:0 0 16px;
  line-height:20px;
  max-width:36em;
  color:${TEXT_TOKENS.supporting}
}

/* The close X: a 24x24 face 6px from the card's top and right, in a 48x48 target. */
.ada-controls .ada-close{
  position:absolute;
  top:-6px;
  right:-6px;
  width:48px;
  height:48px;
  min-width:48px;
  padding:0;
  border:0;
  border-radius:0;
  background:transparent;
  display:grid;
  place-items:center;
  cursor:pointer;
  pointer-events:auto
}
.ada-controls .ada-close::before{
  content:"";
  width:24px;
  height:24px;
  background:url('/art/ui/sprites/ui-close.png') 0 0 / 48px 24px;
  image-rendering:pixelated
}
.ada-controls .ada-close:active::before{
  background-position:-24px 0
}

/* Buttons: 48px, a 44px face over a 4px lip; pressed drops 2px; disabled is flat. */
.ada-controls .ada-button{
  box-sizing:border-box;
  min-width:48px;
  height:48px;
  min-height:48px;
  margin:0;
  padding:0 14px 2px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  font:700 16px AdaUI,'Liberation Sans',sans-serif;
  color:${TEXT_TOKENS.buttonLabel};
  background:#9690b4;
  border-style:solid;
  border-color:#9690b4 #9690b4 #5f5980;
  border-width:${WIDTHS};
  border-radius:0;
  border-image:var(--ui-button-normal) ${SLICE} fill / ${WIDTHS};
  image-rendering:pixelated;
  cursor:pointer;
  pointer-events:auto
}
.ada-controls .ada-button.ada-primary{
  background:#bfa06f;
  border-color:#bfa06f #bfa06f #8a7148;
  border-image-source:var(--ui-button-primary-normal)
}
.ada-controls .ada-button:active:not(:disabled){
  padding:2px 14px 0;
  border-image-source:var(--ui-button-pressed)
}
.ada-controls .ada-button.ada-primary:active:not(:disabled){
  border-image-source:var(--ui-button-primary-pressed)
}
.ada-controls .ada-button:disabled{
  padding:2px 14px 0;
  color:${TEXT_TOKENS.disabledLabel};
  background:#2f2d3d;
  border-color:#2f2d3d;
  border-image-source:var(--ui-button-disabled);
  cursor:default
}
.ada-controls .ada-button.ada-primary:disabled{
  border-image-source:var(--ui-button-primary-disabled)
}

/* An unavailable action keeps the disabled face but stays pressable, so it can refuse. */
.ada-controls .ada-button.ada-unavailable,
.ada-controls .ada-button.ada-unavailable:active{
  padding:2px 14px 0;
  color:${TEXT_TOKENS.disabledLabel};
  background:#2f2d3d;
  border-color:#2f2d3d;
  border-image-source:var(--ui-button-disabled);
  cursor:default
}

/* The shared refusal cue: a short sideways shake. */
@keyframes ada-refuse{
  0%,100%{transform:none}
  25%{transform:translateX(-3px)}
  75%{transform:translateX(3px)}
}
.ada-controls .ada-refuse{
  animation:ada-refuse 90ms 2
}
@media (prefers-reduced-motion:reduce){
  .ada-controls .ada-refuse{
    animation:none
  }
}

/* A stacked action group fills the card's body width, its faces 8px apart. */
.ada-controls .ada-actions.ada-stack{
  grid-auto-flow:row;
  width:100%;
  gap:${CARD.gap}px
}

.ada-controls .ada-card .ada-card-note{
  margin:0;
  text-align:center
}

/* Chibi's pause button: a 35px frame, its disc edge 8px in from the view's corner, in a 52.5px
   press area. */
.ada-controls .ada-pause{
  position:absolute;
  left:calc(max(0px,var(--inset-left)) + ${pauseButtonPlacement().press}px);
  top:calc(max(0px,var(--inset-top)) + ${pauseButtonPlacement().press}px);
  width:${PAUSE_BUTTON.press}px;
  height:${PAUSE_BUTTON.press}px;
  min-width:0;
  min-height:0;
  padding:0;
  border:0;
  border-radius:0;
  background:transparent;
  display:grid;
  place-items:center;
  pointer-events:auto;
  touch-action:none
}
.ada-controls .ada-pause::before{
  content:"";
  width:${PAUSE_BUTTON.frame}px;
  height:${PAUSE_BUTTON.frame}px;
  background:url('/art/ui/sprites/ui-pause.png') var(--pause-frame,0px) 0;
  background-size:${4 * PAUSE_BUTTON.frame}px ${PAUSE_BUTTON.frame}px;
  image-rendering:pixelated
}
.ada-controls .ada-pause:focus-visible{${FOCUS}
}

/* Action groups sit centred in the card, one shared width per group. */
.ada-controls .ada-actions{
  display:grid;
  grid-auto-columns:1fr;
  grid-auto-flow:column;
  gap:${CARD.gap}px;
  width:max-content;
  max-width:100%;
  margin:0
}

/* Control rows form one group as wide as its widest row, rows 4px apart. */
.ada-controls .ada-rows{
  display:grid;
  gap:${CARD.rowGap}px;
  width:max-content;
  max-width:100%
}

/* Chibi's compact exception for a button inside a control row: a 72x28 face with an 8px
   horizontal inset, centred in the row, full-size label; the whole row stays the target. */
.ada-controls .ada-button.ada-compact{
  flex:none;
  min-width:72px;
  height:28px;
  min-height:28px;
  padding:0 6px
}
.ada-controls .ada-button.ada-compact:active:not(:disabled){
  padding:0 6px;
  border-image-source:var(--ui-button-pressed)
}

/* Control rows: 48 high, icon, label and switch; the whole row is the press target. */
.ada-controls .ada-row{
  box-sizing:border-box;
  display:flex;
  align-items:center;
  gap:8px;
  width:100%;
  min-height:48px;
  margin:0;
  padding:0;
  font:inherit;
  text-align:left;
  color:${TEXT_TOKENS.label};
  background:transparent;
  border:0;
  border-radius:0;
  cursor:pointer;
  pointer-events:auto
}

.ada-controls .ada-switch{
  flex:none;
  width:32px;
  height:16px;
  background:url('/art/ui/sprites/ui-switch.png') 0 0 / 64px 16px;
  image-rendering:pixelated
}
.ada-controls .ada-switch[data-tag=off]{
  background-position:-32px 0
}

.ada-controls .ada-icon{
  flex:none;
  width:16px;
  height:16px;
  background:center / 16px 16px no-repeat;
  image-rendering:pixelated
}

.ada-controls .ada-setting-text{
  flex:1;
  display:grid;
  gap:2px;
  padding:4px 0;
  overflow-wrap:anywhere
}

/* Supporting text keeps the body size, as in Chibi: it wraps and its row grows instead. */
.ada-controls .ada-setting-note{
  font-size:16px;
  line-height:20px;
  color:${TEXT_TOKENS.supporting}
}

.ada-controls .ada-steps{
  display:flex;
  align-items:center;
  gap:8px;
  width:max-content;
  max-width:100%;
  margin:0
}

.ada-controls .ada-steps p{
  margin:0 0 0 4px
}

.ada-controls .ada-card .ada-button:focus-visible,
.ada-controls .ada-row:focus-visible,
.ada-controls .ada-close:focus-visible{${FOCUS}
}

.ada-controls [hidden]{
  display:none!important
}
`;

export interface CardParts {
  readonly card: HTMLElement;
  readonly close: HTMLButtonElement;
  readonly frame: HTMLDivElement;
  readonly header: HTMLElement;
  readonly title: HTMLHeadingElement;
  // Stops refitting the card as the view resizes.
  dispose(): void;
  // Sizes the shown card to its content (card-layout.ts); call after its content changes.
  fit(): void;
}

// Fits a shown card: measures each visible group and the title at their natural widths, sets the
// card's width, then the title's top and the first group's gap so the header's gaps balance. A
// group's data-ink-top gives the distance from its top to its first visible content.
function fitCard(card: HTMLElement, header: HTMLElement, title: HTMLElement): void {
  const layer = card.closest<HTMLElement>(".ada-modal");
  if (!layer || card.getClientRects().length === 0) {
    return;
  }
  card.style.width = "max-content";
  const groups = [...card.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child !== header && child.getClientRects().length > 0,
  );
  const text = title.textContent ?? "";
  let titleWidth = 0;
  if (text) {
    const range = document.createRange();
    range.selectNodeContents(title);
    title.style.whiteSpace = "nowrap";
    titleWidth = range.getBoundingClientRect().width;
    title.style.whiteSpace = "";
  }
  const styles = getComputedStyle(layer);
  const viewportWidth = layer.clientWidth;
  const availableWidth =
    viewportWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
  const width = cardWidth(
    { availableWidth, viewportWidth },
    groups.map((group) => group.offsetWidth),
    text ? { close: true, width: titleWidth } : undefined,
  );
  card.style.width = `${width}px`;
  const titleHeight = text ? title.offsetHeight : undefined;
  const first = groups[0];
  const { bodyTop, titleTop } = cardHeaderLayout(
    true,
    first ? Number(first.dataset.inkTop ?? 0) : undefined,
    titleHeight,
  );
  card.style.setProperty("--title-top", `${titleTop}px`);
  card.style.setProperty("--body-gap", `${bodyTop - titleTop - (titleHeight ?? 0) - CARD.gap}px`);
}

// A dialog card in its frame, with its title and close X. Show or hide it through frame.hidden.
export function createCard(options: {
  readonly closeAction: string;
  readonly closeLabel: string;
  readonly fontRole?: string;
  readonly title: string;
}): CardParts {
  const frame = document.createElement("div");
  frame.className = "ada-card-frame";
  const card = document.createElement("section");
  card.className = "ada-card";
  frame.setAttribute("role", "dialog");
  frame.setAttribute("aria-modal", "true");
  frame.setAttribute("aria-label", options.title);
  const header = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = options.title;
  if (options.fontRole) {
    title.dataset.fontRole = options.fontRole;
  }
  header.append(title);
  card.append(header);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ada-close";
  close.dataset.action = options.closeAction;
  close.setAttribute("aria-label", options.closeLabel);
  frame.append(card, close);
  const fit = () => fitCard(card, header, title);
  window.addEventListener("resize", fit);
  return {
    card,
    close,
    dispose: () => window.removeEventListener("resize", fit),
    fit,
    frame,
    header,
    title,
  };
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

// A control row: one 48px switch button holding icon, label, optional note and switch, so the
// whole row is the press target. show sets its state.
export function createSwitchRow(options: {
  readonly icon: HTMLElement;
  readonly id: string;
  readonly label: string;
  readonly note?: string | undefined;
}): { readonly row: HTMLButtonElement; show(on: boolean): void } {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "ada-row";
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
    row,
    show(on) {
      const state = switchState(on);
      row.setAttribute("aria-checked", state.ariaChecked);
      toggle.dataset.tag = state.tag;
    },
  };
}

export function createButton(label: string, role: ButtonRole = "secondary"): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = role === "primary" ? "ada-button ada-primary" : "ada-button";
  button.textContent = label;
  return button;
}

// An action group of one shared width, secondary actions left of primary ones.
export function createActions(
  buttons: readonly { readonly button: HTMLButtonElement; readonly role: ButtonRole }[],
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "ada-actions";
  row.dataset.inkTop = "0";
  row.append(...actionOrder(buttons).map(({ button }) => button));
  return row;
}
