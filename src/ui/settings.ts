import {
  type ControlVisibility,
  type DeviceSetting,
  pageStorage,
  prefersReducedMotion,
  readDeviceSettings,
  writeSetting,
} from "./device-settings.ts";
import { type InstallPort, startInstall, watchInstallRow } from "./install-row.ts";
import { createActions, createButton, createCard, createSwitchRow, MODAL_STYLE } from "./modal.ts";
import { SETTING_ICONS, settingsIcon, showIcon, STEPS_GLYPHS } from "./settings-icons.ts";
import { applyButtonSkin } from "./ui-skin.ts";

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

/* An open card covers the story panel (z-index 20) and the save status (21). */
.ada-controls.ada-modal-open{
  z-index:30
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

.ada-controls button:focus-visible{
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

/* Without the settings button (in play) the weapon buttons keep the top-right corner. */
.ada-controls.ada-no-settings-button .ada-weapon-selector{
  right:max(8px,var(--inset-right))
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

${MODAL_STYLE}

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
  const settingsCard = createCard({
    closeAction: "close-settings",
    closeLabel: options.labels.close,
    fontRole: FONT_ROLES.heading,
    title: options.labels.settings,
  });
  const { card, close: closeButton, frame: cardFrame } = settingsCard;
  // Rows in Chibi's and Archie's order: Move controls and Aim controls show or hide each
  // joystick's drawing; Sound and Reduced motion are switches with a note under the label.
  // Install joins last, shown only while the game can be installed.
  const storage = pageStorage();
  const settings = { ...readDeviceSettings(storage, prefersReducedMotion(window)) };
  const visibility = () => ({ aim: settings.aim, move: settings.move });
  const feedback = () => ({ reducedMotion: settings.reducedMotion, sound: settings.sound });
  // A control row, as in Chibi: icon, label (and note) and switch; the whole row is the switch.
  const switchRow = (setting: DeviceSetting, label: string, note?: string) => {
    const { row, show } = createSwitchRow({
      icon: settingsIcon(SETTING_ICONS[setting]),
      id: setting,
      label,
      note,
    });
    row.dataset.setting = setting;
    show(settings[setting]);
    row.addEventListener("click", () => {
      settings[setting] = !settings[setting];
      show(settings[setting]);
      writeSetting(storage, setting, settings[setting]);
      if (setting === "aim" || setting === "move") {
        options.onVisibilityChange(visibility());
      } else {
        options.onFeedbackChange?.(feedback());
      }
    });
    return row;
  };
  const rows = document.createElement("div");
  rows.className = "ada-rows";
  // The first row's label line sits centred in its 48px row.
  rows.dataset.inkTop = "14";
  rows.append(
    switchRow("move", options.labels.moveControls),
    switchRow("aim", options.labels.aimControls),
    switchRow("sound", options.labels.sound, options.labels.soundNote),
    switchRow("reducedMotion", options.labels.reducedMotion, options.labels.motionNote),
  );
  card.append(rows);
  // The Install row, as in Archie: its label and note, and a button that asks for the browser's
  // prompt or opens that browser's menu steps in the Settings card's place.
  const installRow = document.createElement("div");
  installRow.className = "ada-row ada-install-row";
  installRow.hidden = true;
  const installText = document.createElement("span");
  installText.className = "ada-setting-text";
  const installCaption = document.createElement("span");
  installCaption.textContent = options.labels.install;
  const installNote = document.createElement("span");
  installNote.className = "ada-setting-note";
  installNote.textContent = options.labels.installNote;
  installText.append(installCaption, installNote);
  const installButton = createButton(options.labels.installButton);
  installButton.classList.add("ada-compact");
  installButton.dataset.action = "install";
  installButton.setAttribute("aria-label", options.labels.install);
  installRow.append(settingsIcon(SETTING_ICONS.install), installText, installButton);
  // The whole row presses its button, as every control row does.
  installRow.addEventListener("click", (event) => {
    if (event.target !== installButton) {
      installButton.click();
    }
  });
  rows.append(installRow);
  const stepsParts = createCard({
    closeAction: "close-install-steps",
    closeLabel: options.labels.close,
    fontRole: FONT_ROLES.heading,
    title: "",
  });
  const { card: stepsCard, close: stepsX, frame: stepsFrame, title: stepsTitle } = stepsParts;
  stepsFrame.hidden = true;
  stepsCard.dataset.dialog = "install-steps";
  // Chibi's steps glyphs: the browser's own button for the first step, then Install.
  const stepsLine = document.createElement("div");
  stepsLine.className = "ada-steps";
  const stepsGlyph = settingsIcon(STEPS_GLYPHS.ios);
  const stepsText = document.createElement("p");
  stepsLine.append(stepsGlyph, settingsIcon(SETTING_ICONS.install), stepsText);
  const stepsClose = createButton(options.labels.close);
  stepsClose.dataset.action = "close-install-steps";
  stepsCard.append(stepsLine, createActions([{ button: stepsClose, role: "secondary" }]));
  options.onFeedbackChange?.(feedback());
  options.onVisibilityChange(visibility());
  modal.append(cardFrame, stepsFrame);
  root.append(style, ...joystickTargets, openButton, useButton, modal);
  parent.append(root);
  void applyButtonSkin(root).catch(() => undefined);
  let disposed = false;
  let open = false;
  let previousFocus: HTMLElement | undefined;
  const stepsOpen = () => !stepsFrame.hidden;
  const closeSteps = () => {
    if (stepsOpen()) {
      stepsFrame.hidden = true;
      cardFrame.hidden = false;
      settingsCard.fit();
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
    showIcon(stepsGlyph, STEPS_GLYPHS[browser]);
    stepsFrame.setAttribute("aria-label", words.title);
    cardFrame.hidden = true;
    stepsFrame.hidden = false;
    stepsParts.fit();
    stepsClose.focus();
  };
  const stopInstallRow = options.install
    ? watchInstallRow(options.install.port, (shown) => {
        installRow.hidden = !shown;
        settingsCard.fit();
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
      stepsFrame.hidden = true;
      cardFrame.hidden = false;
    }
    open = value;
    modal.hidden = !open;
    if (open) {
      settingsCard.fit();
    }
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
      const shown = stepsOpen() ? stepsFrame : cardFrame;
      const targets = [...shown.querySelectorAll<HTMLElement>("button")].filter(
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
      settingsCard.dispose();
      stepsParts.dispose();
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
