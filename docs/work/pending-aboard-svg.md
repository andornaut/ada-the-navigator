---
id: TBD
title: Ship the aboard backdrop set as SVG
status: approved
approved: user, 2026-11-18, aboard set to SVG
design: art
related: [ada-0285, ada-0191]
---

## Scope

Produce `aboard`, `aboard-emergency` and the four holodisk overlays as SVG from the shared vector ship model, with their glows, haze and blur as SVG gradients and filters, in place of the PNGs. This takes `aboard.png` and `aboard-emergency.png` out of the WebP scope of ada-0285, which keeps the story scenes and `route-sky.png`.

## Criteria

- The SVGs match the current PNGs at display size at 1280x720 and 720x360 within antialiasing and blur differences, compared side by side, with any visible difference disclosed.
- Compressed bytes for the set drop from about 0.86 MB to about 0.15 MB or less.
- Load-time rasterization stays within Tech's measured budget on a mid-range phone.

## Decisions

- SVG over lossy WebP for the aboard set: the art is vector, so SVG is smaller and sharper on high-density screens.

## Outcome
