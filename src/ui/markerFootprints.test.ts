import { afterEach, describe, expect, it, vi } from "vitest";

import { VIEW_PROPERTIES } from "./layout/css.ts";
import { markerFootprints } from "./markerFootprints.ts";

function fixture() {
  const node = {
    closest: () => null,
    getBoundingClientRect: () => ({ height: 20, left: 150, top: 70, width: 40 }),
    getClientRects: () => [{}],
  };
  const host = { getBoundingClientRect: () => ({ left: 100, top: 50 }) } as HTMLElement;
  const style = {
    display: "block",
    getPropertyValue: (name: string) => (name === VIEW_PROPERTIES.unit ? "2" : "10px"),
    opacity: "1",
    visibility: "visible",
  };
  vi.stubGlobal("getComputedStyle", () => style);
  const doc = { querySelectorAll: () => [node] } as unknown as Document;
  return { doc, host, node, style };
}

afterEach(() => vi.unstubAllGlobals());
describe("actual marker avoidance footprints", () => {
  it("converts only occupied CSS rectangles into logical game-area coordinates", () => {
    const f = fixture();
    expect(markerFootprints(f.doc, f.host)).toEqual([{ height: 10, width: 20, x: 20, y: 10 }]);
    expect(markerFootprints(f.doc, null)).toEqual([]);
  });
  it.each(["hidden", "transparent", "no-layout", "empty"])("omits %s UI", (kind) => {
    const f = fixture();
    if (kind === "hidden") {
      f.style.visibility = "hidden";
    }
    if (kind === "transparent") {
      f.style.opacity = "0";
    }
    if (kind === "no-layout") {
      f.node.getClientRects = () => [];
    }
    if (kind === "empty") {
      f.node.getBoundingClientRect = () => ({ height: 0, left: 0, top: 0, width: 0 });
    }
    expect(markerFootprints(f.doc, f.host)).toEqual([]);
  });
});
