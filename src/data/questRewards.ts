/** Converts a persisted base quest reward to its displayed and paid Stardust amount. */
export function questReward(base: number): number {
  return 2 * (Math.ceil((2 * base) / 25) * 25);
}
