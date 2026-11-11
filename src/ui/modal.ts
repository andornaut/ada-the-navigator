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
.ada-controls .ada-modal{
  position:absolute;
  inset:0;
  display:grid;
  place-items:center;
  background:#101926b3;
  pointer-events:auto;
  padding:16px;
  box-sizing:border-box
}

.ada-controls .ada-card-frame{
  position:relative;
  max-width:100%;
  max-height:100%;
  display:flex
}

.ada-controls .ada-card{
  box-sizing:border-box;
  width:max-content;
  min-width:min(50vw,480px);
  max-width:100%;
  max-height:100%;
  overflow:auto;
  padding:16px;
  color:${TEXT_TOKENS.label};
  background:#3b3850;
  border:2px solid #6b6685;
  border-radius:0;
  border-image:url('/art/ui/sprites/ui-settings-card.png') 2 fill / 2px stretch;
  image-rendering:pixelated
}

.ada-controls .ada-card header{
  display:grid;
  grid-template-columns:48px minmax(0,1fr) 48px;
  align-items:center;
  min-height:48px;
  margin-bottom:8px
}

.ada-controls .ada-card h2{
  grid-column:2;
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

.ada-controls .ada-actions{
  display:inline-grid;
  grid-auto-columns:1fr;
  grid-auto-flow:column;
  gap:8px;
  margin-top:8px
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

.ada-controls .ada-setting-note{
  font-size:13px;
  line-height:16px;
  color:${TEXT_TOKENS.supporting}
}

.ada-controls .ada-steps{
  display:flex;
  align-items:center;
  gap:8px;
  margin:0 0 16px
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
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", options.title);
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
  return { card, close, frame, header, title };
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
  row.append(...actionOrder(buttons).map(({ button }) => button));
  return row;
}
