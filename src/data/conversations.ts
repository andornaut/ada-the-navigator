import { SECTORS } from "./galaxies.ts";
import { JOB_LORE } from "./jobs.ts";
import type { SectorId } from "./types.ts";

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
  | { readonly kind: "arrival"; readonly sector: SectorId }
  | { readonly kind: "meeting"; readonly sector: SectorId; readonly destination: string }
  /** A first meeting with a galaxy's people, on its cue. */
  | { readonly kind: "encounter"; readonly sector: SectorId; readonly cue: EncounterCue }
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
  /** The General's broadcast while Ada holds `held` holodisks. */
  | { readonly kind: "general"; readonly held: number }
  | { readonly kind: "quiet"; readonly sector: SectorId }
  | { readonly kind: "funded"; readonly project: string }
  | { readonly kind: "penny" }
  /** A held job's moment: the tow line attaching or Ada entering a search area. */
  | { readonly kind: "job"; readonly moment: JobMoment }
  /** Astra's lore line after a job completes, one unseen line per job. */
  | { readonly kind: "jobLore"; readonly sector: SectorId };

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
export const GENERAL_NAMED = { holodisks: 3, name: "General Gadget" } as const;

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
    trigger: { kind: "arrival", sector: 1 },
  },
  {
    id: "meeting:1:growers",
    lines: [
      line("ada", "Who grows food out here?"),
      line("astra", "The growers farm starlight on their outpost."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { destination: "growers", kind: "meeting", sector: 1 },
  },
  {
    id: "meeting:1:workshop",
    lines: [
      line("astra", "The workshop can fix almost anything."),
      happy("ada", "Maybe they can fix you too, Astra!"),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { destination: "workshop", kind: "meeting", sector: 1 },
  },
  {
    id: "meeting:1:salvagers",
    lines: [
      line("ada", "What do salvagers do?"),
      line("astra", "They find lost things and use them again."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { destination: "salvagers", kind: "meeting", sector: 1 },
  },
  {
    id: "quiet:1:lonely",
    lines: [
      line("ada", "Astra, do you ever get lonely?"),
      line("astra", "Not with a navigator aboard."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "quiet", sector: 1 },
  },
  {
    id: "quiet:1:tail",
    lines: [
      line("astra", "Penny's tail is wagging at my console lights."),
      happy("ada", "She thinks you're fun."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "quiet", sector: 1 },
  },
  {
    id: "quiet:1:name",
    lines: [
      line("ada", "Why is it called Sunflower?"),
      line("astra", "Its arms spiral like the seeds of a sunflower."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "quiet", sector: 1 },
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
    trigger: { kind: "arrival", sector: 2 },
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
    trigger: { cue: "hubNear", kind: "encounter", sector: 2 },
  },
  {
    id: "quiet:2:notice",
    lines: [
      line("astra", "I used to rush everywhere. With you, I notice more."),
      happy("ada", "That's what exploring is for."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "quiet", sector: 2 },
  },
  {
    id: "quiet:2:whole",
    lines: [
      line("astra", "Almost whole. I'm a little scared of that."),
      line("ada", "We'll do it together."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "quiet", sector: 2 },
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
    trigger: { kind: "arrival", sector: 3 },
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
    trigger: { cue: "familyInSight", kind: "encounter", sector: 3 },
  },
  {
    id: "meeting:3:voron",
    lines: [
      line("ada", "Who are the squid folk by the currents?"),
      line("astra", "The Voron. They ride the currents with the whales and write in glowing ink."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { cue: "stationNear", kind: "encounter", sector: 3 },
  },
  {
    id: "quiet:3:maps",
    lines: [line("astra", "My maps feel fuller every day."), happy("ada", "Our maps.")],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "quiet", sector: 3 },
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
    trigger: { kind: "quiet", sector: 3 },
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
      line("astra", "I'm not yours, General. I never was."),
    ],
    priority: "warning",
    repeat: "never",
    trigger: { held: 4, kind: "general" },
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
  ...SECTORS.flatMap((sector) =>
    (JOB_LORE[sector] ?? []).map((text, index): Conversation => ({
      id: `jobLore:${sector}:${index}`,
      lines: [line("astra", text)],
      priority: "lore",
      repeat: "never",
      trigger: { kind: "jobLore", sector },
    })),
  ),
];
