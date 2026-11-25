// Review sheet of the whale swim loop:
// `node art/tools/friendly-whale-sheet.ts <dir> [kind]` writes `<dir>/friendly-whale-loop.svg`,
// one kind's 8 loop frames at four headings (the three-quarter view, the profile, toward the
// viewer and away) at 1x and 2x on Whirlpool's field with the 1 px ink keyline, the rest pose
// beside each row, and the 1x rows again on Phantom's field with its white edge. It also writes
// `<dir>/friendly-whales.svg`: every kind's 16 headings at loop frame 0, at 1x and 2x on
// Whirlpool's field, and Marlo's at 1x on Phantom's.
import { mkdirSync, writeFileSync } from "node:fs";

import { DISPLAY_SCALE } from "./crafts.ts";
import { WHALE_KINDS, WHALE_LOOP_FRAMES, type WhaleKind, WHALES } from "./friendly-whale-models.ts";
import { drawWhale, type WhaleFrame, whaleFrame } from "./friendly-whales.ts";

const HEADINGS = [0, 14, 2, 10] as const;
const VIEWS = ["three-quarter", "profile", "toward the viewer", "away"] as const;
const GAP = 8;
const LABEL = 14;

function main() {
  const [out, name = "whale"] = process.argv.slice(2);
  if (!out || !WHALE_KINDS.includes(name as WhaleKind)) {
    throw new Error("Usage: node art/tools/friendly-whale-sheet.ts <dir> [kind]");
  }
  const kind = name as WhaleKind;
  const frame = whaleFrame(kind);
  const loops = HEADINGS.map((yaw) => ({
    yaw,
    rest: drawWhale(kind, frame, yaw),
    frames: Array.from({ length: WHALE_LOOP_FRAMES }, (_, loop) =>
      drawWhale(kind, frame, yaw, loop),
    ),
  }));
  const parts: string[] = [];
  let y = 0;
  let width = 0;
  const band = (title: string, fill: string, edge: string, scales: readonly number[]) => {
    const top = y;
    const rows: string[] = [];
    const art = ({ silhouette, svg }: WhaleFrame, x: number, size: number) => {
      const inner = svg.replace(/^<svg[^>]*>|<title>.*?<\/title>|<\/svg>$/gu, "");
      const keyline = `<path d="${silhouette}" fill="none" stroke="${edge}" stroke-width="${2 / DISPLAY_SCALE}" stroke-linejoin="miter" stroke-miterlimit="2.5"/>`;
      return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${frame} ${frame}" overflow="visible">${keyline}${inner}</svg>`;
    };
    y += GAP;
    for (const scale of scales) {
      const size = frame * DISPLAY_SCALE * scale;
      for (const [index, { yaw, rest, frames }] of loops.entries()) {
        rows.push(
          `<text x="${GAP}" y="${y + 10}" font-family="DejaVu Sans" font-size="10" fill="${edge}">${title}: ${WHALES[kind].title}, heading ${yaw} (${VIEWS[index]}), ${scale}x: rest, then loop frames 0 to ${WHALE_LOOP_FRAMES - 1}</text>`,
        );
        y += LABEL;
        let x = GAP;
        for (const drawn of [rest, ...frames]) {
          rows.push(art(drawn, x, size));
          x += size + GAP;
        }
        width = Math.max(width, x);
        y += size + GAP;
      }
    }
    parts.push(`<rect x="0" y="${top}" width="100%" height="${y - top}" fill="${fill}"/>`, ...rows);
  };
  band("Whirlpool", "#B8CEC4", "#181425", [1, 2]);
  band("Phantom", "#514955", "#FFFFFF", [1]);
  mkdirSync(out, { recursive: true });
  writeFileSync(
    `${out}/friendly-whale-loop.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}">${parts.join("")}</svg>\n`,
  );
}

// Every kind's 16 headings at loop frame 0, eight to a row.
function overview(out: string) {
  const parts: string[] = [];
  let y = 0;
  let width = 0;
  const band = (
    title: string,
    fill: string,
    edge: string,
    kinds: readonly WhaleKind[],
    scales: readonly number[],
  ) => {
    const top = y;
    const rows: string[] = [];
    y += GAP;
    for (const kind of kinds) {
      const frame = whaleFrame(kind);
      const frames = Array.from({ length: 16 }, (_, yaw) => drawWhale(kind, frame, yaw, 0));
      const [x0, y0, x1, y1] = frames[0]!.drawn;
      rows.push(
        `<text x="${GAP}" y="${y + 10}" font-family="DejaVu Sans" font-size="10" fill="${edge}">${title}: ${WHALES[kind].title} (whale-${kind}), frame ${frame}, drawn ${Math.round((x1 - x0) * DISPLAY_SCALE)} x ${Math.round((y1 - y0) * DISPLAY_SCALE)} px at heading 0; headings 0 to 15, loop frame 0</text>`,
      );
      y += LABEL;
      for (const scale of scales) {
        const size = frame * DISPLAY_SCALE * scale;
        for (let start = 0; start < 16; start += 8) {
          let x = GAP;
          for (const { silhouette, svg } of frames.slice(start, start + 8)) {
            const inner = svg.replace(/^<svg[^>]*>|<title>.*?<\/title>|<\/svg>$/gu, "");
            const keyline = `<path d="${silhouette}" fill="none" stroke="${edge}" stroke-width="${2 / DISPLAY_SCALE}" stroke-linejoin="miter" stroke-miterlimit="2.5"/>`;
            rows.push(
              `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${frame} ${frame}" overflow="visible">${keyline}${inner}</svg>`,
            );
            x += size + GAP;
          }
          width = Math.max(width, x);
          y += size + GAP;
        }
      }
    }
    parts.push(`<rect x="0" y="${top}" width="100%" height="${y - top}" fill="${fill}"/>`, ...rows);
  };
  band("Whirlpool", "#B8CEC4", "#181425", WHALE_KINDS, [1, 2]);
  band("Phantom", "#514955", "#FFFFFF", ["whale"], [1]);
  writeFileSync(
    `${out}/friendly-whales.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}">${parts.join("")}</svg>\n`,
  );
}

main();
overview(process.argv[2]!);
