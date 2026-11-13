import type { InteractionCopy } from "./conversations.ts";
import type { ChapterContent } from "./types.ts";
export const NEEDLE_CHAPTER: ChapterContent = {
  closing:
    "At the concert, Ada plays the whole song. One note wobbles, and she keeps going. " +
    "Everyone claps, and Ada is proud of every gate she threaded to get there.",
  dialogue: {},
  name: "Threading the Needle",
  objectives: [
    "Explore the galaxy.",
    "Meet Elder Loom.",
    "Light the practice gates.",
    "Light the Eye's gates.",
    "Collect the holodisk.",
    "Go home to Earth when ready.",
  ],
  opening:
    "Ada is learning the recorder for the school concert. Her song squeaks on the same " +
    "hard part every time. She puts the recorder down. 'I'm just not good at this,' she " +
    "says.",
  openingBranches: [
    "If she quits now, nobody will hear the squeaks. But nobody will hear her song either.",
    "Ada's music teacher plays so smoothly. Ada wonders if she ever squeaked too.",
  ],
  openingChoices: ["Think about quitting.", "Wonder how anyone gets good at it."],
  resolution:
    "Ada returns to the same moment, holding her recorder. She remembers Elder Loom: one " +
    "gate at a time. She picks out the hard part and plays just that, slowly.",
  resolutionBranches: [
    "Every evening, Ada plays the hard part five times, slowly. By the end of the week, it only squeaks once.",
    "Her teacher shows her how to cover the holes gently. 'Everyone squeaks at first,' she says. 'I did too.'",
  ],
  resolutionChoices: ["Practice the hard part every day.", "Ask her teacher for help."],
  resolutionRejoin: [{ speaker: "dad", text: "Sounding better every day." }],
};
export const NEEDLE_COPY: Readonly<Record<string, InteractionCopy>> = {
  arrival: {
    lines: [
      {
        speaker: "loom",
        text: "Welcome to Needle, young pilot. Our channels are narrow, and they cannot be rushed.",
      },
      { speaker: "ada", text: "I'm looking for a shining disk." },
      { speaker: "loom", text: "It drifted into the Eye, our narrowest channel." },
      { speaker: "ada", text: "How do I reach it?" },
    ],
    party: "loom",
    topics: [
      {
        label: "Who flies here?",
        lines: [
          {
            speaker: "loom",
            text: "We Avi fly between the star clouds through channels thin as thread.",
          },
        ],
      },
      {
        label: "How do pilots learn?",
        lines: [{ speaker: "loom", text: "Every pilot learns them one gate at a time." }],
      },
    ],
  },
  practice: {
    lines: [
      { speaker: "loom", text: "To reach the disk you must thread every gate, slowly." },
      { speaker: "ada", text: "Can I try a shorter channel first?" },
      { speaker: "loom", text: "Try our practice channel. Three gates. Breathe, and go slowly." },
      { speaker: "ada", text: "Three gates first. I'll take my time." },
    ],
    party: "loom",
    topics: [
      {
        label: "Why practice?",
        lines: [
          {
            speaker: "loom",
            text: "The Eye is our narrowest channel. Learn the gates here first.",
          },
        ],
      },
      {
        label: "How many practice gates?",
        lines: [{ speaker: "loom", text: "Three. One gate at a time." }],
      },
    ],
  },
  practiceComplete: {
    lines: [
      { speaker: "loom", text: "There. You learned it one gate at a time." },
      { speaker: "ada", text: "The short channel helped." },
      { speaker: "loom", text: "The Eye is waiting." },
      { speaker: "ada", text: "I'll go slowly through each gate." },
    ],
    party: "loom",
    topics: [
      {
        label: "Where is the disk?",
        lines: [{ speaker: "loom", text: "In the Eye, our narrowest channel." }],
      },
      {
        label: "Should I hurry now?",
        lines: [{ speaker: "loom", text: "No. The channels cannot be rushed." }],
      },
    ],
  },
};
/** Approved practice approaches. These change guidance, never the gate or reward rules. */
export const NEEDLE_LEARNING = {
  drones: "Drones ahead, Navigator. They've been waiting for us.",
  eyeComplete: "Eight gates! I did it, one at a time.",
  feedback: {
    label: "Tell me how I did.",
    response: "Try the first gate. I'll tell you what I notice.",
  },
  independent: {
    label: "Let me try on my own.",
    response: "All right. You can ask me for help whenever you like.",
  },
  practiceComplete: "There. You learned it one gate at a time.",
  prompt: "How would you like to practise?",
  show: {
    label: "Show me first.",
    response: "Watch the approach. Slow down before the ring, then keep your course.",
  },
  success: "That was steady. Keep that pace.",
  tooFast: "Slow down before the ring. Then try again.",
} as const;
