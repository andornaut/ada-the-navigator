import { lineDuration } from "./conversations.ts";

/** Short numeric resource and ammunition feedback, in milliseconds. */
export const HUD_TICK_TIMING = {
  normal: { fadeMs: 300, holdMs: 600 },
  reduced: { fadeMs: 150, holdMs: 750 },
} as const;

/** Time to read visual flight notices. The fade is part of the reading time. */
export function visualNoticeTiming(
  kind: "brief" | "reading",
  text: string,
): { readonly fadeMs: number; readonly holdMs: number } {
  const fadeMs = 500;
  return { fadeMs, holdMs: kind === "brief" ? 2000 : lineDuration(text) * 1000 - fadeMs };
}

/** The notices' timing in ms (art/layout.md "Item notice"). */
export const NOTICE_TIMING = {
  appearMs: 180,
  fadeMs: 300,
  /** The next notice appears this long after the previous one fades. */
  gap: 120,
  holdMs: 1200,
  /** A hold while another notice waits. */
  holdWaitingMs: 600,
  /** Under reduced motion: fade in, hold, fade out, in place. */
  reducedFadeMs: 150,
} as const;
