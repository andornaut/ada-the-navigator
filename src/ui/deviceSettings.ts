// The settings a player keeps on this device, each under its own localStorage key:
// - move and aim: whether each on-screen joystick is drawn (Chibi's Move controls). Each is shown
//   unless the player hides it; hiding one hides only its drawing and its input still works.
// - sound: whether sound effects play (Archie's Sound switch), on unless the player mutes it.
// - reducedMotion: whether screen shakes are skipped (Archie's Reduced motion switch). A player's
//   first setting on a device follows the device's reduced-motion preference.
export type DeviceSetting = "aim" | "move" | "reducedMotion" | "sound";

export type DeviceSettings = Readonly<Record<DeviceSetting, boolean>>;

export type ControlSide = "aim" | "move";

export type ControlVisibility = Readonly<Record<ControlSide, boolean>>;

export const DEVICE_SETTINGS: readonly DeviceSetting[] = ["move", "aim", "sound", "reducedMotion"];

export const DEVICE_STORAGE_KEYS: Readonly<Record<DeviceSetting, string>> = {
  aim: "ada-the-navigator.aim-controls",
  move: "ada-the-navigator.move-controls",
  reducedMotion: "ada-the-navigator.reduced-motion",
  sound: "ada-the-navigator.sound",
};
const OFF = "off";
const ON = "on";

type DeviceStorage = Pick<Storage, "getItem" | "setItem">;

// A stored setting: on or off as stored, or undefined when nothing usable is stored.
export function decodeSetting(stored: string | null): boolean | undefined {
  return stored === ON ? true : stored === OFF ? false : undefined;
}

export function encodeSetting(on: boolean): string {
  return on ? ON : OFF;
}

// The page's storage, or undefined where the browser blocks site data and the accessor throws.
export function pageStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

// Whether the device asks for reduced motion.
export function prefersReducedMotion(host: Pick<Window, "matchMedia"> | undefined): boolean {
  try {
    return host?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

function read(storage: DeviceStorage | undefined, setting: DeviceSetting): boolean | undefined {
  try {
    return decodeSetting(storage?.getItem(DEVICE_STORAGE_KEYS[setting]) ?? null);
  } catch {
    return undefined;
  }
}

// Writing throws where the browser blocks site data; the setting then lasts only for this page.
export function writeSetting(
  storage: DeviceStorage | undefined,
  setting: DeviceSetting,
  on: boolean,
): void {
  try {
    storage?.setItem(DEVICE_STORAGE_KEYS[setting], encodeSetting(on));
  } catch {
    // Kept for this page only.
  }
}

// The device's settings: each stored value, or else its default. A first reduced-motion
// setting is taken from reducedMotionDefault and stored, so it stays the player's from then on.
export function readDeviceSettings(
  storage: DeviceStorage | undefined,
  reducedMotionDefault: boolean,
): DeviceSettings {
  let reducedMotion = read(storage, "reducedMotion");
  if (reducedMotion === undefined) {
    reducedMotion = reducedMotionDefault;
    writeSetting(storage, "reducedMotion", reducedMotion);
  }
  return {
    aim: read(storage, "aim") ?? true,
    move: read(storage, "move") ?? true,
    reducedMotion,
    sound: read(storage, "sound") ?? true,
  };
}

// Damage shakes the screen only while motion is not reduced.
export function screenShakes(settings: Pick<DeviceSettings, "reducedMotion">): boolean {
  return !settings.reducedMotion;
}
