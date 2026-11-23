import { writeFileSync } from "node:fs";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import { ENEMY_HEADINGS } from "./projection.ts";

type ManifestRow = { id: string; path?: unknown; svgSheet?: unknown };
type HullEntry = {
  id: string;
  path: string;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
};

/** Publish the authored roots loose unless this hull has a complete sheet selection. */
export function writeStoryHull<T extends HullEntry>(
  installed: readonly ManifestRow[],
  output: string,
  name: string,
  frames: readonly { entry: T; root: string }[],
) {
  const ids = new Set(frames.map(({ entry }) => entry.id));
  const current = installed.filter(({ id }) => ids.has(id));
  if (!current.some(({ svgSheet }) => svgSheet === true)) {
    for (const [yaw, { root }] of frames.entries()) {
      writeFileSync(`${output}${name}-${yaw}.svg`, root);
    }
    return frames.map(({ entry }) => entry);
  }

  const file = `${name}-sheet.svg`;
  const first = frames[0]!.entry;
  const path = first.path.slice(0, first.path.lastIndexOf("/") + 1) + file;
  if (
    frames.length !== ENEMY_HEADINGS ||
    current.length !== frames.length ||
    new Set(current.map(({ id }) => id)).size !== current.length ||
    current.some((row) => row.svgSheet !== true || row.path !== path)
  ) {
    throw new Error(`Incomplete story hull sheet selection: ${name}`);
  }

  const size = first.width;
  const wide = size * 4;
  const layout = packAtlas({ compare: () => 0, extrude: 0, maxSize: wide, widths: [wide] }, [
    { rectangles: frames.map(() => ({ width: size, height: size })), value: name },
  ])?.pages[0];
  const slots = layout?.placed[0]?.at;
  if (!layout || slots?.length !== ENEMY_HEADINGS) {
    throw new Error(`Cannot pack story hull sheet: ${name}`);
  }
  const children = frames.map(({ entry, root }, yaw) => {
    const svg = root.trimEnd();
    const header = `<svg xmlns="http://www.w3.org/2000/svg" width="${entry.displayWidth}" height="${entry.displayHeight}" viewBox="0 0 ${size} ${size}">`;
    if (
      entry.id !== `craft-${name}-${yaw}` ||
      entry.width !== size ||
      entry.height !== size ||
      !svg.startsWith(header) ||
      !svg.endsWith("</svg>")
    ) {
      throw new Error(`Invalid story hull root: ${entry.id}`);
    }
    const { x, y } = slots[yaw]!;
    return `<svg id="${entry.id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
  });
  writeFileSync(
    output + file,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${layout.height}" viewBox="0 0 ${wide} ${layout.height}">${children.join("")}</svg>\n`,
  );
  return frames.map(({ entry }) => ({ ...entry, path, svgSheet: true as const }));
}
