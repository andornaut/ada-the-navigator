import { carriedItemName } from "./itemNames.ts";
import type { ChapterContent } from "./types.ts";

/** Andromeda's approved chapter, keyed by stable galaxy id 5. */
export const ANDROMEDA_CHAPTER: ChapterContent = {
  closing: [
    "Ada and Grandma replant every seedling together. 'Accidents happen,' Grandma says.",
    "'Telling the truth is the part that counts.' Ada feels light again.",
  ].join(" "),
  dialogue: {},
  name: "The Dark Beacon",
  objectives: [
    "Explore the galaxy.",
    "Find out why ships are getting lost.",
    "Talk with Pip.",
    "Go with Pip to the settlers.",
    "Get beacon parts at the settlement with Pip.",
    "Bring beacon parts to the dark beacon.",
    "Take the holodisk from Pip.",
    "Go home to Earth when ready.",
  ],
  opening: [
    "At Grandma's house, Ada reaches past a tray of seedlings Grandma has been raising for the",
    "community garden. Her elbow catches it, and soil spills everywhere. Ada pushes the little",
    "pots back into place and says nothing.",
  ].join(" "),
  openingBranches: [
    [
      "Later, Grandma finds the spilled soil. 'I wonder what happened to my seedlings,' she says",
      "quietly. Ada's stomach twists.",
    ].join(" "),
    "It was an accident. But when Grandma looks so puzzled and sad, Ada knows that staying quiet isn't.",
  ],
  openingChoices: ["Hope nobody notices.", "Tell herself it was an accident."],
  resolution: [
    "Ada returns to the same moment, at Grandma's house. Grandma is still looking at the",
    "spilled soil. Ada takes a breath and tells her what really happened.",
  ].join(" "),
  resolutionBranches: [
    "'I'm sorry, Grandma. I knocked it over. Can I help you replant?' Grandma hands her a trowel.",
    "'I was scared you'd be upset,' Ada says. Grandma nods. 'I'd much rather know. Thank you for telling me.'",
  ],
  resolutionChoices: ["Say sorry, and offer to help.", "Explain why she stayed quiet."],
};

export interface AndromedaLine {
  readonly speaker?: string;
  readonly text: string;
}

export interface AndromedaConversation {
  readonly party: string;
  readonly lines: readonly AndromedaLine[];
  readonly questions?: readonly (AndromedaLine & { readonly label: string })[];
}

/** Optional questions never advance or gate the chapter. */
export const ANDROMEDA_CONVERSATIONS = {
  arrival: {
    lines: [
      { speaker: "Wick", text: "A traveler! Be careful. One of our guide beacons has gone dark." },
      { speaker: "Ada", text: "What's happening to the ships?" },
      {
        speaker: "Wick",
        text: "They keep getting lost. It must be Archie's drones. Everyone is scared to fly.",
      },
      { speaker: "Ada", text: "I'll look at the beacon." },
    ],
    party: "Wick",
    questions: [
      {
        label: "What do beacons do?",
        speaker: "Wick",
        text: "They guide ships between the settlements.",
      },
      {
        label: "Why are ships lost?",
        speaker: "Wick",
        text: "Without the beacons, the bright spiral is easy to get lost in.",
      },
    ],
  },
  confession: {
    lines: [
      { speaker: "Ada", text: "Pip, did you see the dent in the beacon?" },
      {
        speaker: "Pip",
        text: "You saw the dent? It was me. I was late, I flew too fast, and I clipped it.",
      },
      { speaker: "Ada", text: "Have you told anyone?" },
      { speaker: "Pip", text: "I've been too scared to tell anyone." },
      {
        speaker: "Pip",
        text: "There's something else. I found this disk floating by the beacon. It's so strange and shiny. I kept it.",
      },
      {
        speaker: "Ada",
        text: "I won't tell on you, Pip. But I'll come with you while you tell them.",
      },
    ],
    party: "Pip",
    questions: [
      {
        label: "What do you carry?",
        speaker: "Pip",
        text: "Mail between the settlements. I'm good at it, mostly. I just hurry.",
      },
      {
        label: "Will you come with me?",
        speaker: "Pip",
        text: "Yes. I'll tell them what happened.",
      },
    ],
  },
  dent: {
    lines: [
      {
        speaker: "Ada",
        text: "This beacon isn't shot. It's dented, like something bumped into it.",
      },
    ],
    party: "Astra",
  },
  holodisk: {
    lines: [
      { speaker: "Pip", text: "This belongs to your ship, doesn't it?" },
      { speaker: "Ada", text: "Yes. It's part of Astra's memory." },
      { speaker: "Pip", text: "I should have given it back right away. Here." },
      { speaker: "Ada", text: "Thank you, Pip." },
    ],
    party: "Pip",
    questions: [
      { label: "Where did you find it?", speaker: "Pip", text: "Floating by the beacon." },
      {
        label: "Why did you keep it?",
        speaker: "Pip",
        text: "It was so strange and shiny. I should have given it back.",
      },
    ],
  },
  ownsUp: {
    lines: [
      { speaker: "Pip", text: "I clipped the beacon. I was flying too fast." },
      { speaker: "Wick", text: "So it wasn't the drones at all. Thank you for telling us, Pip." },
      { speaker: "Wick", text: "Now, who can help us fix it?" },
      {
        speaker: "Pip",
        text: "I can help! Spare beacon parts are kept at the settlement. Let's go get them.",
      },
    ],
    party: "Wick",
    questions: [
      { label: "Where are the parts?", speaker: "Pip", text: "At the settlement. Come with me." },
      {
        label: "What needs fixing?",
        speaker: "Wick",
        text: "The dark guide beacon. Ships need its light.",
      },
    ],
  },
  parts: {
    lines: [{ text: carriedItemName("beacon parts") }, { text: ANDROMEDA_CHAPTER.objectives[5]! }],
    party: "Astra",
  },
  repaired: {
    lines: [
      { speaker: "Ada", text: "We brought the beacon parts." },
      { speaker: "Pip", text: "Let's fix the beacon." },
      { speaker: "Wick", text: "There. The beacon is lit again, and ships can find their way." },
      { speaker: "Ada", text: "I can see its light!" },
    ],
    party: "Wick",
    questions: [
      {
        label: "Can ships travel now?",
        speaker: "Wick",
        text: "Yes. The beacon can guide them again.",
      },
      {
        label: "What was damaged?",
        speaker: "Wick",
        text: "The beacon Pip clipped. The parts have repaired it.",
      },
    ],
  },
} as const satisfies Readonly<Record<string, AndromedaConversation>>;

/** Pip can explain the damage before Ada inspects it. */
export const ANDROMEDA_CONFESSION_WITHOUT_INSPECTION: readonly AndromedaLine[] = [
  { speaker: "Ada", text: "Pip, do you know what happened to the beacon?" },
  { speaker: "Pip", text: "It was me. I was late, I flew too fast, and I clipped it." },
];

export type AndromedaConversationId = keyof typeof ANDROMEDA_CONVERSATIONS;

/** Stable story-role ids; stations retain their real seeded station ids. */
export const ANDROMEDA_PLACES = {
  beacon: "darkBeacon",
  pip: "pip",
  settlement: "settlement",
} as const;

/** Captured destinations remain stable through Continue and subsequent chapter visits. */
export interface AndromedaProgress {
  station?: string;
  settlement?: string;
}
