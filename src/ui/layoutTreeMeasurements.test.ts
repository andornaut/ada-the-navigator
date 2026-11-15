import { describe, expect, it } from "vitest";

import { createPhysicalLayoutInspector, measurePhysicalLayout } from "./layoutTreeMeasurements.ts";

const viewport = { height: 360, width: 720, x: 0, y: 0 };
class PhysicalElement {
  children: PhysicalElement[] = [];
  clientHeight = 40;
  clientLeft = 0;
  clientTop = 0;
  clientWidth = 100;
  isConnected = true;
  offsetHeight = 40;
  offsetWidth = 100;
  parentElement: PhysicalElement | null = null;
  scrollHeight = 40;
  scrollWidth = 100;
  lines = [{ height: 20, left: 30, top: 40, width: 90 }];
  css = { display: "block", overflowX: "visible", overflowY: "visible", visibility: "visible" };
  rect = { height: 40, left: 30, top: 40, width: 100 };
  ownerDocument = {
    createRange: () => ({ detach() {}, getClientRects: () => this.lines, selectNodeContents() {} }),
    createTreeWalker: () => {
      let visited = false;
      return {
        nextNode: () => {
          if (visited) {
            return null;
          }
          visited = true;
          return { textContent: "Actual text" };
        },
      };
    },
    defaultView: { getComputedStyle: (node: PhysicalElement) => node.css },
  };
  contains(node: PhysicalElement): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }
  getBoundingClientRect() {
    return this.rect;
  }
  querySelector() {
    return null;
  }
}
function fixture(unit = 1) {
  const host = new PhysicalElement();
  host.rect = { height: 360 * unit, left: 10, top: 20, width: 720 * unit };
  const element = new PhysicalElement();
  element.parentElement = host;
  host.children.push(element);
  element.rect = {
    height: 40 * unit,
    left: 10 + 20 * unit,
    top: 20 + 20 * unit,
    width: 100 * unit,
  };
  element.clientWidth = element.offsetWidth = element.scrollWidth = 100 * unit;
  element.clientHeight = element.offsetHeight = element.scrollHeight = 40 * unit;
  element.lines = [
    { height: 20 * unit, left: element.rect.left, top: element.rect.top, width: 90 * unit },
  ];
  const measure = () =>
    measurePhysicalLayout(
      {
        host: host as unknown as HTMLElement,
        nodes: [{ element: element as unknown as HTMLElement, path: ["card", "body"] }],
        unit,
      },
      { path: ["card", "body"], viewport },
      element as unknown as HTMLElement,
    );
  return { element, host, measure };
}

describe("physical layout diagnostics", () => {
  it.each([1, 1.5, 2])("uses one base-unit coordinate system at scale %s", (unit) => {
    const f = fixture(unit);
    const result = f.measure()!;
    expect(result.available).toEqual({ height: 40, width: 100, x: 20, y: 20 });
    expect(result.required).toEqual(result.available);
    expect(result.wrappedLines).toEqual([{ height: 20, width: 90, x: 20, y: 20 }]);
    expect(result.clipped).toBe(false);
  });
  it("does not manufacture overflow from rounded scroll dimensions", () => {
    const f = fixture();
    f.element.rect.width = 99.8;
    f.element.clientWidth = 99;
    expect(f.measure()!.required.width).toBe(99.8);
    expect(f.measure()!.available.width).toBe(99.8);
  });

  it("retains real subpixel text overflow even when scroll sizes round to the same integer", () => {
    const f = fixture();
    f.element.lines[0]!.width = 100.25;
    expect(f.measure()!.required.width).toBe(100.25);
    f.element.css.overflowX = "hidden";
    expect(f.measure()!.clipped).toBe(true);
  });

  it("reports required scroll content while distinguishing visible overflow from clipping", () => {
    const f = fixture();
    f.element.scrollHeight = 100;
    expect(f.measure()).toMatchObject({ clipped: false, required: { height: 100 } });
    f.element.css.overflowY = "auto";
    expect(f.measure()).toMatchObject({ clipped: true, required: { height: 100 } });
  });
  it("reports ancestor clipping without hiding the required extent", () => {
    const f = fixture();
    f.host.css.overflowY = "hidden";
    f.host.rect.height = 50;
    f.host.offsetHeight = f.host.clientHeight = 50;
    expect(f.measure()).toMatchObject({
      available: { height: 30 },
      clipped: true,
      required: { height: 40 },
    });
  });
  it("returns null for disconnected, hidden, zero-size or invalid-scale evidence", () => {
    const f = fixture();
    f.element.isConnected = false;
    expect(f.measure()).toBeNull();
    f.element.isConnected = true;
    f.element.css.display = "none";
    expect(f.measure()).toBeNull();
    f.element.css.display = "block";
    f.element.rect.width = 0;
    expect(f.measure()).toBeNull();
    expect(fixture(0).measure()).toBeNull();
  });
  it("collects one keyed snapshot and drops removed nodes on the next inspection", () => {
    const f = fixture();
    const inspector = createPhysicalLayoutInspector(() => 1, f.host as unknown as HTMLElement);
    let show = true;
    const mounted = {
      inspect: () => {
        if (show) {
          inspector.measure(
            { path: ["card", "body"], viewport },
            f.element as unknown as HTMLElement,
          );
        }
        return { diagnostics: [], status: "unavailable" as const };
      },
    };
    const first = inspector.inspect(viewport, mounted);
    expect(first.report.status).toBe("fit");
    expect(first.observations.map(({ path }) => path)).toEqual([["card", "body"]]);
    show = false;
    expect(inspector.inspect(viewport, mounted)).toEqual({
      observations: [],
      report: { diagnostics: [], status: "unavailable" },
    });
    inspector.dispose();
  });
});
