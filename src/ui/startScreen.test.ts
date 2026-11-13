import { afterEach, describe, expect, it, vi } from "vitest";

import { createStartScreen } from "./startScreen.ts";
import type { TitleScreenArt } from "./titleScreen.ts";

vi.mock("./uiSkin.ts", () => ({ applyButtonSkin: vi.fn().mockResolvedValue(undefined) }));

class Element {
  children: Element[] = [];
  attributes = new Map<string, string>();
  className = "";
  classList = {
    add: (...names: string[]) => {
      this.className += ` ${names.join(" ")}`;
    },
  };
  style = {};
  readonly tag: string;
  constructor(tag: string) {
    this.tag = tag;
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  append(...nodes: Element[]): void {
    this.children.push(...nodes);
  }
  prepend(...nodes: Element[]): void {
    this.children.unshift(...nodes);
  }
}

const triangle = {
  alpha: 1,
  color: 0xffffff,
  points: [
    { x: -160, y: 0 },
    { x: -180, y: 20 },
    { x: -160, y: 40 },
  ] as const,
};
const occluders = [
  [
    { x: -150, y: 5 },
    { x: -130, y: 5 },
    { x: -130, y: 30 },
  ],
];
function render(masked: boolean): Element {
  vi.stubGlobal("document", {
    createElement: (tag: string) => new Element(tag),
    createElementNS: (_: string, tag: string) => new Element(tag),
  });
  const art: TitleScreenArt = {
    background: "#292734",
    field: { at: { x: -120, y: 0 }, height: 540, url: "/field.png", width: 960 },
    jets: [
      triangle,
      ...(masked
        ? [
            { ...triangle, occluders },
            { ...triangle, occluders },
          ]
        : []),
    ],
    pivot: { x: 0.5, y: 0.5 },
    ships: new Map([[null, "/ship.png"]]),
    wordmark: { height: 102, url: "/wordmark.svg", width: 270 },
  };
  return createStartScreen(new Element("main") as unknown as HTMLElement, art, {
    actions: [],
    paint: null,
    title: "Ada",
  }).root as unknown as Element;
}
afterEach(() => vi.unstubAllGlobals());

describe("title plume draw layers", () => {
  it("keeps old-data plumes behind the complete ship without an unmasked foreground layer", () => {
    const root = render(false);
    expect(root.children.map(({ tag }) => tag)).toEqual(["div", "svg", "img", "h1", "div"]);
    expect(root.children[1]!.children).toHaveLength(1);
    expect(root.children[1]!.children[0]!.attributes.has("mask")).toBe(false);
  });

  it("reveals only authored depth-masked mouths above the sprite, without duplicating legacy jets", () => {
    const root = render(true);
    const [, behind, ship, front] = root.children;
    expect(ship!.tag).toBe("img");
    expect(behind!.children).toHaveLength(1);
    expect(front!.className).toContain("ada-start-jets-front");
    expect(front!.children.map(({ tag }) => tag)).toEqual(["defs", "polygon", "polygon"]);
    const mask = front!.children[0]!.children[0]!;
    expect(mask.attributes.get("maskUnits")).toBe("userSpaceOnUse");
    expect(Number(mask.attributes.get("x"))).toBeLessThan(0);
    expect(mask.children.map((node) => node.attributes.get("fill"))).toEqual(["white", "black"]);
    expect(mask.children[1]!.attributes.get("points")).toBe("-10,145 10,145 10,170");
    const reference = `url(#${mask.attributes.get("id")})`;
    expect(front!.children.slice(1).map((node) => node.attributes.get("mask"))).toEqual([
      reference,
      reference,
    ]);
    const other = render(true).children[3]!.children[0]!.children[0]!;
    expect(other.attributes.get("id")).not.toBe(mask.attributes.get("id"));
  });
});
