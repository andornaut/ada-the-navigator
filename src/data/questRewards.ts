/** Converts a persisted base quest reward to its displayed and paid Stardust amount. */
export function questReward(base: number): number {
  return Math.ceil((3 * base) / 25) * 25;
}
