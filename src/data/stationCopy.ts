export const STATION_NAME_WORDS = [
  "Amber",
  "Beacon",
  "Comet",
  "Dawn",
  "Ember",
  "Fern",
  "Glimmer",
  "Haven",
  "Iris",
  "Juniper",
  "Kite",
  "Lantern",
  "Meadow",
  "Nova",
  "Orbit",
  "Pebble",
] as const;

export const KEEPER_NAME_PARTS = {
  1: [
    ["Pollen", "Petal", "Amber"],
    ["Goldwing", "Bloom", "Honeycomb"],
  ],
  2: [
    ["Flint", "Shale", "Chert"],
    ["Pebble", "Copper", "Ridge"],
  ],
  3: [
    ["Cove", "Eddy", "Foam"],
    ["Tide", "Current", "Shell"],
  ],
  4: [
    ["Fern", "Rush", "Aster"],
    ["Reedwing", "Thread", "Stillwater"],
  ],
  5: [
    ["Prism", "Tick", "Arc"],
    ["Beacon", "Lamplight", "Compass"],
  ],
  6: [
    ["Dew", "Puddle", "Wisp"],
    ["Ripple", "Drift", "Glow"],
  ],
} as const;

export const STATION_KEEPER_COPY = {
  flavor: {
    1: "We keep things humming around here.",
    2: "A little dust never bothers us.",
    3: "The currents are calmer by the docks.",
    4: "Take your time. The channels teach patience.",
    5: "We leave a light on for travelers.",
    6: "There’s room to rest here.",
  },
  intro: "Welcome aboard.",
  returning: [
    "Welcome back, Navigator.",
    "Good to see you again.",
    "Back already? What do you need today?",
  ],
  services: {
    equipment: "We have equipment for your ship.",
    exchange: "You can trade ore and Stardust here.",
    jobs: "There’s work on the board.",
    weaponsAmmo: "We sell weapons and ammo.",
  },
} as const;
