---
id: TBD
title: Draw a maskable app icon with safe-zone padding
status: approved
approved: user, 2026-11-18, real maskable icon
design: art
related: []
---

## Scope

Replace `public/art/app-icon/icon-maskable-512.png`, today a copy of `icon-512.png`, with a maskable variant whose artwork sits inside the safe zone Android masks to, produced by `art/tools/app-icon.ts`.

## Criteria

- All artwork lies inside the central 80% circle; the background fills the full square.
- The icon reads correctly under circle, squircle and rounded-square masks.

## Decisions

## Outcome
