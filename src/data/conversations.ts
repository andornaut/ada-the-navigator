import { GALAXY_NUMBERS } from "./galaxies.ts";
import { JOB_LORE } from "./jobs.ts";
import type { GalaxyNumber } from "./types.ts";

// In-flight conversations (gameplay/rules.md "Astra and Penny in flight"; words from
// gameplay/player-copy.md "In-flight conversations" and the General's broadcasts, and job lines
// from gameplay/quests.md).

export type Speaker =
  | "ada"
  | "astra"
  | "general"
  | "grower"
  | "miner"
  | "penny"
  | "salvager"
  | "station"
  | "whaleFamily"
  | "workshop";

/**
 * Highest first: a warning (the General's broadcasts among them), then a first-flight lesson,
 * then Penny, then lore. Notices rank between warnings and lessons (BOX_PRIORITIES).
 */
export const CONVERSATION_PRIORITIES = ["warning", "lesson", "penny", "lore"] as const;
export type ConversationPriority = (typeof CONVERSATION_PRIORITIES)[number];

/** What the box shows, highest first; a higher one interrupts a lower one, which resumes after. */
export const BOX_PRIORITIES = ["warning", "notice", "lesson", "penny", "lore"] as const;

/** The first flight's lessons, each skipped once Ada has already done what it teaches. */
export type Lesson = "aim" | "dock" | "move" | "stardust";

export type ConversationTrigger =
  | { readonly kind: "lesson"; readonly lesson: Lesson }
  | { readonly kind: "arrival"; readonly galaxy: GalaxyNumber }
  | { readonly kind: "meeting"; readonly galaxy: GalaxyNumber; readonly destination: string }
  /** A first meeting with a galaxy's people, on its cue. */
  | { readonly kind: "encounter"; readonly galaxy: GalaxyNumber; readonly cue: EncounterCue }
  /** A newly mapped destination or landmark. */
  | { readonly kind: "mapped" }
  | { readonly kind: "stationMapped" }
  /** Ada back in range of a station mapped before, once per station each flight. */
  | { readonly kind: "stationReturn" }
  | { readonly kind: "frigate" }
  | { readonly kind: "capital" }
  /** A heavy disabled with its hull holding. */
  | { readonly kind: "disabled" }
  /** A guard still blocks the destination Ada reached; one variant of the pool plays. */
  | { readonly kind: "guard" }
  | { readonly kind: "current" }
  | { readonly kind: "shieldLow" }
  | { readonly kind: "drones" }
  /** The General's broadcast while Ada holds `held` holodisks, only in `galaxy` when set. */
  | { readonly kind: "general"; readonly galaxy?: GalaxyNumber; readonly held: number }
  | { readonly kind: "quiet"; readonly galaxy: GalaxyNumber }
  | { readonly kind: "funded"; readonly project: string }
  | { readonly kind: "penny" }
  /** A held job's moment: the tow line attaching or Ada entering a search area. */
  | { readonly kind: "job"; readonly moment: JobMoment }
  /** Astra's lore line after a job completes, one unseen line per job. */
  | { readonly kind: "jobLore"; readonly galaxy: GalaxyNumber };

/**
 * What first shows a galaxy's people: the whale family on screen, the mining hub within station
 * discovery range, or one of the galaxy's stations within it.
 */
export type EncounterCue = "familyInSight" | "hubNear" | "stationNear";

/** Held-job moments with their own lines. */
export type JobMoment = "searchEntered" | "towAttached";

/** Ada's and Penny's portrait moods; a line that names none shows neutral. */
export type Mood = "happy" | "neutral" | "upset";

export interface ConversationLine {
  readonly speaker: Speaker;
  /** The touch wording, and every device's when no desktop wording is given. */
  readonly text: string;
  readonly desktop?: string;
  /** Ada's or Penny's portrait mood for the line, neutral when absent. */
  readonly mood?: Mood;
}

export interface Conversation {
  readonly id: string;
  readonly lines: readonly ConversationLine[];
  /**
   * The repeating trigger's pool this is one variant of; each request draws one variant in a
   * shuffled order (model/conversations.ts).
   */
  readonly pool?: string;
  readonly priority: ConversationPriority;
  /**
   * How often it may play: once ever (saved as seen), once per fight, once per flight, or each
   * time its trigger fires. Penny's plays once per point of interest, a station return once per
   * station each flight.
   */
  readonly repeat: "always" | "fight" | "flight" | "never";
  readonly trigger: ConversationTrigger;
}

