// Where the friendly producer's project sprites stand in the world (art/projects.md, World
// changes): their public/art/projects.json entries and Whirlpool's public/art/whirlpool/projects.json.
// The salvage beacons stand on the salvagers' yard, so the station producer places them.
import { DISPLAY_SCALE } from "./crafts.ts";

const pair = (stem: string) => [`${stem}-a`, `${stem}-b`];

// Entries of public/art/projects.json. Offsets and path anchors are world units; an overlay's
// anchors are its base's frame px from the base's pivot.
export const PROJECTS = {
  // Beside the relit beacon at its screen left, clear of it, in the depth slot behind it.
  spareBeacon: {
    beacon: "guide",
    state: "relit",
    kind: "overlay",
    frames: pair("beacon-guide-spare"),
    anchors: [{ x: -124.709, y: -4.5, layer: "behind", phase: 0 }],
  },
  channelLights: {
    galaxy: "needle",
    kind: "path",
    path: "practice",
    frames: pair("needle-lamp"),
    anchors: { start: 40, spacing: 80, inset: 4, sides: [-1, 1], phase: "alternate" },
  },
  practiceBerth: {
    galaxy: "needle",
    kind: "overlay",
    site: "needlePractice",
    frames: pair("needle-practice-berth"),
    offset: [-106, 158],
    frameMs: 700,
  },
  routeExchange: {
    galaxy: "andromeda",
    kind: "overlay",
    site: "pip",
    reference: "andromeda.settlement",
    frames: pair("andromeda-route-exchange"),
    offset: [-110, -143],
    frameMs: 700,
  },
} as const;

// public/art/whirlpool/projects.json. Offsets, lengths and radii are world units from the family
// destination (the smaller adult's position) or along the whales' current.
export const WHIRLPOOL_PROJECTS = {
  version: 1,
  displayScale: DISPLAY_SCALE,
  reducedMotion: { frame: 0 },
  projects: {
    nurseryBeacon: {
      site: "family",
      frames: pair("whirlpool-nursery-beacon"),
      frameMs: 1400,
      // Ahead of the family's heads, with the keel that hangs below the pivot clear of every
      // member's frame, so the pivot sort needs no layers.
      offset: [-68, 60],
      // Rings on the world plane at field level, drawn smallest last; `alpha` per ring in A, B.
      pool: { color: "#ffe9b8", centre: [-6, 54], radii: [72, 56, 40, 24], alpha: [0.07, 0.05] },
    },
    currentBuoys: {
      site: "whalesCurrent",
      frames: pair("whirlpool-current-buoy"),
      // Buoy k sits at arc s = start + k * spacing while s <= length - start, on each side of
      // `sides` at d = side * (width / 2 + edge), d positive to the left of the flow.
      spacing: 128,
      start: 64,
      edge: 20,
      sides: [1, -1],
      // At step floor(t / stepMs), buoy k on either side shows A when (step - k) mod steps is 0,
      // otherwise B: one lit pair runs downstream.
      chase: { stepMs: 300, steps: 4 },
    },
    quietCrossing: {
      site: "family",
      frames: pair("whirlpool-quiet-crossing"),
      frameMs: 1000,
      offset: [100, -78],
    },
  },
} as const;
export const WHIRLPOOL_PROJECTS_FILE = "projects.json";
