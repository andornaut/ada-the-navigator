---
id: TBD
title: Fix scan receipt timing, order and placement
status: done
approved: Art review, 2026-11-18, under the user's scan-feedback contract
design: ui
related: [ada-0127]
---

## Scope

Four fixes from Art's review of the scan feedback captures, and Gameplay's receipt order
([scan feedback](../../gameplay/scan-feedback.md)). Astra's receipt line starts on the same frame
as its rectangle. The receipt ranks as a notice: a warning shows first and the receipt follows,
never dropped. The clamped start of an off-screen target stays inside the play area and clear of
the touch controls. The rise stops below the conversation box.

## Criteria

- With no warning showing, the receipt replaces the previous line on the rectangle's first frame;
  no stale line or empty box shows beside a new scan.
- A warning, such as "Drones ahead.", shows first and the receipt follows it, even when the warning
  outlasts the rise. A warning shown over a receipt interrupts it, and the receipt resumes after.
- The rectangle starts inside the play area, clear of the weapon row and of each shown stick
  target and the Use disc grown by `SPACING.gap`.
- While a conversation line shows, the rise ends `SPACING.gap` below the lowest conversation part
  above the rectangle's start in its column: the box, or the name tab when the box is not above it.
  With none, it rises as before, `SPACING.rowGap` under the HUD above it. The fade is unchanged.
- Focused tests for each; the 22 capture states at 1280x720 and 720x360 with phone insets, the
  remembered start at 1280x720 clear of the aim stick, and the Old Seed Barge warning then receipt.

## Decisions

- The receipt is a notice-rank request in `BOX_PRIORITIES`, between warnings and lessons. It shows
  over a game notice, which waits under it as under a warning, so a quest's reward notice never
  hides the receipt that announces it.
- The receipt starts as its outcome is committed instead of on the next director step.
- A conversation box shown after the path was chosen stops the rise below it. The rectangle only
  rises, so a box shown after it passed never pushes it down.

## Outcome

The receipt line shows on the rectangle's first frame in every capture state at 1280x720 and
720x360 with phone insets. At Old Seed Barge the drones' warning shows through the rise and the
receipt follows it. A centred target rises 28 logical px, to 8 below the conversation box. The
remembered start at 1280x720 sits left of the aim stick and rises 58 to 4 below the Use disc's
grown rect. At 720x360 it sits under the aim stick, clear of it, with no room to rise.
