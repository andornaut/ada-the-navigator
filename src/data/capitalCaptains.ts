/** The five uncrewed capital commanders use named radio transmissions. */
export const CAPITAL_CAPTAINS = {
  captainCadence: { name: "Captain Cadence", side: "right" },
  captainClaim: { name: "Captain Claim", side: "right" },
  captainRedact: { name: "Captain Redact", side: "right" },
  captainSounder: { name: "Captain Sounder", side: "right" },
  captainTally: { name: "Captain Tally", side: "right" },
} as const;

export type CapitalCaptain = keyof typeof CAPITAL_CAPTAINS;

export function isCapitalCaptain(speaker: string): speaker is CapitalCaptain {
  return Object.hasOwn(CAPITAL_CAPTAINS, speaker);
}
