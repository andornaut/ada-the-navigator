---
id: TBD
title: Skip the flight scene's drawing and rendering behind storybook pages
status: approved
approved: user, 2026-11-18, structured prompt to Tech, fix both story-page findings
design: runtime
related: []
---

## Scope

While a storybook page covers the game area and shows no galaxy backdrop, skip `refreshScene`, `draw` and `renderConversation` and stop Phaser rendering, so the canvas is not presented. `model.storyTick` and the save flush keep running, and everything resumes when the page closes. Aboard pages that show a galaxy backdrop keep drawing only the backdrop.

## Criteria

- At 4x CPU throttle on the holodisk page, the trace shows no WebGL canvas copy and `requestAnimationFrame` callbacks stay under about 2 ms.
- Story timing, saves and the return to flight are unchanged, and aboard pages still show their galaxy backdrop.

## Decisions

## Outcome
