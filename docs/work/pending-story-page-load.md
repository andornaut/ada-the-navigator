---
id: TBD
title: Investigate the story-page main-thread load
status: approved
approved: user, 2026-11-18, structured prompt to Tech, investigate the story-page main-thread load
design: runtime
related: [ada-0298]
---

## Scope

Investigate. With 4x CPU throttle on the holodisk story page, the game's `requestAnimationFrame` callbacks take 14 to 64 ms per frame, the main thread is about 98% busy with a 33 ms median frame interval, and the holodisk swaps fire late. Find what runs per frame on story pages (Phaser scene update and render, the flight model step, the HUD, the backdrop) and whether the flight scene keeps simulating or rendering behind the storybook. Report the cause with trace evidence and one proposed fix; code changes need a separate approval.

## Criteria

- Per-frame main-thread work on the holodisk story page is attributed from throttled traces.
- One fix is proposed for the user's decision.

## Decisions

## Outcome
