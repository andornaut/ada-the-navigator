import type { PremiseContent } from "./types.ts";

// Narration has no speaker. Astra and the cockpit are text-only until Art supplies their visuals.
export const PREMISE: PremiseContent = {
  boarding: [
    { text: "Ada holds Penny close and touches the rock's glow." },
    { speaker: "Astra", text: "Welcome back, Navigator." },
  ],
  prologue: [
    {
      choice: "Touch the glow.",
      text: [
        "On a walk with Penny, Ada digs up an unusual rock. At home, she polishes it ",
        "until a faint pattern begins to glow.",
      ].join(""),
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
        "I was made to explore and map, but I cannot fly without a navigator. Will you ",
        "be mine?",
      ].join(""),
    },
    { text: "Ada sits in the pilot's chair and buckles Penny in beside her." },
    { choice: "Let's find your holodisk.", speaker: "Astra", text: "Quantum jump ready." },
  ],
  title: "The Glowing Rock",
};
