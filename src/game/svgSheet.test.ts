import { readFileSync } from "node:fs";

import { afterEach, expect, it, vi } from "vitest";

import { vectorSheetSource } from "./svgSheet.ts";

const svg = "http://www.w3.org/2000/svg";
const path = "/art/enemies/capital-lance-top-sheet.svg";
const id = "enemy-capital-lance-top-0";

function root(children: readonly unknown[]): Document {
  return {
    documentElement: { children, localName: "svg", namespaceURI: svg },
  } as unknown as Document;
}

function frame(attributes: Record<string, string>, memberId = id) {
  const values = { x: "0", y: "0", ...attributes, id: memberId };
  return {
    cloneNode: () => {
      const remaining = new Map(Object.entries(values));
      return { remaining, removeAttribute: (key: string) => remaining.delete(key) };
    },
    getAttribute: (key: string) => (values as Record<string, string>)[key] ?? null,
    id: memberId,
    localName: "svg",
    namespaceURI: svg,
  };
}

const part = { height: 120, id, intrinsicHeight: 52.5, intrinsicWidth: 52.5, width: 120 };
const authored = { height: "52.5", viewBox: "0 0 120 120", width: "52.5" };

afterEach(() => vi.unstubAllGlobals());

function recordExtractedAttributes(): void {
  vi.stubGlobal(
    "XMLSerializer",
    class {
      serializeToString({ remaining }: { remaining: Map<string, string> }): string {
        return JSON.stringify(Object.fromEntries(remaining));
      }
    },
  );
}

it("keeps the authored intrinsic dimensions and raw viewBox of an extracted part", () => {
  recordExtractedAttributes();
  const member = frame(authored);
  const source = vectorSheetSource(root([member]), path, part);
  expect(source.startsWith("data:image/svg+xml;base64,")).toBe(true);
  expect(JSON.parse(atob(source.split(",")[1]!))).toEqual(authored);
  expect(member.getAttribute("id")).toBe(id);
});

it("extracts the exact named sibling while rejecting missing and duplicate alias members", () => {
  recordExtractedAttributes();
  const memberId = "enemy-retaliator-turret-intact-0";
  const alias = { ...part, svgSheetMember: memberId };
  const logical = frame({ ...authored, width: "120" });
  const member = frame(authored, memberId);
  const source = vectorSheetSource(root([logical, member]), path, alias);
  expect(JSON.parse(atob(source.split(",")[1]!))).toEqual(authored);
  expect(member.getAttribute("id")).toBe(memberId);

  const validLogical = frame(authored);
  expect(() => vectorSheetSource(root([validLogical]), path, alias)).toThrow(`Invalid frame ${id}`);
  expect(() => vectorSheetSource(root([member, member]), path, alias)).toThrow(
    `Invalid frame ${id}`,
  );
  expect(() =>
    vectorSheetSource(root([validLogical]), path, { ...part, svgSheetMember: "" }),
  ).toThrow(`Invalid frame ${id}`);
  expect(() =>
    vectorSheetSource(root([frame({ ...authored, viewBox: "0 0 52.5 52.5" }, memberId)]), path, alias),
  ).toThrow(`Invalid frame ${id}`);
});

it.each([
  { height: "120" },
  { viewBox: "0 0 52.5 52.5" },
  { viewBox: "1 0 120 120" },
  { width: "120" },
])("rejects a part that disagrees with its intrinsic or raw dimensions: %j", (changed) => {
  expect(() => vectorSheetSource(root([frame({ ...authored, ...changed })]), path, part)).toThrow(
    `Invalid frame ${id}`,
  );
});

it("retains the raw intrinsic default for an existing hull or rock and rejects duplicate IDs", () => {
  vi.stubGlobal(
    "XMLSerializer",
    class {
      serializeToString = () => "<svg/>";
    },
  );
  const member = frame({ height: "120", viewBox: "0 0 120 120", width: "120" });
  const raw = { height: 120, id, width: 120 };
  expect(vectorSheetSource(root([member]), path, raw)).toBe("data:image/svg+xml;base64,PHN2Zy8+");
  expect(() => vectorSheetSource(root([member, member]), path, raw)).toThrow(`Invalid frame ${id}`);
});

it.each([
  ["/art/enemies/fighter-sheet.svg", "enemy-fighter", 16, 104, 104],
  ["/art/enemies/interceptor-sheet.svg", "enemy-interceptor", 16, 88, 88],
  ["/art/enemies/swarm-sheet.svg", "enemy-swarm", 16, 80, 80],
  ["/art/asteroids/asteroid-m1-sheet.svg", "asteroid-m1", 24, 236, 145],
] as const)("retains every shipped member in %s", (path, prefix, count, width, height) => {
  recordExtractedAttributes();
  const art = readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8");
  const members = Array.from(art.matchAll(/<svg ([^>]*\bid="[^"]+"[^>]*)>/gu), ([, tag]) => {
    const attrs = Object.fromEntries(
      Array.from(tag!.matchAll(/([\w:-]+)="([^"]*)"/gu), ([, key, value]) => [key, value]),
    );
    return frame(attrs, attrs.id);
  });
  const keys = Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
  expect(members.map(({ id }) => id)).toEqual(keys);
  const document = root(members);
  for (const id of keys) {
    const decoded = vectorSheetSource(document, path, { height, id, width });
    expect(JSON.parse(atob(decoded.split(",")[1]!))).toEqual({
      height: String(height),
      viewBox: `0 0 ${width} ${height}`,
      width: String(width),
      xmlns: svg,
    });
  }
});
