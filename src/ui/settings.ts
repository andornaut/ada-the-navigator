import {
  type ControlVisibility,
  type DeviceSetting,
  pageStorage,
  prefersReducedMotion,
  readDeviceSettings,
  writeSetting,
} from "./device-settings.ts";
import { type InstallPort, startInstall, watchInstallRow } from "./install-row.ts";

export type { ControlVisibility } from "./device-settings.ts";

export const FONT_ROLES = { body: "font-body", heading: "font-title" } as const;

export interface SettingsLabels {
  readonly aimControls: string;
  readonly close: string;
  readonly install: string;
  readonly installButton: string;
  readonly installNote: string;
  readonly motionNote: string;
  readonly moveControls: string;
  readonly reducedMotion: string;
  readonly settings: string;
  readonly sound: string;
  readonly soundNote: string;
}

export interface FeedbackSettings {
  readonly reducedMotion: boolean;
  readonly sound: boolean;
}

export type InstallSteps = Readonly<
  Record<"firefoxAndroid" | "ios", { readonly steps: string; readonly title: string }>
>;

export interface SettingsOptions {
  // The Install row's install functions and each menu browser's steps; without them no row.
  readonly install?: { readonly port: InstallPort; readonly steps: InstallSteps } | undefined;
  readonly labels: SettingsLabels;
  readonly onFeedbackChange?: (settings: FeedbackSettings) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onVisibilityChange: (visibility: ControlVisibility) => void;
}

