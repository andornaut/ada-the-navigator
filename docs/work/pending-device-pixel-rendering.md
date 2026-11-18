---
id: TBD
title: Render art at device resolution
status: done
approved: user, 2026-11-11
design: art
related: []
---

## Scope

Set the rendering rules for device pixels: canvas backing, texture sampling per asset kind, UI text in HTML, and vector rasterization size.

## Criteria

- The canvas renders at device pixels as `Scale.NONE` through `followFrameTurn`, with sampling set per asset kind.
- UI text and chrome stay in HTML over the canvas at device resolution.
- SVGs rasterize at logical size times the fit scale times min(devicePixelRatio, 2), capped at 4 texels per logical px, and again after a 1.25 times scale change.

## Decisions

- The user approved full-resolution rendering for Ada and Chibi.

## Outcome

Shipped on `main` in d5f8a27b, 0f555f88, c9c3ff57, 42642967, fe9473f3 and f7b96813.
