import { afterEach, describe, expect, it, vi } from "vitest";

import { VIEW_PROPERTIES, viewStyle } from "./css.ts";
import { fitRegion, mapQuestsRect } from "./mapScreen.ts";
import { controlsBottom, hudRect, NO_INSETS, SAFE_MARGIN, safeRect } from "./playView.ts";
import { stickTargets, useDiscLayout } from "./touchControls.ts";
import {
  createViewScaleBridge,
  playLayout,
  VIEW_SCALE_EVENT,
  viewProperties,
} from "./viewScale.ts";

afterEach(() => vi.unstubAllGlobals());

describe("full-viewport layout policy", () => {
  it.each([
    { height: 390, width: 844 },
    { height: 844, width: 390 },
    { height: 360, width: 720 },
    { height: 720, width: 1280 },
    { height: 1080, width: 1920 },
  ])("keeps all anchors independent of asymmetric hardware insets at %o", (size) => {
    const window = new EventTarget();
    vi.stubGlobal("window", window);
    const computedStyle = vi.fn(() => ({
      paddingBottom: "34px",
      paddingLeft: "59px",
      paddingRight: "7px",
      paddingTop: "47px",
    }));
    vi.stubGlobal("getComputedStyle", computedStyle);
    const probe = vi.fn(() => {
      throw new Error("Hardware insets must not be measured");
    });
    vi.stubGlobal("document", { createElement: probe });
    const properties = new Map<string, string>();
    const host = {
      style: { setProperty: (name: string, value: string) => properties.set(name, value) },
    } as unknown as HTMLElement;
    const bridge = createViewScaleBridge(host, size);
    const layout = bridge.update();
    expect(layout).toEqual(playLayout(size));
    expect(layout.cssInsets).toEqual(NO_INSETS);
    expect(layout.insets).toEqual(NO_INSETS);
    expect(computedStyle).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
    for (const side of ["top", "right", "bottom", "left"] as const) {
      expect(properties.get(VIEW_PROPERTIES.safe(side))).toBe("0px");
    }
    const page = safeRect(layout.insets, SAFE_MARGIN.page, layout.view);
    expect(page.x + page.width / 2).toBeCloseTo(layout.view.width / 2, 10);
    expect(page.y + page.height / 2).toBeCloseTo(layout.view.height / 2, 10);
    expect(page.x).toBe(SAFE_MARGIN.page);
    expect(page.y).toBe(SAFE_MARGIN.page);
    expect(hudRect(layout.insets, layout.view)).toEqual(hudRect(NO_INSETS, layout.view));
    expect(controlsBottom(layout.insets, layout.view)).toBe(controlsBottom(NO_INSETS, layout.view));
    expect(stickTargets(layout.view, layout.insets)).toEqual(stickTargets(layout.view, NO_INSETS));
    expect(useDiscLayout(layout.view, layout.insets)).toEqual(
      useDiscLayout(layout.view, NO_INSETS),
    );
    expect(fitRegion(layout.insets, layout.view)).toEqual(fitRegion(NO_INSETS, layout.view));
    expect(mapQuestsRect(layout.insets, layout.view)).toEqual(
      mapQuestsRect(NO_INSETS, layout.view),
    );
    bridge.dispose();
  });

  it("recalculates scale and orientation once per changed geometry and retains the last valid size", () => {
    const window = new EventTarget();
    vi.stubGlobal("window", window);
    const changed = vi.fn();
    window.addEventListener(VIEW_SCALE_EVENT, changed);
    const setProperty = vi.fn();
    const size = { height: 390, width: 844 };
    const bridge = createViewScaleBridge(
      { style: { setProperty } } as unknown as HTMLElement,
      size,
    );
    const landscape = bridge.update();
    expect(changed).toHaveBeenCalledTimes(1);
    bridge.update();
    expect(changed).toHaveBeenCalledTimes(1);
    Object.assign(size, { height: 844, width: 390 });
    const portrait = bridge.update();
    expect(portrait.s).not.toBe(landscape.s);
    expect(Object.fromEntries(viewProperties(portrait))[VIEW_PROPERTIES.unit]).toBe(
      String(portrait.s),
    );
    expect(changed).toHaveBeenCalledTimes(2);
    Object.assign(size, { height: 0, width: 0 });
    expect(bridge.update()).toBe(portrait);
    expect(changed).toHaveBeenCalledTimes(2);
    bridge.dispose();
    bridge.dispose();
  });

  it("publishes the same zero-inset policy on the page frame and overlay before measuring", () => {
    const css = viewStyle([1, 2, 4]);
    expect(css).toContain("html:root,\nhtml:root[data-frame-turn]");
    for (const side of ["top", "right", "bottom", "left"] as const) {
      expect(css).toContain(`--inset-${side}:0px;`);
      expect(css).toContain(`${VIEW_PROPERTIES.safe(side)}:0px;`);
    }
    expect(css).not.toContain("ada-safe-probe");
  });
});
