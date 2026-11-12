import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";

import type { InstallStepsKind } from "../pwa/index.ts";
import {
  type ControlVisibility,
  type DeviceSetting,
  pageStorage,
  prefersReducedMotion,
  readDeviceSettings,
  writeSetting,
} from "./deviceSettings.ts";
import { type InstallPort, startInstall, watchInstallRow } from "./installRow.ts";
import { CONTROL_ROW, WHOLE_PX_EDGES } from "./layout/controls.ts";
import { font, fromHudEdge, units, viewStyle } from "./layout/css.ts";
import { hudButtonTarget, type StartNavButton, startNavOrder } from "./layout/playView.ts";
import { TYPE } from "./layout/tokens.ts";
import { TOUCH_STICK, USE_DISC } from "./layout/touchControls.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import {
  createActions,
  createButton,
  createCard,
  createSwitchRow,
  FOCUS_STYLE,
  isTap,
  MODAL_STYLE,
  setScrollGroup,
  TEXT_TOKENS,
} from "./modal.ts";
import { SETTING_ICONS, settingsIcon, showIcon, STEPS_GLYPHS } from "./settingsIcons.ts";
import { applyButtonSkin } from "./uiSkin.ts";
import { hudDiscStyle } from "./weapons.ts";

export type { ControlVisibility } from "./deviceSettings.ts";

export const FONT_ROLES = { body: "font-body", heading: "font-title" } as const;

