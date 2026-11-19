---
id: TBD
title: Stop each resize from leaking WebGL textures and canvases
status: approved
approved: user, 2026-11-18, find and fix the resize leak
design: runtime
related: []
---

## Scope

Each viewport resize in flight leaves canvas textures behind: live WebGL textures and canvases
created rise by about 7 per resize, and container memory by about 150 to 280 MB, until the tab is
killed at the browser check's 2 GB limit within 5 to 7 resizes. A player who rotates a phone hits
the same growth. Find what recreates them on resize and destroy or reuse what it replaces.

## Criteria

- Ten resizes between 1280x720 and 720x360 in flight keep live WebGL textures and canvases
  created flat within a small bound, and container memory flat.
- A regression test covers the fix where practical, and the browser smoke probes the ten
  resizes.

## Decisions

## Outcome
