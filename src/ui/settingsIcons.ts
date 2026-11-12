import type { InstallStepsKind } from "../pwa/index.ts";
import type { DeviceSetting } from "./deviceSettings.ts";

// Art's Settings icons (art/settings-icons.md): 16 by 16 single-frame sheets in the UI manifest,
// drawn at their own size as Chibi's rows draw them.

export const SETTING_ICONS: Readonly<Record<DeviceSetting | "install", string>> = {
  aim: "icon-aim-controls",
  install: "icon-install",
  move: "icon-move-controls",
  reducedMotion: "icon-reduced-motion",
  sound: "icon-sound",
};

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

// Shows the sheet's rest frame, its first and only frame, in an icon element.
export function showIcon(icon: HTMLElement, key: string): void {
  icon.dataset.icon = key;
  icon.style.backgroundImage = `url('/art/ui/sprites/${key}.png')`;
}

export function settingsIcon(key: string): HTMLSpanElement {
  const icon = document.createElement("span");
  icon.className = "ada-icon";
  icon.setAttribute("aria-hidden", "true");
  showIcon(icon, key);
  return icon;
}