export interface SettingsLabels {
  readonly aimControls: string;
  readonly close: string;
  /** The Move and Aim controls rows' note: hiding a stick hides only its drawing. */
  readonly controlsNote: string;
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
  Record<InstallStepsKind, { readonly steps: string; readonly title: string }>
>;

export interface SettingsOptions {
  // The build's version and commit (src/buildLabel.ts), the card's last line.
  readonly build: string;
  // The Install row's install functions and each menu browser's steps; without them no row.
  readonly install?: { readonly port: InstallPort; readonly steps: InstallSteps } | undefined;
  readonly labels: SettingsLabels;
  readonly onFeedbackChange?: (settings: FeedbackSettings) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onVisibilityChange: (visibility: ControlVisibility) => void;
}

// The start screen's Settings glyph (art/settings-icon.md): the 20 vector gear, a mask drawn with
// smooth sampling, as the Achievements trophy is.
export const SETTINGS_GLYPH = "/art/ui/icons/settings.svg";

// The start screen's Achievements glyph (art/achievements-icon.md): the 20 vector trophy, a mask
// drawn with smooth sampling.
export const ACHIEVEMENTS_GLYPH = "/art/ui/icons/achievements.svg";

// The start screen's Exit glyph (art/exit-icon.md): the 20 vector door with an arrow leaving it,
// a mask drawn with smooth sampling, as the Settings gear is.
export const EXIT_GLYPH = "/art/ui/icons/exit.svg";

// Every start-screen disc while a press holds: the pause disc's held face and a white glyph.
export const NAV_DISC_PRESSED = { face: "#3a4466", glyph: "#ffffff" } as const;

// The start screen's discs where Exit shows: .ada-controls carries this attribute while it does.
export const EXIT_SHOWN_ATTRIBUTE = "data-exit-shown";

// A start-screen nav disc's place: its offsets from the HUD rect's right and top, at its index in
// startNavOrder(exit) (hudButtonTarget's index).
const navPlace = (button: StartNavButton, exit: boolean): string => {
  const target = hudButtonTarget(startNavOrder(exit).indexOf(button));
  return `right:${fromHudEdge("right", -(target.x + target.width))};top:${fromHudEdge("top", target.y)}`;
};

export const SETTINGS_STYLE = `
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

${viewStyle(WHOLE_PX_EDGES)}

.ada-controls{
  position:absolute;
  inset:0;
  pointer-events:none;
  font:${font(TYPE.body)};
  color:#172335;
  z-index:10
}

/* An open card covers the story panel (z-index 20) and the save status (21). */
.ada-controls.ada-modal-open{
  z-index:30
}

/* The base button of the weapon selector and the station rows. */
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

/* The start screen's Settings: an idle HUD disc button on the HUD rect's top-right corner
   (startNavOrder), its 20 gear a mask in the idle glyph colour. */
.ada-controls .ada-settings-open{
  position:absolute;
  ${navPlace("settings", false)};
  --glyph:url('${SETTINGS_GLYPH}')
}
${hudDiscStyle(".ada-controls .ada-settings-open", ".ada-disc")}

/* The start screen's Achievements: the same HUD disc button one pitch left of Settings, its 20
   trophy a mask in the idle glyph colour. */
.ada-controls .ada-achievements-open{
  position:absolute;
  ${navPlace("achievements", false)};
  --glyph:url('${ACHIEVEMENTS_GLYPH}')
}
${hudDiscStyle(".ada-controls .ada-achievements-open", ".ada-disc")}

/* The start screen's Exit, where it shows: the same HUD disc button at the far top right, Settings
   and Achievements one pitch further left each. Where it does not show it is never made, so it
   has no press area and the others keep their places. */
.ada-controls .ada-exit-open{
  position:absolute;
  ${navPlace("exit", true)};
  --glyph:url('${EXIT_GLYPH}')
}
${hudDiscStyle(".ada-controls .ada-exit-open", ".ada-disc")}
.ada-controls[${EXIT_SHOWN_ATTRIBUTE}] .ada-settings-open{
  ${navPlace("settings", true)}
}
.ada-controls[${EXIT_SHOWN_ATTRIBUTE}] .ada-achievements-open{
  ${navPlace("achievements", true)}
}

/* Pressed, on every start-screen disc: the pause disc's held face and a white glyph. */
.ada-controls .ada-settings-open:active,
.ada-controls .ada-achievements-open:active,
.ada-controls .ada-exit-open:active{
  color:${NAV_DISC_PRESSED.glyph}
}
.ada-controls .ada-settings-open:active .ada-disc,
.ada-controls .ada-achievements-open:active .ada-disc,
.ada-controls .ada-exit-open:active .ada-disc{
  background:${NAV_DISC_PRESSED.face}
}

/* Each joystick's pointer target, placed over its rest ring (touchControls.ts). */
.ada-controls [data-control]{
  position:absolute;
  width:${units(TOUCH_STICK.frame)};
  height:${units(TOUCH_STICK.frame)};
  pointer-events:auto;
  touch-action:none
}

/* The Use disc's accessible button over its drawn frame (touchControls.ts useDiscLayout): it
   draws nothing and takes no pointer input, so a press there reaches the canvas, where the disc's
   press circle takes it, or the conversation box above the canvas where the two overlap. Its name
   is the action's; assistive technology activates it. */
.ada-controls .ada-use{
  position:absolute;
  box-sizing:border-box;
  width:${units(USE_DISC.frame)};
  height:${units(USE_DISC.frame)};
  min-width:0;
  min-height:0;
  margin:0;
  padding:0;
  border:0;
  border-radius:50%;
  background:transparent;
  pointer-events:none
}

.ada-controls .ada-use:focus-visible{${FOCUS_STYLE}
}

/* This build's version and commit, the Settings card's last line as in Chibi: body text in the
   supporting colour. */
.ada-controls .ada-build{
  margin:0;
  font:${font(TYPE.body)};
  color:${TEXT_TOKENS.supporting};
  text-align:center
}

${MODAL_STYLE}

`;

// Intrinsic browser text measurement keeps the card centred without shrinking its fonts.
export function createSettings(parent: HTMLElement, options: SettingsOptions) {
  const root = document.createElement("div");
  root.className = "ada-controls";
  root.dataset.fontRole = FONT_ROLES.body;
  const openButton = document.createElement("button");
  openButton.className = "ada-settings-open";
  openButton.dataset.action = "settings";
  openButton.setAttribute("aria-label", options.labels.settings);
  openButton.title = options.labels.settings;
  openButton.setAttribute("aria-haspopup", "dialog");
  openButton.setAttribute("aria-expanded", "false");
  const openDisc = document.createElement("span");
  openDisc.className = "ada-disc";
  openDisc.setAttribute("aria-hidden", "true");
  openButton.append(openDisc);
  const useButton = document.createElement("button");
  useButton.type = "button";
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
  const { body: card, close: closeButton, frame: cardFrame } = settingsCard;
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
  // The first row's label line sits centred in its row.
  rows.dataset.inkTop = String((CONTROL_ROW.height - TYPE.body.lineHeight) / 2);
  rows.append(
    switchRow("move", options.labels.moveControls, options.labels.controlsNote),
    switchRow("aim", options.labels.aimControls, options.labels.controlsNote),
    switchRow("sound", options.labels.sound, options.labels.soundNote),
    switchRow("reducedMotion", options.labels.reducedMotion, options.labels.motionNote),
  );
  // The build line, after the rows as in Chibi: plain text screen readers read with the card.
  const build = document.createElement("p");
  build.className = "ada-build";
  build.textContent = options.build;
  card.append(rows, build);
  setScrollGroup(settingsCard, rows);
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
  const { body: stepsBody, card: stepsCard, close: stepsX, frame: stepsFrame } = stepsParts;
  const stepsTitle = stepsParts.title;
  stepsFrame.hidden = true;
  stepsCard.dataset.dialog = "install-steps";
  // Chibi's steps glyphs: the browser's own button for the first step, then Install.
  const stepsLine = document.createElement("div");
  stepsLine.className = "ada-steps ada-prose";
  // The kind's glyph replaces the Install glyph each time the steps open (openSteps).
  const stepsGlyph = settingsIcon(SETTING_ICONS.install);
  const stepsText = document.createElement("p");
  const stepsInstallGlyph = settingsIcon(SETTING_ICONS.install);
  stepsLine.append(stepsGlyph, stepsInstallGlyph, stepsText);
  const stepsClose = createButton(options.labels.close);
  stepsClose.dataset.action = "close-install-steps";
  stepsBody.append(stepsLine, createActions([{ button: stepsClose, role: "secondary" }]));
  setScrollGroup(stepsParts, stepsLine);
  options.onFeedbackChange?.(feedback());
  options.onVisibilityChange(visibility());
  modal.append(cardFrame, stepsFrame);
  root.append(...joystickTargets, openButton, useButton, modal);
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
      focusTarget(installButton);
    }
  };
  const openSteps = (kind: InstallStepsKind) => {
    const words = options.install?.steps[kind];
    if (!words) {
      return;
    }
    stepsTitle.textContent = words.title;
    stepsText.textContent = words.steps;
    const glyph = STEPS_GLYPHS[kind];
    stepsGlyph.hidden = glyph === undefined;
    stepsInstallGlyph.hidden = glyph === undefined;
    if (glyph !== undefined) {
      showIcon(stepsGlyph, glyph);
    }
    stepsFrame.setAttribute("aria-label", words.title);
    cardFrame.hidden = true;
    stepsFrame.hidden = false;
    stepsParts.fit();
    focusTarget(stepsClose);
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
      focusTarget(closeButton);
    } else if (previousFocus) {
      focusTarget(previousFocus);
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
      isTap(readViewUnit(modal), outsidePress, { x: event.clientX, y: event.clientY })
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
        if (last) {
          focusTarget(last);
        }
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        if (first) {
          focusTarget(first);
        }
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
