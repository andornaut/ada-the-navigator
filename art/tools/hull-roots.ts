import { ENEMY_HEADINGS } from "./projection.ts";

const SHEET_COLUMNS = 4;

// One sheet of a hull's 16 heading roots, four to a row, each nested root keeping its id.
export function packHullRoots(
  frame: number,
  sources: readonly { id: string; svg: string }[],
): string {
  const namespace = 'xmlns="http://www.w3.org/2000/svg"';
  const root = (size: number) =>
    `<svg ${namespace} width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  if (sources.length !== ENEMY_HEADINGS) throw new Error("A hull sheet needs 16 headings");
  const roots = sources.map(({ id, svg }, heading) => {
    if (!svg.startsWith(root(frame)) || !svg.endsWith("</svg>")) {
      throw new Error(`Invalid raw SVG dimensions for ${id}`);
    }
    const x = (heading % SHEET_COLUMNS) * frame;
    const y = Math.floor(heading / SHEET_COLUMNS) * frame;
    return `<svg id="${id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
  });
  return `${root(frame * SHEET_COLUMNS)}${roots.join("")}</svg>\n`;
}