const STYLE = `
@font-face{
  font-family:AdaUI;
  src:url('/art/ui/fonts/liberation/LiberationSans-Regular.ttf') format('truetype');
  font-weight:400;
  font-display:swap
}

@font-face{
  font-family:AdaUI;
  src:url('/art/ui/fonts/liberation/LiberationSans-Bold.ttf') format('truetype');
  font-weight:700;
  font-display:swap
}

.ada-controls{
  position:absolute;
  inset:0;
  pointer-events:none;
  font:16px AdaUI,'Liberation Sans',sans-serif;
  color:#172335;
  z-index:10
}

.ada-controls button{
  font:inherit;
  min-height:48px;
  min-width:48px;
  color:inherit;
  border:2px solid #172335;
  border-radius:8px;
  background:#fff8e6;
  cursor:pointer;
  pointer-events:auto;
  padding:8px 16px
}

.ada-controls button:focus-visible,.ada-controls input:focus-visible{
  outline:3px solid #5078b4;
  outline-offset:4px
}

.ada-controls .ada-settings-open{
  position:absolute;
  right:max(8px,var(--inset-right));
  top:max(8px,var(--inset-top))
}

.ada-controls .ada-settings-open{
  width:48px;
  height:48px;
  padding:0;
  display:grid;
  place-items:center
}

.ada-controls .ada-settings-open,
.ada-controls .ada-weapon-selector button{
  background:#262b44;
  border-color:#181425;
  color:#ead4aa
}

.ada-controls .ada-settings-open[aria-expanded=true],
.ada-controls .ada-weapon-selector button[aria-pressed=true]{
  background:#181425
}

.ada-controls .ada-settings-open::before{
  content:"";
  width:20px;
  height:20px;
  background:url('/art/ui/sprites/icon-settings-nav.png') center / 20px 20px no-repeat;
  image-rendering:pixelated
}

.ada-controls .ada-weapon-selector{
  position:absolute;
  right:calc(max(8px,var(--inset-right)) + 56px);
  top:max(8px,var(--inset-top));
  display:flex;
  gap:4px
}

.ada-controls .ada-weapon-selector button{
  width:48px;
  height:48px;
  padding:2px;
  display:grid;
  justify-items:center;
  align-content:center
}

.ada-controls .ada-weapon-selector button[aria-pressed=true]{
  outline:2px solid #ead4aa;
  outline-offset:1px;
  box-shadow:inset 0 0 0 2px #ead4aa
}

.ada-controls .ada-settings-open:focus-visible,
.ada-controls .ada-weapon-selector button:focus-visible{
  outline:3px solid #ead4aa;
  outline-offset:4px
}

.ada-controls .ada-weapon-selector button:disabled{
  opacity:0.5;
  cursor:default
}

.ada-controls .ada-weapon-selector img{
  width:20px;
  height:20px;
  pointer-events:none
}

.ada-controls .ada-shield-meter{
  position:absolute;
  left:0;
  right:0;
  bottom:0;
  height:3px;
  background:#525252;
  pointer-events:none
}

.ada-controls .ada-shield-meter span{
  display:block;
  height:100%;
  width:100%;
  background:#fff;
  transform-origin:left center
}

.ada-controls [data-control]{
  position:absolute;
  width:75px;
  height:75px;
  pointer-events:auto;
  touch-action:none
}

.ada-controls .ada-use{
  position:absolute;
  left:50%;
  bottom:max(24px,var(--inset-bottom));
  transform:translateX(-50%);
  max-width:calc(100% - 32px)
}

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

.ada-controls [hidden]{
  display:none!important
}

.ada-controls .ada-card{
  box-sizing:border-box;
  width:max-content;
  min-width:min(50%,480px);
  max-width:100%;
  max-height:100%;
  overflow:auto;
  padding:16px;
  background:#fff8e6;
  border:2px solid #172335;
  border-radius:0;
  border-image:url('/art/ui/sprites/ui-settings-card.png') 2 fill / 2px stretch
}

.ada-controls .ada-card header{
  display:grid;
  grid-template-columns:48px minmax(0,1fr) 48px;
  align-items:center;
  gap:8px;
  margin-bottom:8px
}

.ada-controls h2{
  font-size:24px;
  line-height:28px;
  text-align:center;
  margin:0;
  font-weight:700;
  overflow-wrap:anywhere
}

.ada-controls .ada-close{
  padding:0;
  border:0;
  background:transparent;
  display:grid;
  place-items:center
}
.ada-controls .ada-close::before{
  content:"";
  width:24px;
  height:24px;
  background:url('/art/ui/sprites/ui-close.png') 0 0 / 48px 24px
}
.ada-controls .ada-close:active::before{
  background-position:-24px 0
}

.ada-controls label{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  min-height:48px;
  line-height:20px;
  cursor:pointer
}

.ada-controls label span{
  overflow-wrap:anywhere
}

.ada-controls label .ada-setting-text{
  display:grid;
  gap:2px;
  padding:4px 0
}

.ada-controls label .ada-setting-note{
  font-size:13px;
  line-height:16px;
  opacity:0.75
}

.ada-controls .ada-install-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  min-height:48px
}

.ada-controls .ada-card p{
  margin:0 0 16px;
  line-height:20px;
  max-width:36em
}

.ada-controls .ada-actions{
  display:flex;
  justify-content:space-between;
  gap:16px;
  margin-top:8px
}

.ada-controls .ada-card .ada-primary{
  background:#262b44;
  border-color:#181425;
  color:#ead4aa
}

.ada-controls input{
  width:32px;
  height:20px;
  flex:none;
  accent-color:#36764f
}

`;

