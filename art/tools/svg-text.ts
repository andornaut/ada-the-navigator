// The output step of every generated SVG: coordinates and lengths rounded to `decimals` places
// and the markup minified. Attributes keep their order and every other value; the root <svg>
// keeps its width, height and viewBox exactly, and transforms keep their angles and factors.

/** Attributes whose numbers are coordinates or lengths in user units. */
const GEOMETRY = new Set([
  "cx",
  "cy",
  "d",
  "height",
  "points",
  "r",
  "rx",
  "ry",
  "stdDeviation",
  "stroke-width",
  "width",
  "x",
  "x1",
  "x2",
  "y",
  "y1",
  "y2",
]);

/**
 * The sets that keep more than one decimal, because one decimal moves their edges past the
 * rendering budget in art/README.md: the measured sprites by more than 2 levels at the 99th
 * percentile at display size, the authored arcs and handles visibly along their whole stroke.
 */
export const SVG_DECIMALS = {
  /** The job landmarks, whose beacon arcs are authored to 3 decimals. */
  landmarks: 3,
  /** The start screen nav glyphs, authored to 3 decimals on a 20 px grid. */
  navGlyphs: 3,
  /** The outposts' growers and rings. */
  outposts: 2,
  /** Ada's ship frames, 96 units drawn at 42 px. */
  ship: 2,
  /** The core station frames. */
  station: 2,
  /** The upgrade pickup's 12 by 8 chevron. */
  upgradePickup: 2,
} as const;

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/gu;
const ATTRIBUTE = /([A-Za-z_:][-\w:.]*)\s*=\s*"([^"]*)"/gu;

/** `value` at `decimals` places at most, without trailing zeros or a leading zero. */
export function svgNumber(decimals: number, value: number): string {
  const scale = 10 ** decimals;
  const text = (Math.round(value * scale) / scale).toFixed(decimals);
  const trimmed = text.includes(".") ? text.replace(/\.?0+$/u, "") : text;
  return trimmed === "-0" ? "0" : trimmed.replace(/^(-?)0\./u, "$1.");
}

function geometry(decimals: number, name: string, value: string): string {
  const rounded = value.replace(NUMBER, (number) => svgNumber(decimals, Number(number)));
  const spaced = rounded.replace(/\s+/gu, " ").trim();
  if (name === "d") {
    return spaced.replace(/\s*([A-Za-z,])\s*/gu, "$1");
  }
  return spaced.replace(/\s*,\s*/gu, ",");
}

function tag(decimals: number, root: boolean, text: string): string {
  const name = /^<\/?\s*([^\s/>]+)/u.exec(text)![1]!;
  if (text.startsWith("</")) {
    return `</${name}>`;
  }
  const attributes = [...text.matchAll(ATTRIBUTE)].map(([, key, value]) => {
    const kept = root || !GEOMETRY.has(key!) ? value! : geometry(decimals, key!, value!);
    return ` ${key}="${kept}"`;
  });
  return `<${name}${attributes.join("")}${/\/\s*>$/u.test(text) ? "/>" : ">"}`;
}

/** `svg` with its coordinates at `decimals` places (one by default) and no layout whitespace. */
export function svgText(svg: string, decimals = 1): string {
  let root = true;
  return svg
    .replace(/<[^>]+>/gu, (text) => {
      const formatted = tag(decimals, root && text.startsWith("<svg"), text);
      root = false;
      return formatted;
    })
    .replace(/>\s+</gu, "><")
    .trim();
}
