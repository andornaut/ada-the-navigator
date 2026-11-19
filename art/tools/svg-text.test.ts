import assert from "node:assert/strict";
import { test } from "node:test";

import { svgNumber, svgText } from "./svg-text.ts";

test("numbers keep at most the given decimals, without trailing or leading zeros", () => {
  assert.deepEqual(
    [12.34, 3.0, 0.25, -0.04, -0.46, 7.96, 100].map((value) => svgNumber(1, value)),
    ["12.3", "3", ".3", "0", "-.5", "8", "100"],
  );
  assert.equal(svgNumber(3, 3.625), "3.625");
});

test("geometry is rounded and the markup minified, other attributes unchanged", () => {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="79" height="55" viewBox="0 0 180.571 125.714">',
    "  <title>Whale 0</title>",
    '  <g stroke-width="1.25" fill-opacity="0.35">',
    '    <polygon fill="#7c72a4" points="54.42,22.60 55.70,15.08"/>',
    "    <path",
    '      fill="none"',
    '      d="M 5 3.625 H 3.625 Q 2.625 3.625 2.625 4.625 Z"',
    "    />",
    '    <ellipse cx="190.04" cy="90" rx="120" ry="52" transform="rotate(-6.87 190 90)" />',
    "  </g>",
    "</svg>",
    "",
  ].join("\n");
  assert.equal(
    svgText(svg),
    '<svg xmlns="http://www.w3.org/2000/svg" width="79" height="55" viewBox="0 0 180.571 125.714">' +
      "<title>Whale 0</title>" +
      '<g stroke-width="1.3" fill-opacity="0.35">' +
      '<polygon fill="#7c72a4" points="54.4,22.6 55.7,15.1"/>' +
      '<path fill="none" d="M5 3.6H3.6Q2.6 3.6 2.6 4.6Z"/>' +
      '<ellipse cx="190" cy="90" rx="120" ry="52" transform="rotate(-6.87 190 90)"/>' +
      "</g></svg>",
  );
});

test("a higher precision keeps more decimals", () => {
  assert.equal(
    svgText('<svg width="20"><path d="M5 3.625H3.625"/></svg>', 3),
    '<svg width="20"><path d="M5 3.625H3.625"/></svg>',
  );
});
