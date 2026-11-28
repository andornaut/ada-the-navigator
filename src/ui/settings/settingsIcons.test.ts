import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { uiIconUrl } from "../../data/uiIconUrl.ts";
import { units } from "../layout/css.ts";
import { SETTING_ICON_INK_TOP, SETTING_ICONS, showIcon, STEPS_GLYPHS } from "./settingsIcons.ts";

describe("install steps glyphs", () => {
  it("start from Share on Apple devices, the browser's menu elsewhere, none in desktop Firefox", () => {
    expect(STEPS_GLYPHS).toEqual({
      chromiumAndroid: "icon-browser-menu",
      chromiumDesktop: "icon-browser-menu",
      firefoxAndroid: "icon-browser-menu",
      firefoxDesktop: undefined,
      ios: "icon-ios-share",
      other: "icon-browser-menu",
      safariMac: "icon-ios-share",
      samsungInternet: "icon-browser-menu",
    });
  });
});

describe("Settings icons", () => {
  const keys = new Set([
    ...Object.values(SETTING_ICONS),
    ...Object.values(STEPS_GLYPHS).filter((key) => key !== undefined),
    "icon-fps-counter",
  ]);

  it.each([...keys])("draws the approved %s vector in the existing 16-pixel frame", (key) => {
    const svg = readFileSync(new URL(`../../../public${uiIconUrl(key)}`, import.meta.url), "utf8");
    expect(svg).toMatch(/<svg\b[^>]*\bwidth="16"[^>]*\bheight="16"/u);
    const icon = { dataset: {}, style: { setProperty: vi.fn() } };
    showIcon(icon as unknown as HTMLElement, key);
    expect(icon).toMatchObject({
      dataset: { icon: key },
      style: { backgroundImage: `url('${uiIconUrl(key)}')`, imageRendering: "auto" },
    });
    expect(icon.style.setProperty).toHaveBeenCalledWith(
      "--setting-icon-ink-top",
      units(SETTING_ICON_INK_TOP.get(key) ?? 0),
    );
  });

  it("clears the row's ink offset when the Install slot is reused for a browser glyph", () => {
    const icon = { dataset: {}, style: { setProperty: vi.fn() } };
    showIcon(icon as unknown as HTMLElement, SETTING_ICONS.install);
    showIcon(icon as unknown as HTMLElement, STEPS_GLYPHS.ios!);
    expect(icon).toMatchObject({
      dataset: { icon: "icon-ios-share" },
      style: { backgroundImage: `url('${uiIconUrl("icon-ios-share")}')` },
    });
    expect(icon.style.setProperty).toHaveBeenLastCalledWith("--setting-icon-ink-top", "0px");
  });
});
