// Build review sheets from the canonical standalone frames, in swim loop order.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import { readManifest } from "./manifest.ts";

interface Size {
  height: number;
  width: number;
}

interface Heading {
  display: Size;
  frame: Size;
  index: number;
}

interface WhaleModel {
  headings: Heading[];
  kind: string;
  loop: { frames: number };
}

interface Frame extends Size {
  directionIndex: number;
  displayHeight: number;
  displayWidth: number;
  id: string;
  kind: string;
  loopFrame: number;
  path: string;
  svgSheet?: boolean;
}

const namespace = "http://www.w3.org/2000/svg";
const publicRoot = new URL("../../public/", import.meta.url);
const review = new URL("../review/whale-sheets/", import.meta.url);
// Keep the original intrinsic viewport and model viewBox on each direct root.
export function packWhaleHeading(
  group: string,
  display: Size,
  frame: Size,
  sources: readonly string[],
) {
  const { height, width } = display;
  const wide = width * 4;
  const layout = packAtlas(
    { compare: () => 0, extrude: 0, maxSize: Math.max(wide, height * 2), widths: [wide] },
    [{ rectangles: sources.map(() => display), value: group }],
  )?.pages[0];
  if (sources.length !== 8 || !layout || layout.height !== height * 2) {
    throw new Error(`Incomplete whale sheet: ${group}`);
  }

  const root = `<svg xmlns="${namespace}" width="${width}" height="${height}" viewBox="0 0 ${frame.width} ${frame.height}">`;
  const nested = sources.map((source, i) => {
    const id = `whale-${group}-${i}`;
    if (!source.startsWith(root) || !source.endsWith("</svg>")) {
      throw new Error(`Unexpected standalone whale root: ${id}`);
    }
    const { x, y } = layout.placed[0]!.at[i]!;
    return `<svg id="${id}" x="${x}" y="${y}" ${source.slice("<svg ".length)}`;
  });
  return `<svg xmlns="${namespace}" width="${wide}" height="${layout.height}" viewBox="0 0 ${wide} ${layout.height}">${nested.join("\n")}</svg>`;
}

function standaloneRoots(group: string, { height, width }: Size, rows: Frame[]): string[] {
  return rows.map((row, i) => {
    const name = `${group}-${i}`;
    const id = `whale-${name}`;
    const path = `/art/whales/${name}.svg`;
    if (
      row.id !== id ||
      row.path !== path ||
      row.svgSheet !== undefined ||
      row.loopFrame !== i ||
      row.width !== width ||
      row.height !== height ||
      row.displayWidth !== width ||
      row.displayHeight !== height
    ) {
      throw new Error(`Unexpected standalone whale row: ${id}`);
    }
    return readFileSync(new URL(path.slice(1), publicRoot), "utf8");
  });
}

function writeReviewSheets() {
  const { kinds } = JSON.parse(readFileSync(new URL("art/whales.json", publicRoot), "utf8")) as {
    kinds: WhaleModel[];
  };
  const sheets = new Map<string, string>();
  for (const [owner, names] of [
    ["core", ["whale", "adult"]],
    ["whirlpool", ["calf", "youngCalf"]],
  ] as const) {
    const rows = (readManifest(owner).assets as Frame[]).filter(({ id }) =>
      /^whale-(?:whale|adult|calf|youngCalf)-\d+-\d+$/.test(id),
    );
    if (rows.length !== 256) throw new Error(`Expected 256 whale frames in ${owner}`);
    const first = sheets.size;
    for (const name of names) {
      const model = kinds.find(({ kind }) => kind === name);
      if (model?.headings.length !== 16 || model.loop.frames !== 8)
        throw new Error(`Expected 16 headings for ${name}`);
      for (const heading of model.headings) {
        const rowsForHeading = rows.filter(
          ({ kind, directionIndex }) => kind === name && directionIndex === heading.index,
        );
        const group = `${name}-${heading.index}`;
        const sources = standaloneRoots(group, heading.display, rowsForHeading);
        sheets.set(
          `${group}-sheet.svg`,
          packWhaleHeading(group, heading.display, heading.frame, sources),
        );
      }
    }
    if (sheets.size - first !== 32) throw new Error(`Expected 32 whale sheets for ${owner}`);
  }

  mkdirSync(review, { recursive: true });
  for (const [name, sheet] of sheets) writeFileSync(new URL(name, review), sheet);
}

if (import.meta.main) writeReviewSheets();
