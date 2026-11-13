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
    1: "{station} keeps humming.",
    2: "A little dust never bothers us at {station}.",
    3: "{station} welcomes current riders.",
    4: "No need to rush at {station}.",
    5: "The lamps at {station} are lit for you.",
    6: "There is room to rest at {station}.",
  },
  intro: "Welcome to {station}. I'm {keeper}.",
  returning: [
    "Welcome back to {station}, Navigator.",
    "{keeper} here. You can trade ore and Stardust here.",
    "Back at {station}! What do you need today?",
  ],
  services: {
    equipment: "{station} has equipment for your ship.",
    exchange: "You can trade ore and Stardust at {station}.",
    jobs: "There's work on the board at {station}.",
    weaponsAmmo: "{station} sells weapons and ammo.",
  },
} as const;
