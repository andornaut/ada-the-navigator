import type { PremiseContent } from "./types.ts";

// Narration has no speaker.
export const PREMISE: PremiseContent = {
  boarding: [
    { text: "Ada holds Penny close and touches the rock's glow." },
    { speaker: "Astra", text: "Welcome back, Navigator." },
  ],
  boardingNewGalaxy: { speaker: "Astra", text: "Welcome back, Navigator. A new galaxy is ready." },
  emptyHome: "Penny thumps her tail. Time for another adventure?",
  gardenArrival: [
    {
      background: "grandmaGarden",
      text: [
        "Ada is twelve. She loves maps, old atlases and finding the way to places nobody ",
        "else bothers to go.",
      ].join(""),
    },
    {
      background: "grandmaGarden",
      text: [
        "Every Saturday, she and her dog Penny walk to Grandma's house, where the garden ",
        "grows a little wilder each year.",
      ].join(""),
    },
    {
      background: "grandmaGarden",
      speaker: "Grandma",
      text: "There's my navigator. Did you two take the long way again?",
    },
    {
      background: "grandmaGarden",
      speaker: "Ada",
      text: "Penny found a shortcut. It was mostly mud.",
    },
  ],
  gardenFarewell: {
    background: "grandmaGarden",
    speaker: "Grandma",
    text: "Think about it on your walk home. Good ideas like fresh air.",
  },
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
    {
      background: "park",
      text: [
        "On the way home, Penny tugs Ada off the path and sniffs hard at the roots of an ",
        "old tree.",
      ].join(""),
    },
    {
      background: "park",
      text: [
        "Penny digs. Something round glints in the dirt: a rock, smoother than any Ada ",
        "has ever seen.",
      ].join(""),
    },
    { background: "park", speaker: "Ada", text: "Good nose, Penny. Let's take it home." },
    {
      background: "adaRoomUnpolished",
      text: [
        "That evening, Ada polishes the rock at her desk. Under the dirt, thin lines ",
        "appear, like a map of somewhere far away.",
      ].join(""),
    },
    {
      background: "adaRoom",
      choice: "Touch the glow.",
      text: "The lines begin to glow. The pattern pulses softly, as if it is waiting for her.",
    },
    {
      text: [
        "Light swirls around Ada and Penny. When it fades, they are standing in a tiny ",
        "cockpit under a blue dome. Through it, colors shimmer like nowhere at all.",
      ].join(""),
    },
    { text: "Penny's tail thumps. She sniffs the two seats as if she has been here before." },
    { speaker: "Astra", text: "Hello. Please don't be afraid. I'm Astra." },
    { speaker: "Ada", text: "Who said that? Where are you?" },
    {
      speaker: "Astra",
      text: [
        "All around you. I'm an AI, the mind of this ship. You're standing inside me, in ",
        "a way.",
      ].join(""),
    },
    { speaker: "Astra", text: "What is your name, explorer?" },
    { speaker: "Ada", text: "Ada. And this is Penny." },
    {
      speaker: "Astra",
      text: [
        "Hello, Ada. Hello, Penny. The rock you found is my beacon. It waits for someone ",
        "who loves to find the way.",
      ].join(""),
    },
    { speaker: "Ada", text: "Where are we?" },
    {
      speaker: "Astra",
      text: [
        "Between dimensions. While you are aboard, no time passes on Earth. Your family ",
        "won't even know you left.",
      ].join(""),
    },
    {
      speaker: "Astra",
      text: [
        "I was made to explore and map new places. But my memory is damaged. Pieces of ",
        "it are stored on holodisks, and they were scattered across the galaxies.",
      ].join(""),
    },
    {
      speaker: "Astra",
      text: [
        "I can still jump, but I can't find my way alone. I need a navigator. Will you ",
        "be mine?",
      ].join(""),
    },
    { speaker: "Ada", text: "A real navigator? In space?" },
    {
      questions: [
        {
          answer: [
            "A disc that holds part of my memory. Each one you find helps me remember, and ",
            "shows me new places to jump.",
          ].join(""),
          question: "What's a holodisk?",
        },
        {
          answer: "I don't remember. The holodisks may help.",
          question: "How did you get to Earth?",
        },
        { answer: "There are two seats. Please strap Penny in.", question: "Can Penny come?" },
        {
          answer: "Ask me any time you're safe. I'll jump you back to the moment you left.",
          question: "How do I get home?",
        },
      ],
      speaker: "Astra",
      text: "In space. I'll fly where you steer. You choose where we go, and tell me what you see.",
    },
    {
      background: "cockpitSeated",
      text: "Ada sits in the pilot's chair and buckles Penny in beside her.",
    },
    {
      background: "cockpitSeated",
      speaker: "Astra",
      text: [
        "You steer, and you aim. My shield will protect us. If it ever fails, I'll jump ",
        "us straight back to Earth.",
      ].join(""),
    },
    {
      background: "cockpitSeated",
      choice: "Let's find your holodisk.",
      speaker: "Astra",
      text: [
        "I remember one galaxy: Sunflower. Its holodisk is somewhere there. Quantum jump ",
        "ready.",
      ].join(""),
    },
  ],
  roomRock: "Ada's rock glows softly on her desk.",
};