// Intrinsic browser text measurement keeps the card centred without shrinking its fonts.
export function createSettings(parent: HTMLElement, options: SettingsOptions) {
  const root = document.createElement("div");
  root.className = "ada-controls";
  root.dataset.fontRole = FONT_ROLES.body;
  const style = document.createElement("style");
  style.textContent = STYLE;
  const openButton = document.createElement("button");
  openButton.className = "ada-settings-open";
  openButton.dataset.action = "settings";
  openButton.setAttribute("aria-label", options.labels.settings);
  openButton.title = options.labels.settings;
  openButton.setAttribute("aria-haspopup", "dialog");
  openButton.setAttribute("aria-expanded", "false");
  const useButton = document.createElement("button");
  useButton.className = "ada-use";
  useButton.hidden = true;
  const joystickTargets = ["move", "aim"].map((side) => {
    const target = document.createElement("div");
    target.dataset.control = `${side}-joystick`;
    target.setAttribute("role", "group");
    target.setAttribute(
      "aria-label",
      side === "move" ? options.labels.moveControls : options.labels.aimControls,
    );
    return target;
  });
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const card = document.createElement("section");
  card.className = "ada-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", options.labels.settings);
  const header = document.createElement("header");
  const spacer = document.createElement("span");
  const title = document.createElement("h2");
  title.textContent = options.labels.settings;
  title.dataset.fontRole = FONT_ROLES.heading;
  const closeButton = document.createElement("button");
  closeButton.className = "ada-close";
  closeButton.dataset.action = "close-settings";
  closeButton.setAttribute("aria-label", options.labels.close);
  header.append(spacer, title, closeButton);
  // Rows in Chibi's and Archie's order: Move controls and Aim controls show or hide each
  // joystick's drawing; Sound and Reduced motion are switches with a note under the label.
  // Install joins last, shown only while the game can be installed.
  const storage = pageStorage();
  const settings = { ...readDeviceSettings(storage, prefersReducedMotion(window)) };
  const visibility = () => ({ aim: settings.aim, move: settings.move });
  const feedback = () => ({ reducedMotion: settings.reducedMotion, sound: settings.sound });
  const switchRow = (setting: DeviceSetting, label: string, note?: string) => {
    const element = document.createElement("label");
    const text = document.createElement("span");
    text.className = "ada-setting-text";
    const caption = document.createElement("span");
    caption.textContent = label;
    text.append(caption);
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.setAttribute("aria-label", label);
    if (note) {
      const noteText = document.createElement("span");
      noteText.className = "ada-setting-note";
      noteText.id = `ada-setting-note-${setting}`;
      noteText.textContent = note;
      text.append(noteText);
      toggle.setAttribute("aria-describedby", noteText.id);
    }
    toggle.checked = settings[setting];
    toggle.addEventListener("change", () => {
      settings[setting] = toggle.checked;
      writeSetting(storage, setting, toggle.checked);
      if (setting === "aim" || setting === "move") {
        options.onVisibilityChange(visibility());
      } else {
        options.onFeedbackChange?.(feedback());
      }
    });
    element.append(text, toggle);
    return element;
  };
  const rows = document.createElement("div");
  rows.className = "ada-rows";
  rows.append(
    switchRow("move", options.labels.moveControls),
    switchRow("aim", options.labels.aimControls),
    switchRow("sound", options.labels.sound, options.labels.soundNote),
    switchRow("reducedMotion", options.labels.reducedMotion, options.labels.motionNote),
  );
  card.append(header, rows);
  // The Install row, as in Archie: its label and note, and a button that asks for the browser's
  // prompt or opens that browser's menu steps in the Settings card's place.
  const installRow = document.createElement("div");
  installRow.className = "ada-install-row";
  installRow.hidden = true;
  const installText = document.createElement("span");
  installText.className = "ada-setting-text";
  const installCaption = document.createElement("span");
  installCaption.textContent = options.labels.install;
  const installNote = document.createElement("span");
  installNote.className = "ada-setting-note";
  installNote.textContent = options.labels.installNote;
  installText.append(installCaption, installNote);
  const installButton = document.createElement("button");
  installButton.dataset.action = "install";
  installButton.textContent = options.labels.installButton;
  installButton.setAttribute("aria-label", options.labels.install);
  installRow.append(installText, installButton);
  rows.append(installRow);
  const stepsCard = document.createElement("section");
  stepsCard.className = "ada-card";
  stepsCard.hidden = true;
  stepsCard.dataset.dialog = "install-steps";
  stepsCard.setAttribute("role", "dialog");
  stepsCard.setAttribute("aria-modal", "true");
  const stepsHeader = document.createElement("header");
  const stepsTitle = document.createElement("h2");
  stepsTitle.dataset.fontRole = FONT_ROLES.heading;
  const stepsX = document.createElement("button");
  stepsX.className = "ada-close";
  stepsX.dataset.action = "close-install-steps";
  stepsX.setAttribute("aria-label", options.labels.close);
  stepsHeader.append(document.createElement("span"), stepsTitle, stepsX);
  const stepsText = document.createElement("p");
  const stepsClose = document.createElement("button");
  stepsClose.dataset.action = "close-install-steps";
  stepsClose.textContent = options.labels.close;
  stepsCard.append(stepsHeader, stepsText, stepsClose);
  options.onFeedbackChange?.(feedback());
  options.onVisibilityChange(visibility());
  modal.append(card, stepsCard);
  root.append(style, ...joystickTargets, openButton, useButton, modal);
  parent.append(root);
  let disposed = false;
  let open = false;
  let previousFocus: HTMLElement | undefined;
  const stepsOpen = () => !stepsCard.hidden;
  const closeSteps = () => {
    if (stepsOpen()) {
      stepsCard.hidden = true;
      card.hidden = false;
      installButton.focus();
    }
  };
  const openSteps = (browser: keyof InstallSteps) => {
    const words = options.install?.steps[browser];
    if (!words) {
      return;
    }
    stepsTitle.textContent = words.title;
    stepsText.textContent = words.steps;
    stepsCard.setAttribute("aria-label", words.title);
    card.hidden = true;
    stepsCard.hidden = false;
    stepsClose.focus();
  };
  const stopInstallRow = options.install
    ? watchInstallRow(options.install.port, (shown) => {
        installRow.hidden = !shown;
        if (!shown) {
          closeSteps();
        }
      })
    : () => undefined;
  installButton.addEventListener("click", () => {
    if (options.install) {
      void startInstall(options.install.port, openSteps, () => open && !disposed);
    }
  });
  for (const button of [stepsX, stepsClose]) {
    button.addEventListener("click", closeSteps);
  }
  const setOpen = (value: boolean) => {
    if (disposed || value === open) {
      return;
    }
    if (!value) {
      stepsCard.hidden = true;
      card.hidden = false;
    }
    open = value;
    modal.hidden = !open;
    openButton.setAttribute("aria-expanded", String(open));
    if (open) {
      previousFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      closeButton.focus();
    } else {
      previousFocus?.focus();
    }
    options.onOpenChange(open);
  };
  openButton.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => setOpen(false));
  // A full outside click closes the card; dragging out of the card does not.
  let outsidePress: { readonly id: number; readonly x: number; readonly y: number } | undefined;
  modal.addEventListener("pointerdown", (event) => {
    outsidePress =
      event.target === modal
        ? { id: event.pointerId, x: event.clientX, y: event.clientY }
        : undefined;
  });
  modal.addEventListener("pointercancel", () => {
    outsidePress = undefined;
  });
  modal.addEventListener("click", (event) => {
    if (
      outsidePress &&
      event.target === modal &&
      Math.hypot(event.clientX - outsidePress.x, event.clientY - outsidePress.y) <= 10
    ) {
      if (stepsOpen()) {
        closeSteps();
      } else {
        setOpen(false);
      }
    }
    outsidePress = undefined;
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      const shown = stepsOpen() ? stepsCard : card;
      const targets = [...shown.querySelectorAll<HTMLElement>("button,input")].filter(
        (target) => target.offsetParent !== null,
      );
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  return {
    card,
    close: () => setOpen(false),
    closeSteps,
    dispose(): void {
      if (disposed) {
        return;
      }
      setOpen(false);
      disposed = true;
      stopInstallRow();
      root.remove();
    },
    isOpen: () => open,
    joystickTargets,
    open: () => setOpen(true),
    openButton,
    root,
    stepsOpen,
    useButton,
  };
}