export const SPEAKERS: Readonly<
  Record<Speaker, { readonly name: string; readonly side: "left" | "right" }>
> = {
  ada: { name: "Ada", side: "left" },
  astra: { name: "Astra", side: "right" },
  // Until the third holodisk is inserted; see GENERAL_NAMED.
  general: { name: "Unknown voice", side: "right" },
  // The community projects' thank-you speakers (gameplay/economy.md "Donations").
  grower: { name: "Grower", side: "right" },
  miner: { name: "Miner", side: "right" },
  penny: { name: "Penny", side: "right" },
  salvager: { name: "Salvager", side: "right" },
  station: { name: "Station", side: "right" },
  whaleFamily: { name: "Whale family", side: "right" },
  workshop: { name: "Workshop", side: "right" },
};

/** The General's name tab once the third holodisk is inserted, from whichever galaxy. */
export const GENERAL_NAMED = { holodisks: 3, name: "Admiral Archie" } as const;

/** How long a line or notice of this text shows unless tapped (rules.md): 5 s plus 50 ms a character. */
export function lineDuration(text: string): number {
  return (
    CONVERSATION_TUNING.lineSeconds + CONVERSATION_TUNING.lineSecondsPerCharacter * text.length
  );
}

/** Provisional timing and ranges, to be tuned through playtesting. */
export const CONVERSATION_TUNING = {
  /** Seconds between ordinary conversations; warnings bypass it. */
  cooldownSeconds: 20,
  /** Seconds each line shows unless tapped, plus lineSecondsPerCharacter per character. */
  lineSeconds: 5,
  lineSecondsPerCharacter: 0.05,
  /** Seconds after Penny senses something before she can again; points found meanwhile pass. */
  pennyIntervalSeconds: 60,
  /** An undiscovered point of interest within this many world units, even off screen. */
  pennyRange: 900,
  /** Seconds without danger that make a quiet stretch. */
  quietSeconds: 60,
  /** The shield fraction at or below which, in a fight, Astra warns once. */
  shieldLowFraction: 0.25,
  /** A Stardust pickup within this many world units starts the Stardust lesson. */
  stardustSightRange: 400,
} as const;

const line = (speaker: Speaker, text: string, desktop?: string): ConversationLine =>
  desktop === undefined ? { speaker, text } : { desktop, speaker, text };
const happy = (speaker: "ada" | "penny", text: string): ConversationLine => ({
  mood: "happy",
  speaker,
  text,
});
const upset = (speaker: "ada" | "penny", text: string): ConversationLine => ({
  mood: "upset",
  speaker,
  text,
});

/** A repeating trigger's variants, ids `{pool}:1` on, in the player copy's order. */
const pool = (
  id: string,
  shared: Pick<Conversation, "priority" | "repeat" | "trigger">,
  variants: readonly (readonly ConversationLine[])[],
): Conversation[] =>
  variants.map((lines, index) => ({ ...shared, id: `${id}:${index + 1}`, lines, pool: id }));

const WOOF = happy("penny", "Woof! Woof!");

