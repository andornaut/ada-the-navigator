import type { PremiseContent } from "./types.ts";

// Narration has no speaker. Astra speaks without a portrait until Art supplies one.
export const PREMISE: PremiseContent = {
  boarding: [
    { text: "Ada holds Penny close and touches the rock's glow." },
    { speaker: "Astra", text: "Welcome back, Navigator." },
  ],
  boardingNewGalaxy: { speaker: "Astra", text: "Welcome back, Navigator. A new galaxy is ready." },
  emptyHome: "Penny thumps her tail. Time for another adventure?",
  holodisk: {
    handover: "We found this drifting near our outposts. Take it, with our thanks.",
    inserted: [
      { text: "Ada slides the holodisk into Astra's drive." },
      { speaker: "Astra", text: "Memory restored. I've found new coordinates." },
    ],
    memories: {
      1: "I remember a fleet... and someone giving orders.",
      2: "I carried that fleet from galaxy to galaxy. But whose fleet?",
      3: "General Gadget. I was his navigator. I scattered my holodisks to keep them from him.",
    },
    name: "Holodisk",
  },
  prologue: [
    { background: "park", text: "On a walk with Penny, Ada digs up an unusual rock." },
    {
      background: "adaRoomUnpolished",
      text: "At home, she polishes it until a faint pattern begins to glow.",
    },
    {
      background: "adaRoom",
      choice: "Touch the glow.",
      text: "The pattern pulses softly, as if it is waiting for her.",
    },
    {
      text: [
        "Light swirls around Ada and Penny. They are standing in a tiny cockpit. ",
        "Outside, colors shimmer like nowhere at all.",
      ].join(""),
    },
    { speaker: "Astra", text: "Navigator detected. Hello. I am Astra, this ship's mind." },
    { speaker: "Ada", text: "Where are we?" },
    {
      speaker: "Astra",
      text: "Between dimensions. While you are aboard, Earth's time waits for you.",
    },
    {
      speaker: "Astra",
      text: [
        "My memory is damaged. I know only one galaxy. A holodisk holding part of my ",
        "memory is somewhere there.",
      ].join(""),
    },
    {
      questions: [
        {
          answer: "I don't remember. The holodisk may help.",
          question: "How did you get to Earth?",
        },
        { answer: "There are two seats. Please strap Penny in.", question: "Can Penny come?" },
        {
          answer: "Ask me any time you're safe. I'll jump you back to the moment you left.",
          question: "How do I get home?",
        },
      ],
      speaker: "Astra",
      text: [
        "I was made to explore and map, but I can no longer fly without a navigator. ",
        "Will you be mine?",
      ].join(""),
    },
    {
      background: "cockpitSeated",
      text: "Ada sits in the pilot's chair and buckles Penny in beside her.",
    },
    {
      background: "cockpitSeated",
      choice: "Let's find your holodisk.",
      speaker: "Astra",
      text: "Quantum jump ready.",
    },
  ],
  roomRock: "Ada's rock glows softly on her desk.",
};
