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
    getPropertyValue: (name: string) =>
      name === VIEW_PROPERTIES.unit ? "2" : name === VIEW_PROPERTIES.areaTop ? "4px" : "10px",
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
    // Less the game area's 10 CSS px left band and 4 CSS px top band, at 2 CSS px per logical px.
    expect(markerFootprints(f.doc, f.host)).toEqual([{ height: 10, width: 20, x: 20, y: 8 }]);
    expect(markerFootprints(f.doc, null)).toEqual([]);
  });
  it("measures in the turned frame's axes, which the page's boxes swap", () => {
    const f = fixture();
    f.node.getBoundingClientRect = () => ({ height: 40, left: 300, top: 200, width: 20 });
    const root = { getAttribute: (name: string) => (name === "data-frame-turn" ? "90" : null) };
    const host = {
      getBoundingClientRect: () => ({ height: 744, left: 0, top: 121, width: 396 }),
      ownerDocument: { documentElement: root },
    } as unknown as HTMLElement;
    // Frame x runs down the page from the host's top, frame y leftward from its right edge.
    expect(markerFootprints(f.doc, host)).toEqual([{ height: 10, width: 20, x: 34.5, y: 36 }]);
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
