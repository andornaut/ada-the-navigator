import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { bannerOnScreen, createBannerLayer, DISABLED_BANNER_STYLE } from "./disabled-banner.ts";
import { font, fromAreaLeft, units } from "./layout/css.ts";
import { TYPE } from "./layout/tokens.ts";

/** A stand-in element with the fields the layer uses. */
interface FakeElement {
  attributes: Map<string, string>;
  children: FakeElement[];
  className: string;
  parent?: FakeElement;
  style: { left?: string; top?: string };
  textContent: string;
}
const element = (): FakeElement => ({
  attributes: new Map(),
  children: [],
  className: "",
  style: {},
  textContent: "",
});
const fakeDocument = () => {
  const make = () => {
    const node = element();
    return Object.assign(node, {
      append: (child: FakeElement) => {
        child.parent = node;
        node.children.push(child);
      },
      remove: () => {
        node.parent?.children.splice(node.parent.children.indexOf(node), 1);
      },
      setAttribute: (name: string, value: string) => node.attributes.set(name, value),
    });
  };
  return { createElement: make } as unknown as Document;
};

describe("disabled banner", () => {
  it("styles Art's threat-red face 24 high, radius 4, 1 px ink border and 8 px insets", () => {
    const rule = /\.ada-disabled-banner\{([^}]*)\}/u.exec(DISABLED_BANNER_STYLE)![1]!;
    expect(rule).toContain(`height:${units(24)}`);
    // The 1 px border sits inside the face, so the label is 8 px in from the face's edge.
    expect(rule).toContain(`padding:0 ${units(7)}`);
    expect(rule).toContain(`border:${units(1)} solid #181425`);
    expect(rule).toContain(`border-radius:${units(4)}`);
    expect(rule).toContain("background:#FF6B6B");
    expect(rule).toContain("color:#181425");
    expect(rule).toContain(`font:${font(TYPE.label)}`);
    expect(PROTOTYPE.labels.disabledBanner).toBe("Disabled");
  });

  it("shows only while its centre is in the game area", () => {
    expect(bannerOnScreen({ x: 0, y: 0 })).toBe(true);
    expect(bannerOnScreen({ x: 720, y: 360 })).toBe(true);
    expect(bannerOnScreen({ x: -1, y: 100 })).toBe(false);
    expect(bannerOnScreen({ x: 100, y: 361 })).toBe(false);
  });

  it("places one aria-hidden banner per heavy each frame, reusing and removing elements", () => {
    const doc = fakeDocument();
    const parent = doc.createElement("div") as unknown as FakeElement & HTMLElement;
    const layer = createBannerLayer(doc, parent, "Disabled");
    const root = parent.children[0]!;
    expect(root.className).toBe("ada-banners");
    expect(root.attributes.get("aria-hidden")).toBe("true");
    layer.place([
      { at: { x: 100, y: 50 }, id: "a" },
      { at: { x: 900, y: 50 }, id: "b" },
    ]);
    expect(root.children).toHaveLength(1);
    const [banner] = root.children;
    expect(banner).toMatchObject({
      className: "ada-disabled-banner",
      style: { left: fromAreaLeft(100), top: units(50) },
      textContent: "Disabled",
    });
    layer.place([{ at: { x: 120, y: 60 }, id: "a" }]);
    expect(root.children).toEqual([banner]);
    expect(banner!.style).toEqual({ left: fromAreaLeft(120), top: units(60) });
    layer.place([]);
    expect(root.children).toEqual([]);
    layer.destroy();
    expect(parent.children).toEqual([]);
  });
});
