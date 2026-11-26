import { afterEach, expect, it, vi } from "vitest";

import { jetPolygons, type TitleScreenArt } from "./titleScreen.ts";
import { titleShipView } from "./titleShipView.ts";

afterEach(() => vi.unstubAllGlobals());

it("orders the painted hull above front Title plumes, masks the rest and keeps the halo under it", () => {
  class Node {
    readonly attrs = new Map<string, string>();
    children: Node[] = [];
    style = { display: "" };
    readonly classes = new Set<string>();
    classList = { add: (...names: string[]) => names.forEach((n) => this.classes.add(n)) };
    readonly tag: string;
    constructor(tag: string) {
      this.tag = tag;
    }
    setAttribute(key: string, value: string) {
      this.attrs.set(key, value);
    }
    append(...nodes: Node[]) {
      this.children.push(...nodes);
    }
    replaceChildren(...nodes: Node[]) {
      this.children = nodes;
    }
  }
  vi.stubGlobal("document", {
    createElement: (tag: string) => new Node(tag),
    createElementNS: (_ns: string, tag: string) => new Node(tag),
  });
  const base: TitleScreenArt = {
    background: "",
    field: { at: { x: 0, y: 0 }, height: 1, url: "", width: 1 },
    jets: [
      {
        alpha: 1,
        color: 1,
        occluders: [
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
          ],
        ],
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 2 },
          { x: 3, y: 0 },
        ],
        triangles: [
          [
            { x: 0, y: 0 },
            { x: 2, y: 2 },
            { x: 3, y: 0 },
          ],
        ],
      },
      // An under-hull halo draws behind the hull frame, never in front or masked.
      {
        alpha: 1,
        color: 2,
        occluders: [
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
          ],
        ],
        points: [
          { x: 5, y: 5 },
          { x: 6, y: 6 },
          { x: 7, y: 5 },
        ],
        triangles: [
          [
            { x: 5, y: 5 },
            { x: 6, y: 6 },
            { x: 7, y: 5 },
          ],
        ],
        underHull: true,
      },
    ],
    pivot: { x: 0.5, y: 0.5 },
    ships: new Map([
      [null, "classic.svg"],
      ["cobalt", "cobalt.svg"],
    ]),
    wordmark: { height: 1, url: "", width: 1 },
  };
  for (const inFront of [false, true]) {
    const art = { ...base, ...(inFront ? { frontJets: true as const } : {}) };
    const nodes = titleShipView(art, "cobalt") as unknown as Node[];
    const front = nodes[2]!;
    const triangle = front.children.find((n) => n.tag === "polygon")!;
    expect(triangle.attrs.get("points")).toBe(jetPolygons(art)[0]!.points);
    const halo = jetPolygons(art)[1]!;
    expect(halo.underHull).toBe(true);
    // The jets SVG behind, then the hull frame.
    expect(nodes[1]!.tag).toBe("img");
    const back = nodes[0]!.children.filter((n) => n.tag === "polygon");
    expect(back.map((n) => n.attrs.get("points"))).toEqual([halo.points]);
    expect(back[0]!.attrs.has("mask")).toBe(false);
    expect(front.children.some((n) => n.attrs.get("points") === halo.points)).toBe(false);
    if (inFront) {
      expect(triangle.attrs.has("mask")).toBe(false);
      const tail = nodes[3]!;
      expect(tail.classes.has("ada-start-tail")).toBe(true);
      const image = tail.children.find((n) => n.tag === "image")!;
      expect(image.attrs.get("href")).toBe("cobalt.svg");
      expect(image.attrs.has("clip-path")).toBe(true);
      const region = tail.children[0]!.children[0]!.children[0]!;
      expect(region.attrs.get("points")).toBe(jetPolygons(art)[0]!.occluders![0]);
    } else {
      expect(triangle.attrs.get("mask")).toMatch(/^url\(/);
      expect(nodes).toHaveLength(3);
    }
  }
});
