import { uiIconUrl } from "../data/uiIconUrl.ts";
import type { InstallStepsKind } from "../pwa/index.ts";
import { units } from "./layout/css.ts";
import type { SettingsSwitch } from "./settingsTree.ts";

// Art's Settings icons use 16 by 16 frames, drawn at their own size in each row.

export const SETTING_ICONS: Readonly<Record<SettingsSwitch | "install", string>> = {
  aim: "icon-aim-controls",
  fpsCounter: "icon-fps-counter",
  install: "icon-install",
  move: "icon-move-controls",
  reducedMotion: "icon-reduced-motion",
  sound: "icon-sound",
};

// The top of each approved vector's stroke, in its logical 16-pixel frame. The settings
// and FPS rows align this ink edge to their existing label ink position.
export const SETTING_ICON_INK_TOP: ReadonlyMap<string, number> = new Map([
  [SETTING_ICONS.aim, 0.84],
  [SETTING_ICONS.install, 0.84],
  [SETTING_ICONS.move, 0.84],
  [SETTING_ICONS.reducedMotion, 2.44],
  [SETTING_ICONS.sound, 2.04],
  [SETTING_ICONS.fpsCounter, 1.64],
]);

// The glyph of the button each browser's install steps start from, as in Chibi: Share on Apple
// devices, the browser's menu elsewhere, and none for Firefox on a computer, whose steps send the
// player to another browser. The second step shows SETTING_ICONS.install.
export const STEPS_GLYPHS: Readonly<Record<InstallStepsKind, string | undefined>> = {
  chromiumAndroid: "icon-browser-menu",
  chromiumDesktop: "icon-browser-menu",
  firefoxAndroid: "icon-browser-menu",
  firefoxDesktop: undefined,
  ios: "icon-ios-share",
  other: "icon-browser-menu",
  safariMac: "icon-ios-share",
  samsungInternet: "icon-browser-menu",
};

// Shows the approved vector in the existing decorative icon element.
export function showIcon(icon: HTMLElement, key: string): void {
  icon.dataset.icon = key;
  icon.style.setProperty("--setting-icon-ink-top", units(SETTING_ICON_INK_TOP.get(key) ?? 0));
  icon.style.backgroundImage = `url('${uiIconUrl(key)}')`;
  icon.style.imageRendering = "auto";
}

export function settingsIcon(key: string): HTMLSpanElement {
  const icon = document.createElement("span");
  icon.className = "ada-icon";
  icon.setAttribute("aria-hidden", "true");
  showIcon(icon, key);
  return icon;
}
