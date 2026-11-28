/** Approved explicit landmark interaction and first visible-landmark instruction. */
export const LANDMARK_SCAN_COPY = {
  action: "Scan",
  instruction: "Fly closer, then press {useIcon} to scan it.",
  outcomeLead: "A job is waiting at {station}. Look for its marker on the map.",
  outcomePatrol: "Drones are patrolling nearby. Give them room.",
  outcomeQuest: "Quest complete: {quest}.",
  outcomeRecoveredWreck: "I recovered supplies from the wreck.",
  outcomeRemembered: "We've already scanned {target}.",
  outcomeSalvage: "There's a disabled ship here. Get close and use Salvage.",
  outcomeScan: "Scan complete: {target}.",
  outcomeTask: "Task complete: {task}.",
  surveyAbout: "Fly close and scan it.",
} as const;
