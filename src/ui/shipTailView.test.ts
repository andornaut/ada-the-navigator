import { afterEach, expect, it, vi } from "vitest";

import { jetPolygons, type TitleScreenArt } from "./titleScreen.ts";
import { titleShipView } from "./titleShipView.ts";

afterEach(() => vi.unstubAllGlobals());

it("orders the painted hull above front Title plumes and masks plumes that are not in front", () => {
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
