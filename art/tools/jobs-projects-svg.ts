import { svgText } from "./svg-text.ts";
import { writeUiIcon } from "./ui-icon-sources.ts";

const jobs = {
  activity: "M17 7a7.4 7.4 0 1 0 0 6m0-10v4.5h-4.5",
  delivery: "M2 4h16v3H2Z",
  hunt: "M13 8a5.3 5.3 0 1 1-10.6 0 5.3 5.3 0 0 1 10.6 0Zm-1.4 4.5 6 5.1",
  rescue: "M13 6v7a4.5 4.5 0 0 1-9 0l3-3m8-6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  survey: "M2 5l5-2 5 2 6-2v12l-6 2-5-2-5 2Zm5-2v12m5-10v12m2-8 2 2m0-2-2 2",
} satisfies Record<string, string>;

const projects = {
  "channel-lights": "M4 16V7m12 9V7M2 17h4m8 0h4M2 6l1-2h3l1 2v3H2Zm11 0 1-2h3l1 2v3h-5Z",
  "courier-school": "M2 8l8-4 8 4-8 4Zm4 2v4c2 2 6 2 8 0v-4m3-1v5",
  "current-buoys": "M2 13q3.5-3 8 0t8 0M6 5v5m8-7v7M4.5 7h3m5-2h3",
  "docking-bay": "M2 17V3h16v14M2 7h16m-8 0v10m-5.5-4H8m4 0h3.5",
  "greenhouse-ring": "M2 14a8 8 0 0 1 16 0Zm2 3h12m-6-4V8m0 3 3-2m-3 3-3-2",
  "hub-repairs": "M10 8a4 4 0 0 1 5-5l-2 2 1 2 2 1 2-2a4 4 0 0 1-5 5l-7 7-3-3Z",
  "loom-hall": "M2 8l8-4 8 4H2Zm2 1v7m12-7v7M2 17h16m-10 0v-5h4v5",
  "nursery-beacon": "M3 17h14M6 14l2-6m6 6-2-6M4 8V5q0-2 6-2t6 2v3Z",
  "practice-berth":
    "M3.9 8c1.5-1.8 3.6-3.2 6.1-3.2s4.6 1.4 6.1 3.2c-1.5 1.7-3.6 3.1-6.1 3.1S5.4 9.7 3.9 8ZM10 6.6v2.1M4 14h12l1.1 2.1H2.9Zm2 2.1v1m8-1v1",
  "quiet-crossing":
    "M1.9 15h3.2m-1.6 0V9.5m-.6 0h1.2v2H2.9ZM8 15h4m-2 0V7m-.8 0h1.6v4H9.2Zm5.7 8h3.2m-1.6 0V9.5m-.6 0h1.2v2h-1.2Z",
  "route-exchange": "M2.9 4h14.2M4 4v13m12-13v13M2.9 15h14.2M7 8v3m3-4v5m3-3v3",
  "salvage-beacons": "M6 17h8M7 14V9a3 3 0 0 1 6 0v5ZM3 6l2 2m12-2-2 2M10 2v2",
  "spare-beacon": "M2 17h10m-8-3 2-6m4 6L8 8M3 8V5q0-2 4-2t4 2v3Zm10.5 2h4.5m-2.25-2.25v4.5",
  "workshop-crane": "M4 17V3h13M4 3l6 4H4m12-4v8m-2 0h4v4h-4ZM2 17h5",
} satisfies Record<string, string>;

const states = [
  ["", "#ead4aa"],
  ["-disabled", "#9a96ad"],
] as const;

for (const [family, glyphs] of Object.entries({ job: jobs, project: projects })) {
  for (const [key, path] of Object.entries(glyphs)) {
    for (const [suffix, colour] of states) {
      const outline = `<path d="${path}" fill="none" stroke="${colour}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
      const detail =
        family === "job" && key === "delivery"
          ? `<path fill="${colour}" fill-rule="evenodd" d="M3 8h14v9H3Zm4 2.5v1.6h6v-1.6Z"/>`
          : "";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">${outline}${detail}</svg>`;
      writeUiIcon(`icon-${family}-${key}${suffix}`, svgText(svg));
    }
  }
}
