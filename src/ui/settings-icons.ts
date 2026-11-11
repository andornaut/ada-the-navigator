import type { DeviceSetting } from "./device-settings.ts";

// Art's Settings icons (art/settings-icons.md): 16 by 16 single-frame sheets in the UI manifest,
// drawn at 1.5 times so their 2-pixel strokes stay whole.
export const SETTINGS_ICON_SIZE = 24;

export const SETTING_ICONS: Readonly<Record<DeviceSetting | "install", string>> = {
  aim: "icon-aim-controls",
  install: "icon-install",
  move: "icon-move-controls",
  reducedMotion: "icon-reduced-motion",
  sound: "icon-sound",
};

// The glyph of the button each browser's install steps start from, as in Chibi; the second step
// shows SETTING_ICONS.install.
export const STEPS_GLYPHS: Readonly<Record<"firefoxAndroid" | "ios", string>> = {
  firefoxAndroid: "icon-browser-menu",
  ios: "icon-ios-share",
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
