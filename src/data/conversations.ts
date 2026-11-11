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
  | { readonly kind: "mapped" }
  | { readonly kind: "capital" }
  | { readonly kind: "shieldLow" }
  | { readonly kind: "drones" }
  | { readonly kind: "general"; readonly sector: SectorId }
  | { readonly kind: "quiet"; readonly sector: SectorId }
  | { readonly kind: "funded"; readonly project: string }
  | { readonly kind: "penny" }
  /** A held job's moment: the tow line attaching or Ada entering a search area. */
  | { readonly kind: "job"; readonly moment: JobMoment }
  /** Astra's lore line after a job completes, one unseen line per job. */
  | { readonly kind: "jobLore"; readonly sector: SectorId };

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
  readonly priority: ConversationPriority;
  /**
   * How often it may play: once ever (saved as seen), once per fight, or once per flight. Penny's
   * plays once per point of interest.
   */
  readonly repeat: "fight" | "flight" | "never";
  readonly trigger: ConversationTrigger;
}

export const SPEAKERS: Readonly<
  Record<Speaker, { readonly name: string; readonly side: "left" | "right" }>
> = {
  ada: { name: "Ada", side: "left" },
  astra: { name: "Astra", side: "right" },
  // Until the Whirlpool holodisk is inserted; see GENERAL_NAMED.
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

/** The General's name tab once the Whirlpool holodisk is inserted. */
export const GENERAL_NAMED = { name: "General Gadget", sector: 3 } as const;

/** Provisional timing and ranges, to be tuned through playtesting. */
export const CONVERSATION_TUNING = {
  /** Seconds between ordinary conversations; warnings bypass it. */
  cooldownSeconds: 20,
  /** Seconds each line shows unless tapped. */
  lineSeconds: 5,
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

export const CONVERSATIONS: readonly Conversation[] = [
  {
    id: "lesson:move",
    lines: [line("astra", "Use the left stick to fly.", "Use WASD to fly.")],
    priority: "lesson",
    repeat: "never",
    trigger: { kind: "lesson", lesson: "move" },
  },
  {
    id: "lesson:aim",
    lines: [
      line("astra", "Use the right stick to aim and fire.", "Use the arrow keys to aim and fire."),
    ],
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
      line("astra", "A station! Fly into the dock to trade."),
      happy("ada", "Shopping in space!"),
    ],
    priority: "lesson",
    repeat: "never",
    trigger: { kind: "lesson", lesson: "dock" },
  },
  {
    id: "warning:shieldLow",
    lines: [line("astra", "Shield low!"), { mood: "upset", speaker: "penny", text: "Whimper..." }],
    priority: "warning",
    repeat: "fight",
    trigger: { kind: "shieldLow" },
  },
  {
    id: "warning:drones",
    lines: [line("astra", "Drones ahead."), line("ada", "I see them.")],
    priority: "warning",
    repeat: "flight",
    trigger: { kind: "drones" },
  },
  {
    id: "penny",
    lines: [happy("penny", "Woof! Woof!"), happy("ada", "Penny, did you sense something, girl?")],
    priority: "penny",
    repeat: "never",
    trigger: { kind: "penny" },
  },
  {
    id: "reaction:mapped",
    lines: [line("astra", "New place mapped."), happy("ada", "Our map is growing!")],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "mapped" },
  },
  {
    id: "reaction:capital",
    lines: [
      line("ada", "That ship is huge!"),
      line("astra", "No crew aboard. Aim for the glowing parts."),
    ],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "capital" },
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
    id: "quiet:2:dream",
    lines: [line("ada", "Do you dream, Astra?"), line("astra", "Not yet. Maybe I'll learn.")],
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
    id: "quiet:3:maps",
    lines: [line("astra", "My maps feel fuller every day."), happy("ada", "Our maps.")],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "quiet", sector: 3 },
  },
  {
    id: "quiet:3:rock",
    lines: [line("astra", "I'm glad it was you who found the rock."), happy("ada", "Me too.")],
    priority: "lore",
    repeat: "never",
    trigger: { kind: "quiet", sector: 3 },
  },
  {
    id: "general:2",
    lines: [
      line("general", "All drones: find the holodisks. Bring them to me."),
      line("astra", "That voice... I don't know why it scares me."),
    ],
    priority: "warning",
    repeat: "never",
    trigger: { kind: "general", sector: 2 },
  },
  {
    id: "general:3",
    lines: [
      line("general", "Someone is collecting my holodisks. Stop them."),
      line("ada", "Your holodisks? They're Astra's!"),
    ],
    priority: "warning",
    repeat: "never",
    trigger: { kind: "general", sector: 3 },
  },
  {
    id: "job:towAttached",
    lines: [
      line("astra", "Tow line attached. We'll be slow and heavy."),
      line("ada", "Hold on, we've got you!"),
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
  ...([1, 2, 3] as const).flatMap((sector) =>
    JOB_LORE[sector].map((text, index): Conversation => ({
      id: `jobLore:${sector}:${index}`,
      lines: [line("astra", text)],
      priority: "lore",
      repeat: "never",
      trigger: { kind: "jobLore", sector },
    })),
  ),
];
