import { describe, expect, it } from "vitest";

import {
  decodeSetting,
  DEVICE_SETTINGS,
  DEVICE_STORAGE_KEYS,
  encodeSetting,
  prefersReducedMotion,
  readDeviceSettings,
  screenShakes,
  writeSetting,
} from "./deviceSettings.ts";

function memory(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}
const blocked = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("device settings", () => {
  it.each([true, false])("reads back %s as stored", (on) => {
    expect(decodeSetting(encodeSetting(on))).toBe(on);
  });

  it.each([null, "", "unknown"])("reads %j as unset", (stored) => {
    expect(decodeSetting(stored)).toBeUndefined();
  });

  it("shows both joysticks and plays sound by default", () => {
    expect(readDeviceSettings(memory(), false)).toEqual({
      aim: true,
      move: true,
      reducedMotion: false,
      sound: true,
    });
  });

  it("takes a first reduced-motion setting from the device and keeps it", () => {
    const storage = memory();
    expect(readDeviceSettings(storage, true).reducedMotion).toBe(true);
    expect(storage.getItem(DEVICE_STORAGE_KEYS.reducedMotion)).toBe("on");
    expect(readDeviceSettings(storage, false).reducedMotion).toBe(true);
    writeSetting(storage, "reducedMotion", false);
    expect(readDeviceSettings(storage, true).reducedMotion).toBe(false);
  });

  it("reads the device's prefers-reduced-motion query", () => {
    const host = (matches: boolean) => ({
      matchMedia: (query: string) => ({ matches: matches && query.includes("reduce") }),
    });
    expect(prefersReducedMotion(host(true) as unknown as Window)).toBe(true);
    expect(prefersReducedMotion(host(false) as unknown as Window)).toBe(false);
    expect(prefersReducedMotion(undefined)).toBe(false);
  });

  it.each(DEVICE_SETTINGS)("persists %s on and off under its own key", (setting) => {
    const storage = memory();
    for (const on of [false, true, false]) {
      writeSetting(storage, setting, on);
      expect(readDeviceSettings(storage, !on)[setting]).toBe(on);
    }
    const others = DEVICE_SETTINGS.filter((other) => other !== setting);
    for (const other of others) {
      if (other !== "reducedMotion") {
        expect(storage.getItem(DEVICE_STORAGE_KEYS[other])).toBeNull();
      }
    }
  });

  it("uses the defaults and keeps playing where storage is missing or throws", () => {
    const defaults = { aim: true, move: true, reducedMotion: true, sound: true };
    expect(readDeviceSettings(undefined, true)).toEqual(defaults);
    expect(readDeviceSettings(blocked, true)).toEqual(defaults);
    expect(() => writeSetting(blocked, "sound", false)).not.toThrow();
    expect(() => writeSetting(undefined, "sound", false)).not.toThrow();
  });

  it("shakes the screen only while motion is not reduced", () => {
    expect(screenShakes({ reducedMotion: false })).toBe(true);
    expect(screenShakes({ reducedMotion: true })).toBe(false);
  });
});
