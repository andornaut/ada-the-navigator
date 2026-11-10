import type { PrototypeContent } from "./types.ts";

export const PROTOTYPE: PrototypeContent = {
  chapters: {
    1: {
      name: "The Outposts",
      opening:
        "Ada has gardened with her grandmother since she was little. Today, her grandmother mentions a nearby community garden that never got started. Its organizer needs help, but nobody can look after everything.",
      openingChoices: ["What kind of help do they need?", "I'd like to meet the organizer."],
      resolution:
        "Back in Toronto, Ada asks which jobs need doing. The organizer lists planting, finding tools, watering and teaching new gardeners. Her grandmother offers to help people learn.",
      resolutionChoices: ["Ask what each person can offer.", "Divide the work into smaller jobs."],
      closing:
        "On planting day, neighbors bring tools, plants and time. They don't all have to do the same thing. The garden has begun.",
      objectives: [
        "Explore the sector.",
        "Take food from the growers to the workshop.",
        "Take the workshop's tool kit to the salvagers.",
        "Bring spare parts from the salvagers to the workshop.",
        "Return to Toronto when ready.",
      ],
      dialogue: {
        grower: {
          speaker: "Grower",
          text: "A visitor! We grow food here, but our equipment needs repairs. There's a workshop out here somewhere. Would you take them some food and ask for help?",
          optional: "We could grow more with help. We haven't spoken much with the other outposts.",
        },
        workshop: {
          speaker: "Workshop",
          text: "We can repair their equipment. We're short of parts, though. The salvagers might have what we need. Take them this tool kit.",
          optional: "We repair tools, ships and growing equipment. Spare parts make a difference!",
        },
        salvager: {
          speaker: "Salvager",
          text: "Useful tools! We have parts to spare, but our food is running low. You know some growers? Take these parts to the workshop. We'll contact the growers.",
          optional: "We recover things people have lost or left behind. Plenty can be used again.",
        },
        deliveryComplete: {
          speaker: "Workshop",
          text: "Now we can repair the growers' equipment. We'll arrange the next exchange ourselves. Thank you for introducing us!",
        },
      },
    },
    2: {
      name: "The Mining Hub",
      opening:
        "At school, Ada sees a child being pushed out of a playground game. Other children look away. There is no excuse for treating someone that way. Ada wonders who else noticed.",
      openingChoices: ["Notice who might help.", "Think about how to offer support."],
      resolution:
        "Back at school, Ada speaks privately with the child: 'I saw what happened. Would you like to join us?' They would. Ada talks with her friends about making room and refusing to laugh along.",
      resolutionChoices: ["Make room in the game.", "Sit together and invite friends over."],
      closing:
        "Ada and her friends include the child. When the behavior happens again, they stay supportive instead of leaving them alone.",
      objectives: [
        "Explore the sector.",
        "Mine resource rocks and deposit cargo at the hub.",
        "Keep depositing resources and talk with the miner.",
        "Speak with regular visitors about approaching together.",
        "Join the miner's approach at the hub.",
        "Return to Toronto when ready.",
      ],
      dialogue: {
        hub: {
          speaker: "Station",
          text: "Welcome. Shoot resource rocks and collect what they release. Bring cargo here to deposit it. Partial loads count, and you can travel back when you're out of danger.",
          optional: "Independent miners bring resources here for transport. There is docking space for everyone.",
        },
        firstDeposit: {
          speaker: "Ada",
          text: "That pilot cut across the miner's approach and made them retreat. There are free docks. Why won't they let that miner through?",
        },
        miner: {
          speaker: "Miner",
          text: "It keeps happening. I've started waiting until they're gone. Would I like company next time? Yes. That would help.",
          optional: "I know how to dock. I just need them to stop blocking me.",
        },
        visitors: {
          speaker: "Regular visitor",
          text: "I've seen it. I didn't know what to do. I'll come in with you. We can make room and stay nearby.",
        },
        approach: {
          speaker: "Regular visitor",
          text: "There's room for everyone here. Let them dock. We are staying. The miner approaches with company, docks and unloads. 'Thank you for staying. See you next trip.'",
        },
      },
    },
    3: {
      name: "The Whale Family",
      opening:
        "The dog waits by the door. It's time for a walk, but Ada would rather keep playing. 'Nobody has to take me for a walk,' she complains. She loves her dog, but hasn't considered how much it depends on her.",
      openingChoices: ["Wonder why walks matter so much.", "Think about what the dog can choose."],
      resolution:
        "Ada returns to the same moment. The dog is still waiting. She remembers the whale's wish to move, explore and find its family. Her dog needs opportunities to experience the world too.",
      resolutionChoices: ["Get the lead.", "Let's go exploring."],
      closing:
        "Ada takes the dog out and gives it time to stop, sniff and explore. Caring means making time for what the dog needs.",
      objectives: [
        "Explore the sector.",
        "Shoot the debris blocking the whale.",
        "Talk with the freed whale.",
        "Explore to find the whale's family.",
        "Return to the whale and share the coordinates.",
        "Return to Toronto when ready.",
      ],
      dialogue: {
        whale: {
          speaker: "Whale",
          text: "Can you hear me? I can't get through these rocks. Yes, I'm a whale, and I can talk. Could you help clear a way?",
          optional: "We travel through space together. There are places we visit and currents we follow.",
        },
        trapped: {
          speaker: "Ada",
          text: "A whale in space! I'll clear those rocks. My shots won't hurt you.",
        },
        freed: {
          speaker: "Whale",
          text: "That's better. Thank you. But I don't know where my family went. Would you look for them? They'll be searching for me too.",
          optional: "The young ones learn our routes from us. I like familiar voices and finding places I haven't seen before.",
        },
        family: {
          speaker: "Whale family",
          text: "Have you seen someone traveling alone? We've been searching. They're safe? Please share our coordinates so they can find us.",
        },
        reunion: {
          speaker: "Whale",
          text: "You found my family! Now I know where to go. Thank you for listening. The whale departs, and soon the family is traveling together again.",
        },
      },
    },
  },
  labels: {
    home: "Ada the Navigator",
    start: "Begin",
    resume: "Resume",
    settings: "Settings",
    close: "Close",
    moveControls: "Move: left stick or WASD",
    aimControls: "Aim and fire: right stick or arrow keys",
    actionButtons: "Interact: Use or Space. Pause: Escape.",
    use: "Use",
    talk: "Talk",
    deliver: "Deliver",
    deposit: "Deposit",
    continue: "Continue",
    travel: "Travel",
    toronto: "Toronto",
    destinations: "Discovered destinations",
    travelUnavailable: "Travel is unavailable while you are in danger.",
    cargoFull: "Cargo full. Deposit at the station when ready.",
    shieldDepleted: "Your ship brought you home. Your story progress is saved.",
    deferred: "Story in development",
    chapterComplete: "Chapter complete. You can keep exploring.",
    shield: "Shield",
    cargo: "Cargo",
    weapon: "Weapon",
    ammo: "Ammo",
    objective: "Objective",
    resetConfirm: "Start over? This removes your saved progress.",
  },
  // Provisional starting values for playtesting, not fixed balance requirements.
  tuning: {
    chunkSize: 512,
    maxSpeed: 180,
    accelerationSeconds: 0.18,
    brakingSeconds: 0.22,
    shieldMax: 100,
    shieldRechargeDelay: 3,
    shieldRechargeRate: 18,
    enemyDamage: 12,
    enemyProjectileSpeed: 150,
    fireInterval: { basic: 0.28, rapid: 0.12, spread: 0.4, pierce: 0.5 },
    weaponAmmo: { rapid: 40, spread: 24, pierce: 20 },
    cargoCapacity: 12,
    miningMilestones: [12, 24, 36],
    introFreshDistance: 900,
    encounterFreshDistance: 600,
    safeRadius: 160,
    dangerReleaseSeconds: 3,
  },
};
