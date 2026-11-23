import { writeFileSync } from "node:fs";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import { type ManifestFile, readManifest } from "./manifest.ts";

type StationFrame<T> = { entry: T; root: string };
type FrameEntry = {
  id: string;
  path: string;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
};
type Selector = { id: string; path?: unknown; svgSheet?: unknown };

// These destination emitters author their SVG roots at display size.
export function withStationDisplayIntrinsics<T extends FrameEntry>(entry: T): T {
  const { width, height, displayWidth, displayHeight } = entry;
  if (
    !("svgSheet" in entry) ||
    entry.svgSheet !== true ||
    (width === displayWidth && height === displayHeight)
  ) {
    return entry;
  }
  return { ...entry, intrinsicWidth: displayWidth, intrinsicHeight: displayHeight };
}

export function writeStationFrames<T extends FrameEntry>(
  family: ManifestFile,
  output: string,
  directory: string,
  columns: number,
  frames: readonly StationFrame<T>[],
): readonly T[] {
  const sheet = "station-sheet.svg";
  const path = directory + sheet;
  const ids = frames.map(({ entry }) => entry.id);
  const installed: Selector[] = readManifest(family).assets;
  const rows = installed.filter((row) => ids.includes(row.id) || row.path === path);
  if (!rows.some((row) => row.svgSheet === true || row.path === path)) {
    for (const { entry, root } of frames) {
      writeFileSync(output + entry.path.slice(directory.length), root);
    }
    return frames.map(({ entry }) => entry);
  }
  if (
    rows.length !== frames.length ||
    rows.some((row, index) => row.id !== ids[index] || row.path !== path || row.svgSheet !== true)
  ) {
    throw new Error(`Invalid ${family} primary station sheet selection`);
  }

  const { width, height } = frames[0]!.entry;
  const wide = columns * width;
  const tall = Math.ceil(frames.length / columns) * height;
  const page = packAtlas(
    { compare: () => 0, extrude: 0, maxSize: Math.max(wide, tall), widths: [wide] },
    [
      {
        value: sheet,
        rectangles: frames.map(({ entry }) => ({ width: entry.width, height: entry.height })),
      },
    ],
  )?.pages[0];
  const slots = page?.placed[0]?.at;
  if (!page || slots?.length !== frames.length) {
    throw new Error(`Cannot pack ${family} primary station sheet`);
  }
  const children = frames.map(({ entry, root }, index) => {
    const { x, y } = slots[index]!;
    return `<svg id="${entry.id}" x="${x}" y="${y}" ${root.trimEnd().slice("<svg ".length)}`;
  });
  writeFileSync(
    output + sheet,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${page.height}" viewBox="0 0 ${wide} ${page.height}">${children.join("")}</svg>\n`,
  );
  return frames.map(({ entry }) => {
    const selected = { ...entry, path, svgSheet: true };
    return family === "core" ? selected : withStationDisplayIntrinsics(selected);
  });
}
