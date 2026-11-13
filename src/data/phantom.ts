import type { ChapterContent, PremiseLine } from "./types.ts";
export const PHANTOM_DESTINATIONS = [
  "phantomSettlement1",
  "phantomSettlement2",
  "phantomSettlement3",
] as const;
export const PHANTOM_FLAGSHIP = "phantomFlagship";
export const PHANTOM_TUNING = {
  allies: 8,
  allyFireSeconds: 1.4,
  allyIntercept: 600,
  battleReach: 1500,
  blockadeReach: 600,
  encountersPerWave: 2,
  escorts: 8,
  flagshipDistance: 6000,
  formationGap: 60,
  neighborGap: 16,
  salvageStardust: 44,
  songRadius: 300,
  songSpeed: 0.75,
  waves: 3,
  whaleFollow: 250,
} as const;
export const PHANTOM_CHAPTER: ChapterContent = {
  closing:
    "Nobody remembers the schedule. Everyone remembers the rain. That night, Ada tells " +
    "Astra, 'I couldn't control any of it, and it was the best day.'",
  dialogue: {},
  name: "The Garden Party",
  objectives: [
    "Explore the galaxy.",
    "Break the drone blockades.",
    "Talk with the freed Blurbs.",
    "Fly to Archie's flagship.",
    "Disable the flagship.",
    "Salvage the last holodisk.",
    "Go home to Earth when ready.",
  ],
  opening:
    "Ada wants to thank everyone who helped her this year: Grandma, Sam, her friends, Mom " +
    "and Dad. She plans a party at the community garden, with a list for every minute.",
  openingBranches: [
    "Ada writes a schedule: games at three, cake at four, thank-yous at five. If " +
      "everything goes to plan, it will be perfect.",
    "Ada asks everyone to bring one thing. Then she writes it all down anyway, just to be sure nothing goes wrong.",
  ],
  openingChoices: ["Plan every last detail.", "Ask everyone to bring something."],
  resolution:
    "On the day, rain pours over the garden. The schedule turns to mush in Ada's hand. She " +
    "stands in the rain, watching her perfect plan wash away.",
  resolutionBranches: [
    "Ada rushes to move the games into the shed, but nothing fits. Grandma laughs and " +
      "hands her an umbrella. 'Plans are for starting, love.'",
    "Ada laughs and drops the soggy list. Sam starts a puddle race, and Dad shields the cake under his coat.",
  ],
  resolutionChoices: ["Try to save the plan.", "Let the plan go."],
};
export const PHANTOM_RESOLUTION_REJOIN: readonly PremiseLine[] = [
  {
    text:
      "Everyone crowds together in the rain. Mom passes cake, Penny shakes rain over " +
      "everyone, and nobody minds at all.",
  },
];
export const PHANTOM_CLOSING: readonly PremiseLine[] = [
  {
    speaker: "astra",
    text: "I'm whole now, Ada. I could fly anywhere. I'd like to keep flying with you.",
  },
  { speaker: "ada", text: "Always." },
];
export interface PhantomCopy {
  readonly lines: readonly Required<PremiseLine>[];
  readonly topics?: readonly {
    question: string;
    lines: readonly Required<PremiseLine>[];
  }[];
}
const line = (speaker: string, text: string): Required<PremiseLine> => ({ speaker, text });
export const PHANTOM_COPY: Readonly<Record<string, PhantomCopy>> = {
  aftermath: {
    lines: [
      line("ada", "Astra, show him your map."),
      line(
        "astra",
        "Six disks, every coordinate. There are galaxies past galaxies, Admiral. They never end.",
      ),
      line("general", "No end... No one could hold all of that."),
      line("ada", "No one has to. But you could help fix what you broke here."),
      line("general", "The Blurbs' docks. My blockades cracked them. I'll start there."),
    ],
    topics: [
      {
        lines: [line("astra", "Every coordinate. There are galaxies past galaxies.")],
        question: "What is on the map?",
      },
      {
        lines: [line("general", "The Blurbs' docks. My blockades cracked them.")],
        question: "Where will you start?",
      },
    ],
  },
  battleAllies: {
    lines: [line("astra", "That's his flagship. And Ada, look."), line("ada", "Everyone came!")],
  },
  battleAlone: {
    lines: [line("astra", "That's his flagship. It's just us."), line("ada", "Just us is enough.")],
  },
  flagshipAttack: {
    lines: [
      line("general", "Astra. Come home, and bring my disks. No one needs to get hurt."),
      line("astra", "No one will. But I'm not yours."),
    ],
  },
  flagshipDisabled: { lines: [line("general", "Enough! Take it. Take the last disk.")] },
  flagshipSalvage: {
    lines: [
      line("astra", "The last holodisk is here. I can bring it aboard."),
      line("ada", "Let's get your memory back."),
    ],
    topics: [
      { lines: [line("astra", "The last piece of my memory.")], question: "What can we collect?" },
      { lines: [line("astra", "Yes. Its weapons are down.")], question: "Is it disabled?" },
    ],
  },
  phantomSettlement1: {
    lines: [
      line("blurbs", "Blub! The drones are gone!"),
      line("ada", "Can you leave your homes now?"),
      line("blurbs", "We haven't left since the Admiral came."),
      line("ada", "The blockade here is broken."),
    ],
    topics: [
      {
        lines: [line("blurbs", "We Blurbs wobble, but we always hold together.")],
        question: "Who lives here?",
      },
      {
        lines: [line("blurbs", "The Admiral's drones. They're gone now.")],
        question: "What kept you inside?",
      },
    ],
  },
  phantomSettlement2: {
    lines: [
      line("blurbs", "You broke the blockade!"),
      line("ada", "Were travelers stuck away from home?"),
      line("blurbs", "Yes. The stranded travelers can come home now."),
      line("ada", "Then they have a way back."),
    ],
    topics: [
      {
        lines: [line("blurbs", "Yes. The blockade is broken.")],
        question: "Can travelers return?",
      },
      { lines: [line("blurbs", "The Admiral's drones.")], question: "Who blocked the way?" },
    ],
  },
  phantomSettlement3: {
    lines: [
      line("dollop", "Thank you, Navigator."),
      line("ada", "Where is the Admiral's flagship?"),
      line("dollop", "Past the dark nebula."),
      line("dollop", "We'll send word to everyone you've helped."),
    ],
    topics: [
      {
        lines: [line("dollop", "Past the dark nebula. His flagship waits there.")],
        question: "Where should I look?",
      },
      { lines: [line("dollop", "Everyone you've helped.")], question: "Who will you tell?" },
    ],
  },
};
