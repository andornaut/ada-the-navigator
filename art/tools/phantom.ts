// Phantom's destinations: the three Blurb settlements, each in a cracked and a mended state with
// an A/B blink. Usage: node art/tools/phantom.ts writes public/art/phantom/ and replaces its
// own entries in place in Phantom's manifest. Contract: art/phantom.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import { readManifest, replaceEntries } from "./manifest.ts";
import * as m from "./phantom-models.ts";
import { type Point, projectAt, round } from "./projection.ts";
import { along, BLINK_MS, DESTINATION_SCALE, DISPLAY_SCALE, DOCK, type Face } from "./solid.ts";
import { svgText } from "./svg-text.ts";

const output = fileURLToPath(new URL("../../public/art/phantom/", import.meta.url));
const PATH = "/art/phantom/";
const PAD = 4;
const SETTLEMENT_SCALE = DISPLAY_SCALE * DESTINATION_SCALE * 1.45;

// ---------------------------------------------------------------- frames

type Layout = { halfWidth: number; above: number; width: number; height: number };

const frameXY = ({ above, halfWidth }: Layout, point: Point) => projectAt(halfWidth, above, point);

// SVG at its display size with the viewBox in frame px.
function svgFile(title: string, frame: Layout, faces: readonly Face[]): string {
  const shapes = faces.map(({ color, points }) => {
    const projected = points.map((point) => {
      const [x, y] = frameXY(frame, point);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(frame.width * SETTLEMENT_SCALE)}" height="${round(frame.height * SETTLEMENT_SCALE)}" viewBox="0 0 ${frame.width} ${frame.height}">`,
    `  <title>${title}</title>`,
    ...shapes,
    "</svg>",
    "",
  ].join("\n");
}

// A dock mouth `face` along the dock axis on the world plane, in the station dock schema.
function dockAt(frame: Layout, face: number, mouthWidth: number) {
  const [x, y] = frameXY(frame, [...along(DOCK, face, 0), 0]);
  return {
    x: round(x),
    y: round(y),
    outward: [0, 1],
    width: round((mouthWidth * Math.sqrt(3)) / Math.SQRT2),
  };
}

// ---------------------------------------------------------------- settlements

type Item = { id: string; file: string; title: string; faces: readonly Face[]; state: m.DockState };

// The three settlements in story order. Each design's four sprites share one frame and pivot, so a
// state change or a blink swaps the sprite in place.
const settlements = [
  { variant: "homes", title: "Blurb homes", build: m.homes, width: 96, height: 96, above: 36 },
  {
    variant: "harbour",
    title: "Blurb harbour",
    build: m.harbour,
    width: 112,
    height: 80,
    above: 32,
  },
  { variant: "signal", title: "Blurb signal", build: m.signal, width: 80, height: 112, above: 56 },
] as const;

const installed: readonly { id: string; path?: string; svgSheet?: true }[] =
  readManifest("phantom").assets;
const files = new Map<string, string>();
const entries = settlements.flatMap(({ above, build, height, title, variant, width }) => {
  const items: Item[] = (["cracked", "mended"] as const).flatMap((state) =>
    (["a", "b"] as const).map((letter) => ({
      id: `outpost-${variant}-${state}-${letter}`,
      file: `${variant}-${state}-${letter}`,
      title: `${title}, ${state} ${letter.toUpperCase()}`,
      faces: build(letter === "a", state),
      state,
    })),
  );
  // The world pivot and dock metadata stay fixed through art changes.
  const frame = { above, halfWidth: width / 2, height, width };
  for (const { id, faces } of items) {
    for (const point of faces.flatMap((face) => face.points)) {
      const [x, y] = frameXY(frame, point);
      if (x < PAD || y < PAD || x > width - PAD || y > height - PAD) {
        throw new Error(`${id} exceeds its fixed frame margin at ${x}, ${y}`);
      }
    }
  }
  const dock = dockAt(frame, m.SETTLEMENT_DOCK.face, m.SETTLEMENT_DOCK.mouth);
  const frames = items.map((item) => ({
    root: svgText(svgFile(item.title, frame, item.faces)),
    entry: {
      id: item.id,
      path: `${PATH}${item.file}.svg`,
      width: frame.width,
      height: frame.height,
      displayWidth: round(frame.width * SETTLEMENT_SCALE),
      displayHeight: round(frame.height * SETTLEMENT_SCALE),
      facing: "fixed",
      pivot: { x: 0.5, y: frame.above / frame.height },
      frameMs: BLINK_MS,
      dock,
      outpost: "settlement",
      variant,
      state: item.state,
    },
  }));
  return (["cracked", "mended"] as const).flatMap((state) => {
    const pair = frames.filter(({ entry }) => entry.state === state);
    const file = `${variant}-${state}-sheet.svg`;
    const path = PATH + file;
    const ids = new Set(pair.map(({ entry }) => entry.id));
    const rows = installed.filter((row) => ids.has(row.id) || row.path === path);
    if (!rows.some((row) => row.svgSheet === true || row.path === path)) {
      for (const { entry, root } of pair) files.set(entry.path.slice(PATH.length), root);
      return pair.map(({ entry }) => entry);
    }

    if (
      rows.length !== pair.length ||
      new Set(rows.map(({ id }) => id)).size !== pair.length ||
      rows.some((row) => !ids.has(row.id) || row.svgSheet !== true || row.path !== path)
    ) {
      throw new Error(`Invalid Phantom settlement sheet selection: ${file}`);
    }
    const wide = width * pair.length;
    const page = packAtlas(
      { compare: () => 0, extrude: 0, maxSize: Math.max(wide, height), widths: [wide] },
      [{ rectangles: pair.map(() => ({ width, height })), value: file }],
    )?.pages[0];
    const slots = page?.placed[0]?.at;
    if (!page || slots?.length !== pair.length) {
      throw new Error(`Cannot pack Phantom settlement sheet: ${file}`);
    }
    const children = pair.map(({ entry, root }, index) => {
      const { x, y } = slots[index]!;
      return `<svg id="${entry.id}" x="${x}" y="${y}" ${root.slice("<svg ".length)}`;
    });
    files.set(
      file,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${page.height}" viewBox="0 0 ${wide} ${page.height}">${children.join("")}</svg>\n`,
    );
    return pair.map(({ entry }) => ({ ...entry, path, svgSheet: true as const }));
  });
});
mkdirSync(output, { recursive: true });
for (const [file, root] of files) writeFileSync(output + file, root);
replaceEntries(
  "phantom",
  (id) => /^outpost-(homes|harbour|signal)-(cracked|mended)-[ab]$/.test(id),
  entries,
);