export const CONVERSATIONS: readonly Conversation[] = [
  {
    id: "lesson:move",
    lines: [line("astra", "Fly with the {move}.", "Fly with WASD.")],
    priority: "lesson",
    repeat: "never",
    trigger: { kind: "lesson", lesson: "move" },
  },
  {
    id: "lesson:aim",
    lines: [line("astra", "Aim and fire with the {aim}.", "Aim and fire with the arrow keys.")],
    priority: "lesson",
    repeat: "never",
    trigger: { kind: "lesson", lesson: "aim" },
  },
  {
    id: "lesson:stardust",
    lines: [
      line("astra", "That's Stardust. Fly close and I'll pull it in."),
      happy("ada", "Like a magnet!"),
    ],
    priority: "lesson",
    repeat: "never",
    trigger: { kind: "lesson", lesson: "stardust" },
  },
  {
    id: "lesson:dock",
    lines: [
      line(
        "astra",
        "A station! Come close and tap {use} to dock.",
        "A station! Come close and press Space to dock.",
      ),
      happy("ada", "Shopping in space!"),
    ],
    priority: "lesson",
    repeat: "never",
    trigger: { kind: "lesson", lesson: "dock" },
  },
  ...pool(
    "warning:shieldLow",
    { priority: "warning", repeat: "fight", trigger: { kind: "shieldLow" } },
    [
      [line("astra", "Shield low!"), upset("penny", "Whimper...")],
      [line("astra", "Shield low! Pull back."), upset("penny", "Whimper...")],
      [line("astra", "Shield low! Let's get clear."), line("ada", "Hang on, Penny.")],
      [
        line("astra", "Shield low! Find somewhere quiet to recharge."),
        upset("penny", "Whimper..."),
      ],
    ],
  ),
  ...pool(
    "warning:drones",
    { priority: "warning", repeat: "flight", trigger: { kind: "drones" } },
    [
      [line("astra", "Drones ahead."), line("ada", "I see them.")],
      [line("astra", "Drones, coming our way."), line("ada", "Stay close, Penny.")],
      [line("ada", "Drones!"), line("astra", "Shield's ready. Steady aim.")],
      [line("astra", "Incoming drones."), upset("penny", "Grr...")],
      [line("astra", "Here they come."), line("ada", "We can handle this.")],
    ],
  ),
  ...pool(
    "reaction:frigate",
    { priority: "lore", repeat: "flight", trigger: { kind: "frigate" } },
    [
      [
        line("astra", "A frigate. Its guns are the glowing parts."),
        line("ada", "Then that's where I'll aim."),
      ],
      [
        line("ada", "That one's bigger than a drone."),
        line("astra", "A frigate. Knock out its guns to stop it."),
      ],
      [line("astra", "Frigate ahead. Take out its weapons first."), line("ada", "Got it.")],
    ],
  ),
  ...pool(
    "reaction:capital",
    { priority: "lore", repeat: "flight", trigger: { kind: "capital" } },
    [
      [
        line("ada", "That ship is huge!"),
        line("astra", "No crew aboard. Aim for the glowing parts."),
      ],
      [
        line("ada", "Look at the size of that!"),
        line("astra", "Big, but empty. Hit the glowing parts."),
      ],
      [
        line("astra", "A capital ship. Nobody aboard, just machines."),
        line("ada", "Then let's find its glowing parts."),
      ],
    ],
  ),
  // Penny's line is always the same, so players learn it.
  ...pool("penny", { priority: "penny", repeat: "never", trigger: { kind: "penny" } }, [
    [WOOF, happy("ada", "Penny, did you sense something, girl?")],
    [WOOF, line("ada", "What is it, Penny? Something out there?")],
    [WOOF, happy("ada", "Your nose is never wrong. Let's look around.")],
    [WOOF, happy("ada", "Okay, okay! I'll find it.")],
    [WOOF, line("ada", "Ears up! Astra, Penny found something.")],
  ]),
  ...pool("reaction:mapped", { priority: "lore", repeat: "always", trigger: { kind: "mapped" } }, [
    [line("astra", "New place mapped."), happy("ada", "Our map is growing!")],
    [line("astra", "Marking it on the map."), happy("ada", "We're real explorers.")],
    [happy("ada", "Astra, put that on the map!"), line("astra", "Already done, Navigator.")],
    [
      line("astra", "Saved to the map. We can come back any time."),
      happy("ada", "Good. I want to visit again."),
    ],
  ]),
  ...pool(
    "reaction:station",
    { priority: "lore", repeat: "always", trigger: { kind: "stationMapped" } },
    [
      [
        line("astra", "A station. Shops, jobs and friendly faces."),
        happy("ada", "Let's say hello."),
      ],
      [line("astra", "Station on the map. A good place to rest."), happy("ada", "And to shop!")],
      [happy("ada", "Look, a station!"), line("astra", "Mapped. Come close and we can dock.")],
      [
        line("astra", "Another station. Someone always has a job for us."),
        happy("ada", "I like helping."),
      ],
    ],
  ),
  ...pool(
    "reaction:return",
    { priority: "lore", repeat: "flight", trigger: { kind: "stationReturn" } },
    [
      [line("astra", "Our station again."), happy("ada", "It feels like a second home.")],
      [line("ada", "I wonder what jobs they have today."), line("astra", "Let's dock and see.")],
      [
        line("astra", "Welcome back, Navigator. The dock is waiting."),
        happy("ada", "Thanks, Astra."),
      ],
    ],
  ),
  ...pool(
    "reaction:disabled",
    { priority: "lore", repeat: "flight", trigger: { kind: "disabled" } },
    [
      [
        line("astra", "Its weapons are down. We could salvage parts and let it go."),
        happy("ada", "No need to wreck it."),
      ],
      [
        line("astra", "Its guns are out. We can salvage it, or finish it."),
        happy("ada", "Salvage. It can't hurt anyone now."),
      ],
      [
        line("astra", "Disabled. Come close and I can salvage parts."),
        line("ada", "Let's take what we need and go."),
      ],
    ],
  ),
  // A guard still blocks the destination Ada reached: once per destination each flight, one
  // variant at random.
  {
    id: "warning:guard:1",
    lines: [
      line("astra", "Something's guarding this place. Here it comes!"),
      line("ada", "Get ready, Penny."),
    ],
    priority: "warning",
    repeat: "flight",
    trigger: { kind: "guard" },
  },
  {
    id: "warning:guard:2",
    lines: [
      line("astra", "We can't visit yet. A guard ship is watching."),
      line("ada", "Then let's deal with it."),
    ],
    priority: "warning",
    repeat: "flight",
    trigger: { kind: "guard" },
  },
  {
    id: "warning:guard:3",
    lines: [
      line("astra", "A guard is blocking the way in. Stop its weapons first."),
      line("ada", "Okay. I'm ready."),
    ],
    priority: "warning",
    repeat: "flight",
    trigger: { kind: "guard" },
  },
  {
    id: "arrival:1",
    lines: [
      line("astra", "Sunflower. It's the only place I remember."),
      happy("ada", "Then let's make new memories."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { galaxy: 1, kind: "arrival" },
  },
  {
    id: "meeting:1:growers",
    lines: [
      line("ada", "Who grows food out here?"),
      line("astra", "The growers farm starlight on their outpost."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { destination: "growers", galaxy: 1, kind: "meeting" },
  },
  {
    id: "meeting:1:workshop",
    lines: [
      line("astra", "The workshop can fix almost anything."),
      happy("ada", "Maybe they can fix you too, Astra!"),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { destination: "workshop", galaxy: 1, kind: "meeting" },
  },
  {
    id: "meeting:1:salvagers",
    lines: [
      line("ada", "What do salvagers do?"),
      line("astra", "They find lost things and use them again."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { destination: "salvagers", galaxy: 1, kind: "meeting" },
  },
  {
    id: "quiet:1:lonely",
    lines: [
      line("ada", "Astra, do you ever get lonely?"),
      line("astra", "Not with a navigator aboard."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { galaxy: 1, kind: "quiet" },
  },
  {
    id: "quiet:1:tail",
    lines: [
      line("astra", "Penny's tail is wagging at my console lights."),
      happy("ada", "She thinks you're fun."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { galaxy: 1, kind: "quiet" },
  },
  {
    id: "quiet:1:name",
    lines: [
      line("ada", "Why is it called Sunflower?"),
      line("astra", "Its arms spiral like the seeds of a sunflower."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { galaxy: 1, kind: "quiet" },
  },
  // Cartwheel: Astra warmer and surer as her memory returns.
  {
    id: "arrival:2",
    lines: [
      line("astra", "Cartwheel. I remember the noise of this place."),
      happy("ada", "Noisy is good. Busy means people."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { galaxy: 2, kind: "arrival" },
  },
  {
    id: "meeting:2:cobbles",
    lines: [
      happy("ada", "Astra, did that rock just wave at us?"),
      line("astra", "That's a Cobble. They're made of stone, and they eat the ore they mine."),
      happy("ada", "Rocks that eat rocks!"),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { cue: "hubNear", galaxy: 2, kind: "encounter" },
  },
  {
    id: "quiet:2:notice",
    lines: [
      line("astra", "I used to rush everywhere. With you, I notice more."),
      happy("ada", "That's what exploring is for."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { galaxy: 2, kind: "quiet" },
  },
  {
    id: "quiet:2:whole",
    lines: [
      line("astra", "Almost whole. I'm a little scared of that."),
      line("ada", "We'll do it together."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { galaxy: 2, kind: "quiet" },
  },
  // Whirlpool: Astra warmer and surer as her memory returns.
  {
    id: "arrival:3",
    lines: [
      line("astra", "Whirlpool. I'm sure of my course now, Navigator."),
      happy("ada", "You sound more like yourself."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { galaxy: 3, kind: "arrival" },
  },
  {
    id: "meeting:3:family",
    lines: [
      happy("ada", "So many whales! Why do they sing like that?"),
      line("astra", "Whale songs carry far. It's how families find each other in the dark."),
      line("ada", "No wonder it missed them."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { cue: "familyInSight", galaxy: 3, kind: "encounter" },
  },
  {
    id: "meeting:3:voron",
    lines: [
      line("ada", "Who are the squid folk by the currents?"),
      line("astra", "The Voron. They ride the currents with the whales and write in glowing ink."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { cue: "stationNear", galaxy: 3, kind: "encounter" },
  },
  {
    id: "quiet:3:maps",
    lines: [line("astra", "My maps feel fuller every day."), happy("ada", "Our maps.")],
    priority: "lore",
    repeat: "never",
    trigger: { galaxy: 3, kind: "quiet" },
  },
  {
    id: "current:first",
    lines: [
      line("astra", "A space current. Ride it for speed, or push across it."),
      happy("ada", "Like a river in space!"),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "current" },
  },
  {
    id: "quiet:3:rock",
    lines: [line("astra", "I'm glad it was you who found the rock."), happy("ada", "Me too.")],
    priority: "lore",
    repeat: "never",
    trigger: { galaxy: 3, kind: "quiet" },
  },
  // The General's broadcasts, one after the number of holodisks Ada holds. Each built galaxy
  // plays its one, seen as general:<galaxy> (the director's instance), so none replays there.
  {
    id: "general:held:1",
    lines: [
      line("general", "All drones: find the holodisks. Bring them to me."),
      line("astra", "That voice... I don't know why it scares me."),
    ],
    priority: "warning",
    repeat: "never",
    trigger: { held: 1, kind: "general" },
  },
  {
    id: "general:held:2",
    lines: [
      line("general", "Someone is collecting my holodisks. Stop them."),
      line("ada", "Your holodisks? They're Astra's!"),
    ],
    priority: "warning",
    repeat: "never",
    trigger: { held: 2, kind: "general" },
  },
  {
    id: "general:held:3",
    lines: [
      line(
        "general",
        "Little navigator, you can't hide from me. My drones will wait at every exit.",
      ),
      line("ada", "Then we'll take our time."),
    ],
    priority: "warning",
    repeat: "never",
    trigger: { held: 3, kind: "general" },
  },
  {
    id: "general:held:4",
    lines: [
      line("general", "Astra. I know you can hear me. Come back, and bring my disks."),
      line("astra", "I'm not yours, Admiral. I never was."),
    ],
    priority: "warning",
    repeat: "never",
    trigger: { held: 4, kind: "general" },
  },
  {
    id: "general:held:5",
    lines: [
      line("general", "So you came to Phantom. I have the last disk, little navigator."),
      line("ada", "Then we'll come and get it."),
    ],
    priority: "warning",
    repeat: "never",
    // It names Phantom, so it plays only there.
    trigger: { galaxy: 6, held: 5, kind: "general" },
  },
  {
    id: "job:towAttached",
    lines: [
      line("astra", "Tow line attached. We'll be slow and heavy."),
      happy("ada", "Hold on, we've got you!"),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "job", moment: "towAttached" },
  },
  {
    id: "job:searchEntered",
    lines: [line("ada", "It's around here somewhere. Penny, can you help?")],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "job", moment: "searchEntered" },
  },
  ...GALAXY_NUMBERS.flatMap((galaxy) =>
    (JOB_LORE[galaxy] ?? []).map((text, index): Conversation => ({
      id: `jobLore:${galaxy}:${index}`,
      lines: [line("astra", text)],
      priority: "lore",
      repeat: "never",
      trigger: { galaxy, kind: "jobLore" },
    })),
  ),
];

/** Approved Use exchanges, keyed by existing runtime galaxy and dialogue context. */
export interface InteractionLine {
  readonly speaker: string;
  readonly text: string;
}
export interface InteractionCopy {
  readonly party: string;
  readonly lines: readonly InteractionLine[];
  readonly topics: readonly {
    readonly label: string;
    readonly lines: readonly InteractionLine[];
  }[];
}
export const INTERACTION_COPY: Readonly<Record<string, InteractionCopy>> = {
  "1.deliveryComplete": {
    lines: [
      {
        speaker: "Ada",
        text: "Here are the spare parts.",
      },
      {
        speaker: "Rivet",
        text: "Now we can repair the growers' equipment.",
      },
      {
        speaker: "Ada",
        text: "And the salvagers will contact the growers for food.",
      },
      {
        speaker: "Rivet",
        text: "We'll arrange the next exchange ourselves. Thank you for introducing us!",
      },
    ],
    party: "Rivet",
    topics: [
      {
        label: "Need another delivery?",
        lines: [
          {
            speaker: "Rivet",
            text: "Not for this repair. We can arrange the next exchange ourselves.",
          },
        ],
      },
      {
        label: "Who has the holodisk?",
        lines: [
          {
            speaker: "Rivet",
            text: "Ask at any of our outposts. We have something for you.",
          },
        ],
      },
    ],
  },
  "1.grower": {
    lines: [
      {
        speaker: "Clover",
        text: "A visitor! We grow food here, but our equipment needs repairs.",
      },
      {
        speaker: "Ada",
        text: "Can someone help fix it?",
      },
      {
        speaker: "Clover",
        text: "There's a workshop out here somewhere. Would you take them some food and ask for help?",
      },
      {
        speaker: "Ada",
        text: "I'll take the food and ask.",
      },
    ],
    party: "Clover",
    topics: [
      {
        label: "What do you need?",
        lines: [
          {
            speaker: "Clover",
            text: "Help with the equipment. We could grow more if it worked.",
          },
        ],
      },
      {
        label: "Do you know the others?",
        lines: [
          {
            speaker: "Clover",
            text: "We haven't spoken much with the other outposts.",
          },
        ],
      },
    ],
  },
  "1.salvager": {
    lines: [
      {
        speaker: "Ada",
        text: "The workshop sent this tool kit. They need spare parts.",
      },
      {
        speaker: "Patch",
        text: "Useful tools! We have parts to spare, but our food is running low.",
      },
      {
        speaker: "Ada",
        text: "The growers have food. I brought some to the workshop.",
      },
      {
        speaker: "Patch",
        text: "Take these parts to the workshop. We'll contact the growers.",
      },
    ],
    party: "Patch",
    topics: [
      {
        label: "What do you salvage?",
        lines: [
          {
            speaker: "Patch",
            text: "Things people have lost or left behind. Plenty can be used again.",
          },
        ],
      },
      {
        label: "Who will ask for food?",
        lines: [
          {
            speaker: "Patch",
            text: "We will. You've shown us who to ask.",
          },
        ],
      },
    ],
  },
  "1.workshop": {
    lines: [
      {
        speaker: "Ada",
        text: "Food from the growers. Their equipment needs repairs.",
      },
      {
        speaker: "Rivet",
        text: "We can repair it. We're short of parts, though.",
      },
      {
        speaker: "Ada",
        text: "Where could we find some?",
      },
      {
        speaker: "Rivet",
        text: "The salvagers might have what we need. Take them this tool kit.",
      },
    ],
    party: "Rivet",
    topics: [
      {
        label: "What do you repair?",
        lines: [
          {
            speaker: "Rivet",
            text: "Tools, ships and growing equipment. Spare parts really help!",
          },
        ],
      },
      {
        label: "Why a tool kit?",
        lines: [
          {
            speaker: "Rivet",
            text: "Useful tools for them, spare parts for us.",
          },
        ],
      },
    ],
  },
  "2.approach": {
    lines: [
      {
        speaker: "Jasper",
        text: "There's room for everyone here. Let them dock.",
      },
      {
        speaker: "Ada",
        text: "We're right here, Mica.",
      },
      {
        speaker: "Mica",
        text: "I'm coming in.",
      },
      {
        speaker: "Jasper",
        text: "We are staying.",
      },
    ],
    party: "Jasper",
    topics: [
      {
        label: "Should we move away?",
        lines: [
          {
            speaker: "Jasper",
            text: "Stay nearby. There's room for everyone.",
          },
        ],
      },
      {
        label: "What does Mica need?",
        lines: [
          {
            speaker: "Ada",
            text: "Room to dock and company on the approach.",
          },
        ],
      },
    ],
  },
  "2.hub": {
    lines: [
      {
        speaker: "Quartz",
        text: "Welcome. Independent miners bring ore here for transport.",
      },
      {
        speaker: "Ada",
        text: "Where do I find ore?",
      },
      {
        speaker: "Quartz",
        text: "Shoot ore rocks and collect the ore they release. Bring it here to deposit it.",
      },
      {
        speaker: "Ada",
        text: "Can I bring a little at a time?",
      },
      {
        speaker: "Quartz",
        text: "Partial loads count, and you can travel back when you're out of danger.",
      },
    ],
    party: "Quartz",
    topics: [
      {
        label: "Who uses the hub?",
        lines: [
          {
            speaker: "Quartz",
            text: "Independent miners. There's docking space for everyone.",
          },
        ],
      },
      {
        label: "Should I keep some ore?",
        lines: [
          {
            speaker: "Astra",
            text: "Yes. Above ten percent shield, recharge needs ore.",
          },
        ],
      },
    ],
  },
  "2.miner": {
    lines: [
      {
        speaker: "Ada",
        text: "That pilot keeps blocking you. Does it happen often?",
      },
      {
        speaker: "Mica",
        text: "It keeps happening. I've started waiting until they're gone.",
      },
      {
        speaker: "Ada",
        text: "Would you like company next time?",
      },
      {
        speaker: "Mica",
        text: "I'd like some company next time. That would help.",
      },
    ],
    party: "Mica",
    topics: [
      {
        label: "Do you need docking help?",
        lines: [
          {
            speaker: "Mica",
            text: "I know how to dock. I just need them to stop blocking me.",
          },
        ],
      },
      {
        label: "What would help?",
        lines: [
          {
            speaker: "Mica",
            text: "Company on the approach. Stay nearby.",
          },
        ],
      },
    ],
  },
  "2.visitors": {
    lines: [
      {
        speaker: "Ada",
        text: "Have you seen the pilot blocking Mica?",
      },
      {
        speaker: "Opal",
        text: "I've seen it. I didn't know what to do.",
      },
      {
        speaker: "Ada",
        text: "Mica would like company next time. Will you come?",
      },
      {
        speaker: "Opal",
        text: "I'll come in with you. We can make room and stay nearby.",
      },
    ],
    party: "Opal",
    topics: [
      {
        label: "Does Mica want company?",
        lines: [
          {
            speaker: "Ada",
            text: "Yes. I asked, and Mica said it would help.",
          },
        ],
      },
      {
        label: "What will we do?",
        lines: [
          {
            speaker: "Opal",
            text: "Come in together. Make room and stay nearby.",
          },
        ],
      },
    ],
  },
  "3.family": {
    lines: [
      {
        speaker: "Whale family",
        text: "Have you seen someone traveling alone? We've been searching.",
      },
      {
        speaker: "Ada",
        text: "Marlo was stuck behind some rocks. I've cleared a way.",
      },
      {
        speaker: "Whale family",
        text: "They're safe? Please share our coordinates so they can find us.",
      },
      {
        speaker: "Ada",
        text: "I'll go back and tell Marlo where you are.",
      },
    ],
    party: "Whale family",
    topics: [
      {
        label: "Who are you seeking?",
        lines: [
          {
            speaker: "Whale family",
            text: "The whale traveling alone. We want to be together again.",
          },
        ],
      },
      {
        label: "What should I share?",
        lines: [
          {
            speaker: "Whale family",
            text: "Our coordinates. Then Marlo will know where to go.",
          },
        ],
      },
    ],
  },
  "3.freed": {
    lines: [
      {
        speaker: "Marlo",
        text: "That's better. Thank you.",
      },
      {
        speaker: "Ada",
        text: "Where will you go now?",
      },
      {
        speaker: "Marlo",
        text: "I don't know where my family went. Would you look for them?",
      },
      {
        speaker: "Ada",
        text: "I'll look. Then I'll bring you their coordinates.",
      },
    ],
    party: "Marlo",
    topics: [
      {
        label: "Will they be looking?",
        lines: [
          {
            speaker: "Marlo",
            text: "They'll be searching for me too.",
          },
        ],
      },
      {
        label: "What do you like?",
        lines: [
          {
            speaker: "Marlo",
            text: "Familiar voices and finding places I haven't seen before. The young ones learn our routes from us.",
          },
        ],
      },
    ],
  },
  "3.holodiskLead": {
    lines: [
      {
        speaker: "Whale family",
        text: "You listened when nobody else did. Now listen to us.",
      },
      {
        speaker: "Ada",
        text: "What can you hear?",
      },
      {
        speaker: "Whale family",
        text: "A shining disk drifts on the current ahead. Drones guard it. Follow our song.",
      },
      {
        speaker: "Ada",
        text: "Astra's holodisk! We'll follow.",
      },
    ],
    party: "Whale family",
    topics: [
      {
        label: "Where is the disk?",
        lines: [
          {
            speaker: "Whale family",
            text: "Ahead on the current. Follow our song.",
          },
        ],
      },
      {
        label: "Is it guarded?",
        lines: [
          {
            speaker: "Whale family",
            text: "Drones guard it. Take care on your way.",
          },
        ],
      },
    ],
  },
  "3.holodiskLeadSong": {
    lines: [
      {
        speaker: "Whale family",
        text: "You listened when nobody else did. Now listen to us.",
      },
      {
        speaker: "Ada",
        text: "What can you hear?",
      },
      {
        speaker: "Whale family",
        text: "A shining disk drifts on the current ahead. Drones guard it. Follow our song.",
      },
      {
        speaker: "Ada",
        text: "Astra's holodisk! We'll follow.",
      },
    ],
    party: "Whale family",
    topics: [
      {
        label: "Where is the disk?",
        lines: [
          {
            speaker: "Whale family",
            text: "Ahead on the current. Follow our song.",
          },
        ],
      },
      {
        label: "Is it guarded?",
        lines: [
          {
            speaker: "Whale family",
            text: "Drones guard it. Take care on your way.",
          },
        ],
      },
    ],
  },
  "3.reunion": {
    lines: [
      {
        speaker: "Ada",
        text: "I found your family. Here are their coordinates.",
      },
      {
        speaker: "Marlo",
        text: "You found my family! Now I know where to go.",
      },
      {
        speaker: "Ada",
        text: "They're searching for you too.",
      },
      {
        speaker: "Marlo",
        text: "Thank you for listening.",
      },
    ],
    party: "Marlo",
    topics: [
      {
        label: "Can you reach them?",
        lines: [
          {
            speaker: "Marlo",
            text: "Yes. The rocks are clear, and now I know where they are.",
          },
        ],
      },
      {
        label: "What happens next?",
        lines: [
          {
            speaker: "Marlo",
            text: "I'll swim back to my family.",
          },
        ],
      },
    ],
  },
  "3.trapped": {
    lines: [
      {
        speaker: "Marlo",
        text: "Can you hear me? I can't get through these rocks.",
      },
      {
        speaker: "Ada",
        text: "A whale in space! And you can talk?",
      },
      {
        speaker: "Marlo",
        text: "Yes, and I'd like to get through. Could you help clear a way?",
      },
      {
        speaker: "Ada",
        text: "I'll clear those rocks. My shots won't hurt you.",
      },
    ],
    party: "Marlo",
    topics: [
      {
        label: "Where do you travel?",
        lines: [
          {
            speaker: "Marlo",
            text: "We travel through space together. There are places we visit and currents we follow.",
          },
        ],
      },
      {
        label: "Are you stuck?",
        lines: [
          {
            speaker: "Marlo",
            text: "These rocks block my way. Clear them so I can move again.",
          },
        ],
      },
    ],
  },
  "3.whale": {
    lines: [
      {
        speaker: "Marlo",
        text: "Can you hear me? I can't get through these rocks.",
      },
      {
        speaker: "Ada",
        text: "A whale in space! And you can talk?",
      },
      {
        speaker: "Marlo",
        text: "Yes, and I'd like to get through. Could you help clear a way?",
      },
      {
        speaker: "Ada",
        text: "I'll clear those rocks. My shots won't hurt you.",
      },
    ],
    party: "Marlo",
    topics: [
      {
        label: "Where do you travel?",
        lines: [
          {
            speaker: "Marlo",
            text: "We travel through space together. There are places we visit and currents we follow.",
          },
        ],
      },
      {
        label: "Are you stuck?",
        lines: [
          {
            speaker: "Marlo",
            text: "These rocks block my way. Clear them so I can move again.",
          },
        ],
      },
    ],
  },
  deposit: {
    lines: [
      {
        speaker: "Astra",
        text: "Ore deposited at the hub. Partial loads count.",
      },
      {
        speaker: "Ada",
        text: "Let's keep ore for your shield too.",
      },
    ],
    party: "Astra",
    topics: [
      {
        label: "Why keep ore?",
        lines: [
          {
            speaker: "Astra",
            text: "Above ten percent shield, recharge needs ore. Without ore, it won't charge higher.",
          },
        ],
      },
      {
        label: "When does recharge start?",
        lines: [
          {
            speaker: "Astra",
            text: "Thirty seconds after our last hit. Keep ore for recharge above ten percent.",
          },
        ],
      },
    ],
  },
  salvage: {
    lines: [
      {
        speaker: "Astra",
        text: "Its weapons are down. I can salvage parts.",
      },
      {
        speaker: "Ada",
        text: "Let's take what we need and go.",
      },
    ],
    party: "Astra",
    topics: [
      {
        label: "What can we collect?",
        lines: [
          {
            speaker: "Astra",
            text: "Parts from this disabled ship.",
          },
        ],
      },
      {
        label: "Is it disabled?",
        lines: [
          {
            speaker: "Astra",
            text: "Yes. Its weapons are down.",
          },
        ],
      },
    ],
  },
};
