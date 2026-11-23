// Build dormant SVG view sheets from the static UI icon sources.
// Usage: node art/tools/ui-icon-sheets.ts --out <scratch directory>
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import { hasUiIcon, jobsAndProjects, readUiIcon, staticIcons } from "./ui-icon-sources.ts";

const namespace = "http://www.w3.org/2000/svg";
const maxEdge = 2048;

function icon(id: string) {
  const input = readUiIcon(id);
  const match = input.trim().match(/^<svg\s+([^>]+)>([\s\S]+)<\/svg>$/u);
  const attributes = new Map(
    [...(match?.[1] ?? "").matchAll(/([\w:-]+)="([^"]*)"/gu)].map(([, key, value]) => [key, value]),
  );
  const width = Number(attributes.get("width"));
  const height = Number(attributes.get("height"));
  const viewBox = attributes.get("viewBox");
  const raw = viewBox?.match(/^0 0 ([\d.]+) ([\d.]+)$/u);
  const rawWidth = Number(raw?.[1]);
  const rawHeight = Number(raw?.[2]);
  const content = match?.[2];
  if (
    attributes.size !== 5 ||
    attributes.get("xmlns") !== namespace ||
    attributes.get("aria-hidden") !== "true" ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    ![width, height, rawWidth, rawHeight].every((value) => value > 0 && value <= maxEdge) ||
    !content ||
    /<(?!\/?(?:g|path|rect|circle|ellipse|line|polyline|polygon|defs|clipPath|title)\b)|\b(?:href|style|on\w+)\s*=/u.test(
      content,
    )
  ) {
    throw new Error(`Unsupported static SVG glyph: ${id}`);
  }

  const ids = [...content.matchAll(/\bid="([\w-]+)"/gu)].map(([, key]) => key!);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate SVG IDs: ${id}`);
  const local = (key: string) => `local-${id}--${key}`;
  const isolated = content
    .replace(/\bid="([\w-]+)"/gu, (_, key: string) => `id="${local(key)}"`)
    .replace(/url\(([^)]+)\)/gu, (_, ref: string) => {
      if (!ref.startsWith("#") || !ids.includes(ref.slice(1))) {
        throw new Error(`Unsupported SVG reference in ${id}: ${ref}`);
      }
      return `url(#${local(ref.slice(1))})`;
    });
  return { id, width, height, viewBox, rawWidth, rawHeight, isolated };
}

function exportSheets(output: string) {
  const present = jobsAndProjects.filter(hasUiIcon);
  if (present.length && present.length !== jobsAndProjects.length) {
    throw new Error("The Jobs and Projects SVG source set must be complete");
  }
  const groups = new Map<string, ReturnType<typeof icon>[]>();
  for (const id of [...staticIcons, ...present]) {
    const glyph = icon(id);
    const key = `${glyph.width}x${glyph.height}`;
    const members = groups.get(key) ?? [];
    members.push(glyph);
    groups.set(key, members);
  }

  const mapping = [];
  const sheets = new Map<string, string>();
  for (const [key, members] of groups) {
    // A single physical document owns one intrinsic image size. The view selects only its raw cell.
    const file = `icons-${key}.svg`;
    const first = members[0]!;
    const cellWidth = Math.ceil(first.rawWidth) + 2;
    const cellHeight = Math.ceil(first.rawHeight) + 2;
    const width = Math.ceil(Math.sqrt(members.length)) * cellWidth;
    const page = packAtlas({ compare: () => 0, extrude: 0, maxSize: maxEdge, widths: [width] }, [
      { value: file, rectangles: members.map(() => ({ width: cellWidth, height: cellHeight })) },
    ])?.pages[0];
    if (!page || page.placed[0]?.at.length !== members.length) {
      throw new Error(`Cannot pack static UI sheet: ${file}`);
    }
    const views = [];
    const cells = [];
    for (const [index, glyph] of members.entries()) {
      if (glyph.rawWidth !== first.rawWidth || glyph.rawHeight !== first.rawHeight) {
        throw new Error(`Different raw view size in ${file}: ${glyph.id}`);
      }
      const position = page.placed[0]!.at[index]!;
      const x = position.x + 1;
      const y = position.y + 1;
      const { id, rawWidth, rawHeight, viewBox, isolated } = glyph;
      views.push(`<view id="${id}" viewBox="${x} ${y} ${rawWidth} ${rawHeight}"/>`);
      cells.push(
        `<svg x="${x}" y="${y}" width="${rawWidth}" height="${rawHeight}" viewBox="${viewBox}" overflow="hidden">${isolated}</svg>`,
      );
      mapping.push({
        id,
        original: `/art/ui/icons/${id}.svg`,
        sheet: file,
        fragment: id,
        width: glyph.width,
        height: glyph.height,
        viewBox,
        cell: [x, y, rawWidth, rawHeight],
      });
    }
    sheets.set(
      file,
      `<svg xmlns="${namespace}" width="${first.width}" height="${first.height}" viewBox="0 0 ${width} ${page.height}" aria-hidden="true">${views.join("")}${cells.join("")}</svg>\n`,
    );
  }

  mkdirSync(output, { recursive: true });
  for (const [file, svg] of sheets) writeFileSync(resolve(output, file), svg);
  console.log(JSON.stringify(mapping, null, 2));
}

const [flag, output, ...other] = process.argv.slice(2);
if (flag !== "--out" || !output || other.length) {
  throw new Error("Usage: node art/tools/ui-icon-sheets.ts --out <scratch directory>");
}
exportSheets(resolve(output));
