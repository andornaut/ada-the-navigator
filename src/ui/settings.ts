import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { mountLayout } from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { CONTENT } from "../data/content.ts";
import { SETTINGS_STATE_LABELS } from "../data/settingsCopy.ts";
import type { InstallStepsKind } from "../pwa/index.ts";
import {
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
} from "./actionBinding.ts";
import { applyAdaControlTheme, createAdaPageDivider } from "./buttonPresentation.ts";
import {
  type ControlVisibility,
  type DeviceSetting,
  pageStorage,
  prefersReducedMotion,
  readDeviceSettings,
  writeSetting,
} from "./deviceSettings.ts";
import { type InstallPort, startInstall, watchInstallRow } from "./installRow.ts";
import { CARD_CONTENT, SCROLL } from "./layout/contentCard.ts";
import { CONTROL_ROW, WHOLE_PX_EDGES } from "./layout/controls.ts";
import { font, fromHudEdge, units, viewStyle } from "./layout/css.ts";
import { frameSize } from "./layout/frameBox.ts";
import { NAVIGATION_DISCS } from "./layout/navigationButton.ts";
import { hudButtonTarget, startNavOrder } from "./layout/playView.ts";
import {
  SETTINGS_OUTER_PADDING,
  SETTINGS_TITLE_INK_TOP,
  settingsColumns,
} from "./layout/settings.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { TOUCH_STICK, USE_DISC } from "./layout/touchControls.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
import {
  createActions,
  createButton,
  createCard,
  createSwitchRow,
  FOCUS_STYLE,
  LEGACY_TEXT_BUTTON,
  MODAL_STYLE,
  setFooterAction,
  setScrollGroup,
  TEXT_TOKENS,
} from "./modal.ts";
import { createModalLayer } from "./modalLayer.ts";
import { SETTING_ICONS, settingsIcon, showIcon, STEPS_GLYPHS } from "./settingsIcons.ts";
import { type SettingsLayoutSchema, type SettingsNative, settingsTree } from "./settingsTree.ts";
import { alignSwitchRowIcons, createInkMeasure } from "./switchRowInk.ts";
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
  readonly stateHidden?: string;
  readonly stateOff?: string;
  readonly stateOn?: string;
  readonly stateShown?: string;
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

// Every start-screen disc while a press holds: the pause disc's held face and a white glyph.
export const NAV_DISC_PRESSED = { face: "#3a4466", glyph: "#ffffff" } as const;

const DEFAULT_CONTROL_FOCUS = `.ada-controls button:focus-visible:not(:where(
  .ada-close,.ada-route-marker,.ada-use,.ada-row[role=switch],.ada-quest-endpoint,
  ${NAVIGATION_DISCS},${LEGACY_TEXT_BUTTON}
))`;

// The start screen while Exit shows: .ada-controls carries this attribute while it does.
export const EXIT_SHOWN_ATTRIBUTE = "data-exit-shown";

// A start-screen HUD disc's place at hudButtonTarget(index): its offsets from the HUD rect's
// right and top.
const navPlace = (index: number): string => {
  const target = hudButtonTarget(index);
  return `right:${fromHudEdge("right", -(target.x + target.width))};top:${fromHudEdge("top", target.y)}`;
};

