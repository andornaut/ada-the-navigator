import type { SectorId } from "./types.ts";

// Station keepers (gameplay/rules.md "Species and greeters", gameplay/player-copy.md
// "Greeters"): each galaxy's three keepers, in the order stations take them by rank, and the
// greeting lines its keepers share. Black Eye has none; its stations keep the generic welcome.

export interface KeeperGreetings {
  /** The full greeting on a station's first docking, shown a line at a time. */
  readonly first: readonly [string, string, string];
  /** One line on each later docking, in turn. */
  readonly later: readonly [string, string, string];
}

export interface GalaxyKeepers {
  /** The lines the galaxy's station keepers share. */
  readonly greetings: KeeperGreetings;
  /** Cartwheel's mining hub's own lines, which Quartz alone greets with. */
  readonly hub?: KeeperGreetings;
  /** Its keepers by rank. Cartwheel's first, Quartz, keeps the mining hub alone. */
  readonly names: readonly [string, string, string];
}

export const KEEPERS: Readonly<Partial<Record<SectorId, GalaxyKeepers>>> = {
  1: {
    greetings: {
      first: [
        "Bzz, hello! A new face at our station. I'm the keeper here.",
        "We Bumbles hum while we work. It makes heavy jobs feel lighter.",
        "Trade your Stardust, or take a job. Every bit of help counts.",
      ],
      later: [
        "Welcome back! The whole station is humming today.",
        "Back again? Good. Many wings make light work.",
        "Hello, friend. The shop is open, and the job board is full.",
      ],
    },
    names: ["Saffron", "Bramble", "Nectar"],
  },
  2: {
    // Every Cartwheel station but the hub, Slate's or Garnet's.
    greetings: {
      first: [
        "Welcome! Mind the dust. I'm the keeper here.",
        "We Cobbles are made of stone, so a little bump never bothers us.",
        "Trade your Stardust, or take a job. There's room for everyone.",
      ],
      later: [
        "Welcome back! Wipe your boots. Well, your thrusters.",
        "Hello again! Find any good rocks out there?",
        "Back again. There's always room here.",
      ],
    },
    hub: {
      first: [
        "Welcome to the hub! Mind the dust. I'm the keeper here.",
        "We Cobbles are made of stone, so a little bump never bothers us.",
        "Trade your Stardust, or take a job. There's room for everyone.",
      ],
      later: [
        "Welcome back! Wipe your boots. Well, your thrusters.",
        "Hello again! Find any good rocks out there?",
        "Back again. There's always room at the hub.",
      ],
    },
    names: ["Quartz", "Slate", "Garnet"],
  },
  3: {
    greetings: {
      first: [
        "Oh, a visitor! Welcome, welcome. I'm the keeper of this station.",
        "We Voron ride the currents with the whales. They're our oldest friends.",
        "Trade, rest or take a job. Mind the currents on your way out.",
      ],
      later: [
        "Welcome back! The currents brought you right to us.",
        "Hello again. Eight arms, and every one of them waving at you.",
        "Back so soon? The whales were singing about you.",
      ],
    },
    names: ["Ripple", "Coral", "Brine"],
  },
  4: {
    greetings: {
      first: [
        "Welcome, young pilot. Rest your wings. Well, your engines.",
        "We Avi stand still a long time before we move. It is how we see clearly.",
        "Trade, or take a job. There is no hurry here.",
      ],
      later: [
        "Welcome back. Slowly in, slowly out.",
        "Ah, the young pilot. Your docking was very smooth.",
        "Hello again. Stay as long as you need.",
      ],
    },
    names: ["Sedge", "Willow", "Marsh"],
  },
  5: {
    greetings: {
      first: [
        "Hello, traveler! Come into the light. I'm the keeper of this station.",
        "We Munix were built to follow the beacons. Their light shows us home.",
        "Trade your Stardust, or take a job. Fair dealing, plain and true.",
      ],
      later: [
        "Welcome back! Our lamps are always lit for you.",
        "Hello again, traveler. Safe flying out there?",
        "Back again! Come in, out of the dark.",
      ],
    },
    names: ["Lumen", "Dial", "Cog"],
  },
};

/** An Andromeda settler's two lines, the first time Ada comes within Talk range of a settlement. */
export const SETTLER_GREETING: readonly [string, string] = [
  "Hello! You found our little settlement.",
  "Mail comes by courier, and visitors come by beacon light. Welcome!",
];
