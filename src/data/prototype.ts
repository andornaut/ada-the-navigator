import type { PrototypeContent } from "./types.ts";
export const PROTOTYPE: PrototypeContent = {
  chapters: {
    1: {
      closing: [
        "On planting day, neighbors bring tools, plants and time. They don't ",
        "all have to do the same thing. The garden has begun.",
      ].join(""),
      dialogue: {
        deliveryComplete: {
          speaker: "Workshop",
          text: [
            "Now we can repair the growers' equipment. We'll arrange the next ",
            "exchange ourselves. Thank you for introducing us!",
          ].join(""),
        },
        grower: {
          optional: [
            "We could grow more with help. We haven't spoken much with the other ",
            "outposts.",
          ].join(""),
          speaker: "Grower",
          text: [
            "A visitor! We grow food here, but our equipment needs repairs. ",
            "There's a workshop out here somewhere. Would you take them some food ",
            "and ask for help?",
          ].join(""),
        },
        salvager: {
          optional: [
            "We recover things people have lost or left behind. Plenty can be ",
            "used again.",
          ].join(""),
          speaker: "Salvager",
          text: [
            "Useful tools! We have parts to spare, but our food is running low. ",
            "You know some growers? Take these parts to the workshop. We'll ",
            "contact the growers.",
          ].join(""),
        },
        workshop: {
          optional: [
            "We repair tools, ships and growing equipment. Spare parts make a ",
            "difference!",
          ].join(""),
          speaker: "Workshop",
          text: [
            "We can repair their equipment. We're short of parts, though. The ",
            "salvagers might have what we need. Take them this tool kit.",
          ].join(""),
        },
      },
      name: "The Outposts",
      objectives: [
        "Explore the sector.",
        "Take food from the growers to the workshop.",
        "Take the workshop's tool kit to the salvagers.",
        "Bring spare parts from the salvagers to the workshop.",
        "Return to Toronto when ready.",
      ],
      opening: [
        "Ada has gardened with her grandmother since she was little. Today, ",
        "her grandmother mentions a nearby community garden that never got ",
        "started. Its organizer needs help, but nobody can look after ",
        "everything.",
      ].join(""),
      openingChoices: ["What kind of help do they need?", "I'd like to meet the organizer."],
      resolution: [
        "Back in Toronto, Ada asks which jobs need doing. The organizer lists ",
        "planting, finding tools, watering and teaching new gardeners. Her ",
        "grandmother offers to help people learn.",
      ].join(""),
      resolutionChoices: ["Ask what each person can offer.", "Divide the work into smaller jobs."],
    },
    2: {
      closing: [
        "Ada and her friends include the child. When the behavior happens ",
        "again, they stay supportive instead of leaving them alone.",
      ].join(""),
      dialogue: {
        approach: {
          speaker: "Regular visitor",
          text: [
            "There's room for everyone here. Let them dock. We are staying. The ",
            "miner approaches with company, docks and unloads. 'Thank you for ",
            "staying. See you next trip.'",
          ].join(""),
        },
        firstDeposit: {
          speaker: "Ada",
          text: [
            "That pilot cut across the miner's approach and made them retreat. ",
            "There are free docks. Why won't they let that miner through?",
          ].join(""),
        },
        hub: {
          optional: [
            "Independent miners bring resources here for transport. There is ",
            "docking space for everyone.",
          ].join(""),
          speaker: "Station",
          text: [
            "Welcome. Shoot resource rocks and collect what they release. Bring ",
            "cargo here to deposit it. Partial loads count, and you can travel ",
            "back when you're out of danger.",
          ].join(""),
        },
        miner: {
          optional: "I know how to dock. I just need them to stop blocking me.",
          speaker: "Miner",
          text: [
            "It keeps happening. I've started waiting until they're gone. Would I ",
            "like company next time? Yes. That would help.",
          ].join(""),
        },
        visitors: {
          speaker: "Regular visitor",
          text: [
            "I've seen it. I didn't know what to do. I'll come in with you. We ",
            "can make room and stay nearby.",
          ].join(""),
        },
      },
      name: "The Mining Hub",
      objectives: [
        "Explore the sector.",
        "Mine resource rocks and deposit cargo at the hub.",
        "Keep depositing resources and talk with the miner.",
        "Speak with regular visitors about approaching together.",
        "Join the miner's approach at the hub.",
        "Return to Toronto when ready.",
      ],
      opening: [
        "At school, Ada sees a child being pushed out of a playground game. ",
        "Other children look away. There is no excuse for treating someone ",
        "that way. Ada wonders who else noticed.",
      ].join(""),
      openingChoices: ["Notice who might help.", "Think about how to offer support."],
      resolution: [
        "Back at school, Ada speaks privately with the child: 'I saw what ",
        "happened. Would you like to join us?' They would. Ada talks with her ",
        "friends about making room and refusing to laugh along.",
      ].join(""),
      resolutionChoices: ["Make room in the game.", "Sit together and invite friends over."],
    },
    3: {
      closing: [
        "Ada takes the dog out and gives it time to stop, sniff and explore. ",
        "Caring means making time for what the dog needs.",
      ].join(""),
      dialogue: {
        family: {
          speaker: "Whale family",
          text: [
            "Have you seen someone traveling alone? We've been searching. They're ",
            "safe? Please share our coordinates so they can find us.",
          ].join(""),
        },
        freed: {
          optional: [
            "The young ones learn our routes from us. I like familiar voices and ",
            "finding places I haven't seen before.",
          ].join(""),
          speaker: "Whale",
          text: [
            "That's better. Thank you. But I don't know where my family went. ",
            "Would you look for them? They'll be searching for me too.",
          ].join(""),
        },
        reunion: {
          speaker: "Whale",
          text: [
            "You found my family! Now I know where to go. Thank you for ",
            "listening. The whale departs, and soon the family is traveling ",
            "together again.",
          ].join(""),
        },
        trapped: {
          speaker: "Ada",
          text: "A whale in space! I'll clear those rocks. My shots won't hurt you.",
        },
        whale: {
          optional: [
            "We travel through space together. There are places we visit and ",
            "currents we follow.",
          ].join(""),
          speaker: "Whale",
          text: [
            "Can you hear me? I can't get through these rocks. Yes, I'm a whale, ",
            "and I can talk. Could you help clear a way?",
          ].join(""),
        },
      },
      name: "The Whale Family",
      objectives: [
        "Explore the sector.",
        "Shoot the debris blocking the whale.",
        "Talk with the freed whale.",
        "Explore to find the whale's family.",
        "Return to the whale and share the coordinates.",
        "Return to Toronto when ready.",
      ],
      opening: [
        "The dog waits by the door. It's time for a walk, but Ada would ",
        "rather keep playing. 'Nobody has to take me for a walk,' she ",
        "complains. She loves her dog, but hasn't considered how much it ",
        "depends on her.",
      ].join(""),
      openingChoices: ["Wonder why walks matter so much.", "Think about what the dog can choose."],
      resolution: [
        "Ada returns to the same moment. The dog is still waiting. She ",
        "remembers the whale's wish to move, explore and find its family. Her ",
        "dog needs opportunities to experience the world too.",
      ].join(""),
      resolutionChoices: ["Get the lead.", "Let's go exploring."],
    },
  },
  labels: {
    actionButtons: "Interact: Use or Space. Pause: Escape.",
    aimControls: "Aim and fire: right stick or arrow keys",
    ammo: "Ammo",
    askMore: "Ask more",
    cargo: "Cargo",
    cargoFull: "Cargo full. Deposit at the station when ready.",
    chapterComplete: "Chapter complete. You can keep exploring.",
    close: "Close",
    continue: "Continue",
    deferred: "Sector four: story in development",
    deliver: "Deliver",
    deposit: "Deposit",
    destinations: "Discovered destinations",
    home: "Ada the Navigator",
    moveControls: "Move: left stick or WASD",
    nearbyDiscovery: "Nearby discovery",
    objective: "Objective",
    resume: "Resume",
    screenShake: "Screen shake",
    settings: "Settings",
    shield: "Shield",
    shieldDepleted: "Your ship brought you home. Your story progress is saved.",
    sound: "Sound effects",
    start: "Begin",
    talk: "Talk",
    toronto: "Toronto",
    travel: "Travel",
    travelUnavailable: "Travel is unavailable while you are in danger.",
    use: "Use",
    weapon: "Weapon",
    weaponBasic: "Basic",
    weaponPierce: "Piercing",
    weaponRapid: "Rapid fire",
    weaponSpread: "Spread",
  },
  // Provisional starting values for playtesting, not fixed balance requirements.
  tuning: {
    accelerationSeconds: 0.18,
    brakingSeconds: 0.22,
    cargoCapacity: 12,
    chunkSize: 512,
    dangerReleaseSeconds: 3,
    encounterFreshDistance: 600,
    enemyDamage: 6,
    enemyProjectileSpeed: 150,
    fireInterval: { basic: 0.28, pierce: 0.5, rapid: 0.12, spread: 0.4 },
    flight: {
      damageInterval: 1,
      enemyFireInterval: 2.5,
      enemyHp: 2,
      enemyProjectileLifetime: 4,
      enemyRadius: 14,
      engagementChunks: 1,
      objectsPerChunk: 5,
      pickupRadius: 10,
      pickupReach: 14,
      pieceRadius: 7,
      piecesPerRock: 3,
      playerShotDamage: 1,
      projectileLifetime: 2,
      projectileSpeedFactor: 3,
      pursuitSpeedFactor: 0.55,
      rockHp: 3,
      rockRadius: 20,
      shipRadius: 10,
      spawnWeights: { enemy: 0.1, pickup: 0.12, resource: 0.4, rock: 0.38 },
      spreadAngle: 0.22,
    },
    introFreshDistance: 10800,
    maxSpeed: 180,
    miningMilestones: [12, 24, 36],
    safeRadius: 160,
    shieldMax: 100,
    shieldRechargeDelay: 3,
    shieldRechargeRate: 18,
    weaponAmmo: { pierce: 20, rapid: 40, spread: 24 },
    whaleDebris: { count: 3, hp: 3, radius: 24, spacing: 60 },
  },
};