export const SETTINGS_STYLE = `
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

/* These controls paint their focus in their own rules. */
${DEFAULT_CONTROL_FOCUS}{${FOCUS_STYLE}
}
@media (forced-colors: active){
  ${DEFAULT_CONTROL_FOCUS}{
    outline-color:Highlight;
    box-shadow:none
  }
}

/* The retired start-screen Settings disc, which never shows: an idle HUD disc button on the HUD
   rect's top-right corner, its 20 gear a mask in the idle glyph colour. */
.ada-controls .ada-settings-open{
  position:absolute;
  ${navPlace(0)};
  --glyph:url('${SETTINGS_GLYPH}')
}
${hudDiscStyle(".ada-controls .ada-settings-open", ".ada-disc")}

/* The retired start-screen Achievements disc, which never shows: the same HUD disc button one
   pitch left of Settings, its 20 trophy a mask in the idle glyph colour. */
.ada-controls .ada-achievements-open{
  position:absolute;
  ${navPlace(1)};
  --glyph:url('${ACHIEVEMENTS_GLYPH}')
}
${hudDiscStyle(".ada-controls .ada-achievements-open", ".ada-disc")}

/* The start screen's Exit, where it shows (startNavOrder): the same HUD disc button alone at the
   far top right. Where it does not show it is never made, so it has no press area. */
.ada-controls .ada-exit-open{
  position:absolute;
  ${navPlace(startNavOrder(true).indexOf("exit"))}
}

/* Pressed, on every start-screen disc: the pause disc's held face and a white glyph. */
.ada-controls .ada-settings-open:active,
.ada-controls .ada-achievements-open:active{
  color:${NAV_DISC_PRESSED.glyph}
}
.ada-controls .ada-settings-open:active .ada-disc,
.ada-controls .ada-achievements-open:active .ada-disc{
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
   takes no pointer input, so a press there reaches the canvas, where the disc's
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

.ada-controls .ada-use:focus-visible{
  outline:none
}

.ada-controls .ada-setting-state{
  flex:none;
  white-space:nowrap;
  text-align:center
}
/* Every switch row, in Settings and Cheats: the switch over its On or Off state, and the row icon
   level with the label's ink. */
.ada-controls .ada-setting-toggle{
  display:flex;
  flex:none;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:${units(SPACING.rowGap)};
  align-self:center
}
.ada-controls [data-dialog=settings] .ada-row > .ada-icon,
.ada-controls .ada-row[role=switch] > .ada-icon{
  align-self:flex-start;
  margin-top:calc(
    var(--setting-title-ink-top,${units(SETTINGS_TITLE_INK_TOP)}) - var(--setting-icon-ink-top,0px)
  )
}
.ada-controls [data-dialog=settings] .ada-settings-rows{
  padding:0 ${units(SETTINGS_OUTER_PADDING - SPACING.panelPadding)};
  box-sizing:border-box;
  grid-auto-rows:max-content;
  align-self:stretch
}

/* Independent columns keep each switch and its help together at their natural height. */
.ada-controls .ada-settings-column{
  display:grid;
  align-content:start;
  align-self:stretch;
  row-gap:${units(CARD_CONTENT.rowGap)};
  min-width:0
}
.ada-controls [data-dialog=settings] .ada-settings-rows.ui-layout-stack{
  grid-template-columns:minmax(0,1fr)
}
.ada-controls .ada-settings-rows[data-columns="2"] > .ada-page-divider{
  grid-column:2;
  grid-row:1;
  justify-self:center;
  align-self:stretch;
  pointer-events:none
}
.ada-controls .ada-settings-rows[data-columns="1"] > .ada-page-divider{display:none}
.ada-controls [data-dialog=settings] .ada-settings-actions{
  align-self:flex-end;
  justify-content:flex-end
}
.ada-controls [data-dialog=settings] .ada-build{align-self:stretch}

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
  const textMeasure = createInkMeasure();
  const root = document.createElement("div");
  root.className = "ada-controls";
  applyAdaControlTheme(root);
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
  const actionBindings: ReturnType<typeof bindAdaAction>[] = [];
  const registerAction = (
    element: HTMLElement,
    run: () => void,
    beforeClick?: (event: MouseEvent) => boolean | void,
  ) => {
    actionBindings.push(
      bindAdaAction(
        {
          ...(beforeClick ? { beforeClick } : {}),
          click: { availability: () => ({ kind: "available" }), run },
          current: () => !disposed,
          slopPx: () => SCROLL.dragThreshold * readViewUnit(element),
        },
        element,
      ),
    );
  };
  const modal = document.createElement("div");
  modal.className = "ada-modal";
  modal.hidden = true;
  const settingsCard = createCard({
    closeAction: "close-settings",
    closeLabel: options.labels.close,
    fontRole: FONT_ROLES.heading,
    size: "large",
    title: options.labels.settings,
  });
  const { body: card, close: closeButton, frame: cardFrame } = settingsCard;
  cardFrame.dataset.dialog = "settings";
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
      align: note ? "top" : "center",
      icon: settingsIcon(SETTING_ICONS[setting]),
      id: setting,
      label,
      note,
    });
    row.dataset.setting = setting;
    const currentState = document.createElement("span");
    currentState.className = "ada-setting-state";
    // The switch's aria-checked already exposes its current state to assistive technology.
    currentState.setAttribute("aria-hidden", "true");
    const toggle = row.lastElementChild!;
    const toggleStack = document.createElement("span");
    toggleStack.className = "ada-setting-toggle";
    toggleStack.append(toggle, currentState);
    row.append(toggleStack);
    const update = () => {
      const on = settings[setting];
      show(on);
      currentState.textContent =
        setting === "aim" || setting === "move"
          ? on
            ? (options.labels.stateShown ?? SETTINGS_STATE_LABELS.shown)
            : (options.labels.stateHidden ?? SETTINGS_STATE_LABELS.hidden)
          : on
            ? (options.labels.stateOn ?? SETTINGS_STATE_LABELS.on)
            : (options.labels.stateOff ?? SETTINGS_STATE_LABELS.off);
    };
    update();
    registerAction(row, () => {
      settings[setting] = !settings[setting];
      update();
      writeSetting(storage, setting, settings[setting]);
      fitSettings();
      if (setting === "aim" || setting === "move") {
        options.onVisibilityChange(visibility());
      } else {
        options.onFeedbackChange?.(feedback());
      }
    });
    return row;
  };
  const leftColumn = document.createElement("div");
  leftColumn.className = "ada-settings-column";
  leftColumn.dataset.settingsColumn = "left";
  const rightColumn = document.createElement("div");
  rightColumn.className = "ada-settings-column";
  rightColumn.dataset.settingsColumn = "right";
  const switches = {
    aim: switchRow("aim", options.labels.aimControls, options.labels.controlsNote),
    move: switchRow("move", options.labels.moveControls, options.labels.controlsNote),
    reducedMotion: switchRow(
      "reducedMotion",
      options.labels.reducedMotion,
      options.labels.motionNote,
    ),
    sound: switchRow("sound", options.labels.sound, options.labels.soundNote),
  };
  const divider = createAdaPageDivider(document);
  divider.hidden = true;
  // The build line, after the rows as in Chibi: plain text screen readers read with the card.
  const dismiss = createButton(CONTENT.labels.questBack!, "primary");
  dismiss.dataset.action = "settings-close";
  const actions = createActions([{ button: dismiss, role: "primary" }]);
  actions.classList.add("ada-settings-actions");
  setFooterAction("back", actions);
  const build = document.createElement("p");
  build.className = "ada-build";
  build.textContent = options.build;
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

  const stepsParts = createCard({
    closeAction: "close-install-steps",
    closeLabel: options.labels.close,
    fontRole: FONT_ROLES.heading,
    size: "medium",
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
  const stepsClose = createButton(CONTENT.labels.questBack!);
  stepsClose.dataset.action = "close-install-steps";
  const stepsActions = createActions([{ button: stepsClose, role: "secondary" }]);
  setFooterAction("back", stepsActions);
  stepsBody.append(stepsLine, stepsActions);
  setScrollGroup(stepsParts, stepsLine);
  options.onFeedbackChange?.(feedback());
  options.onVisibilityChange(visibility());
  root.append(...joystickTargets, openButton, useButton, modal);
  const layer = createModalLayer(modal);
  let disposed = false;
  let open = false;
  let leaveSettingsPressView: (() => void) | undefined;
  let leaveStepsPressView: (() => void) | undefined;
  let previousFocus: HTMLElement | undefined;
  let arrangementColumns: 1 | 2 = 1;
  let installVisible = false;
  const nativeNodes: Readonly<Record<SettingsNative, HTMLElement>> = {
    ...switches,
    actions,
    build,
    divider,
    install: installRow,
  };
  const arrangement = mountLayout<SettingsLayoutSchema>(
    {
      components: {
        column: {
          create: (side) => {
            const element = side === "left" ? leftColumn : rightColumn;
            return { dispose() {}, element, slots: { rows: element }, update() {} };
          },
          slots: ["rows"],
        },
        native: {
          create: (name) => ({ dispose() {}, element: nativeNodes[name], slots: {}, update() {} }),
          slots: [],
        },
        settings: {
          create: () => ({ dispose() {}, element: cardFrame, slots: { body: card }, update() {} }),
          slots: ["body"],
        },
      },
      host: modal,
    },
    settingsTree({ columns: arrangementColumns, install: installVisible }),
  );
  let rows: HTMLElement;
  const bindRows = () => {
    rows = card.firstElementChild as HTMLElement;
    rows.classList.add("ada-settings-rows");
    rows.dataset.inkTop = String((CONTROL_ROW.height - TYPE.body.lineHeight) / 2);
    rows.dataset.columns = String(arrangementColumns);
    if (stepsFrame.parentElement === modal && stepsFrame.nextSibling) {
      modal.append(stepsFrame);
    }
  };
  bindRows();
  modal.append(stepsFrame);
  const updateArrangement = () => {
    const focused = document.activeElement as HTMLElement | null;
    arrangement.update(settingsTree({ columns: arrangementColumns, install: installVisible }));
    bindRows();
    if (focused && root.contains(focused) && focused !== document.activeElement) {
      focusTarget(focused);
    }
  };
  function fitSettings(): void {
    if (!open || disposed) {
      return;
    }
    const unit = readViewUnit(rows);
    const stacks = [...rows.querySelectorAll<HTMLElement>(".ada-setting-toggle")];
    for (const stack of stacks) {
      stack.style.width = "max-content";
    }
    const stackWidth = Math.max(
      CONTROL_ROW.switch.width,
      ...stacks.map((stack) => frameSize(stack).width / unit),
    );
    for (const stack of stacks) {
      stack.style.width = units(stackWidth);
    }
    const switches = [...rows.querySelectorAll<HTMLElement>("[role=switch]")];
    const widths = switches.map((row) => {
      const text = row.querySelector<HTMLElement>(".ada-setting-text")!;
      const caption = text.firstElementChild as HTMLElement;
      const previous = caption.style.width;
      caption.style.width = "max-content";
      const label = frameSize(caption).width;
      caption.style.width = previous;
      const parts = [...row.children].filter((part) => part !== text);
      return (
        label +
        parts.reduce((sum, part) => sum + frameSize(part).width, 0) +
        parseFloat(getComputedStyle(row).columnGap) * parts.length
      );
    });
    const style = getComputedStyle(modal);
    const availableWidth =
      (modal.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) / unit;
    const fitted = settingsColumns(
      { availableWidth },
      widths.map((width) => width / unit),
    );
    if (arrangementColumns !== fitted.columns) {
      arrangementColumns = fitted.columns;
      updateArrangement();
    }
    rows.dataset.columns = card.dataset.settingsColumns = String(fitted.columns);
    divider.hidden = fitted.columns !== 2;
    cardFrame.dataset.cardSize = fitted.columns === 2 ? "large" : "medium";
    settingsCard.fit();
    alignSwitchRowIcons(textMeasure, rows.querySelectorAll<HTMLElement>(".ada-row"));
  }
  window.addEventListener("resize", fitSettings);
  window.addEventListener(VIEW_SCALE_EVENT, fitSettings);
  const stepsOpen = () => !stepsFrame.hidden;
  const closeSteps = () => {
    if (stepsOpen()) {
      leaveStepsPressView?.();
      leaveStepsPressView = undefined;
      stepsFrame.hidden = true;
      cardFrame.hidden = false;
      fitSettings();
      assertAdaActionBindings(cardFrame);
      leaveSettingsPressView = layer.open(
        {
          backdrop: modal,
          close: () => setOpen(false),
          focus: installButton,
          isolation: "dialog",
          restore: () => previousFocus,
        },
        cardFrame,
      );
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
    leaveStepsPressView?.();
    leaveSettingsPressView?.();
    leaveSettingsPressView = undefined;
    cardFrame.hidden = true;
    stepsFrame.hidden = false;
    stepsParts.fit();
    assertAdaActionBindings(stepsFrame);
    leaveStepsPressView = layer.open(
      {
        backdrop: modal,
        close: closeSteps,
        focus: stepsClose,
        isolation: "dialog",
        restore: () => installButton,
      },
      stepsFrame,
    );
  };
  const stopInstallRow = options.install
    ? watchInstallRow(options.install.port, (shown) => {
        installRow.hidden = !shown;
        installVisible = shown;
        updateArrangement();
        fitSettings();
        if (!shown) {
          closeSteps();
        }
      })
    : () => undefined;
  const requestInstall = () => {
    if (options.install) {
      void startInstall(options.install.port, openSteps, () => open && !disposed);
    }
  };
  registerAction(installButton, requestInstall);
  registerAction(
    installRow,
    requestInstall,
    (event) => !(event.target instanceof Node && installButton.contains(event.target)),
  );
  for (const button of [stepsX, stepsClose]) {
    registerAction(button, closeSteps);
  }
  const setOpen = (value: boolean) => {
    if (disposed || value === open) {
      return;
    }
    if (!value) {
      stepsFrame.hidden = true;
      cardFrame.hidden = false;
    }
    leaveStepsPressView?.();
    leaveStepsPressView = undefined;
    leaveSettingsPressView?.();
    leaveSettingsPressView = undefined;
    open = value;
    modal.hidden = !open;
    if (open) {
      fitSettings();
    }
    openButton.setAttribute("aria-expanded", String(open));
    if (open) {
      previousFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      assertAdaActionBindings(cardFrame);
      leaveSettingsPressView = layer.open(
        {
          backdrop: modal,
          close: () => setOpen(false),
          focus: closeButton,
          isolation: "dialog",
          restore: () => previousFocus,
        },
        cardFrame,
      );
    } else if (previousFocus && document.activeElement !== previousFocus) {
      focusTarget(previousFocus);
    }
    options.onOpenChange(open);
  };
  registerAction(openButton, () => setOpen(true));
  registerAction(closeButton, () => setOpen(false));
  registerAction(dismiss, () => setOpen(false));
  const dispose = () => {
    if (disposed) {
      return;
    }
    setOpen(false);
    disposed = true;
    layer.dispose();
    for (const binding of actionBindings) {
      binding.dispose();
    }
    stopInstallRow();
    window.removeEventListener("resize", fitSettings);
    window.removeEventListener(VIEW_SCALE_EVENT, fitSettings);
    arrangement.dispose();
    settingsCard.dispose();
    stepsParts.dispose();
    root.remove();
  };
  try {
    // Controls installs the live action root and binds contextual Use after this factory returns.
    assertAdaActionMetadata(openButton);
    assertAdaActionMetadata(cardFrame);
    assertAdaActionMetadata(stepsFrame);
    parent.append(root);
  } catch (error) {
    dispose();
    throw error;
  }
  void applyButtonSkin(root).catch(() => undefined);
  return {
    actions,
    card,
    close: () => setOpen(false),
    closeSteps,
    dispose,
    isOpen: () => open,
    joystickTargets,
    open: () => setOpen(true),
    openButton,
    root,
    stepsOpen,
    useButton,
  };
}
