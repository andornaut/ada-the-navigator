/** Approved explicit landmark interaction and first visible-landmark instruction. */
export const LANDMARK_SCAN_COPY = {
  action: "Scan",
  instruction: "Fly closer, then press {useIcon} to scan it.",
  outcomeLead: "Someone needs help. The job is at {station}.",
  outcomeQuest: "Quest complete: {quest}.",
  outcomeRemembered: "We've already scanned {target}.",
  outcomeScan: "Scan complete: {target}.",
  outcomeTask: "Task complete: {task}.",
  surveyAbout: "Fly close and scan it.",
} as const;
