---
id: TBD
title: Round generated SVG coordinates to one decimal and minify
status: approved
approved: user, 2026-11-18, download size (policy 820117b)
design: art
related: []
---

## Scope

Round coordinates in every Art producer's generated SVG to one decimal, unless a set proves it needs more, and minify the output.

## Criteria

- Generated SVG coordinates carry at most one decimal; any set kept at higher precision is named with its reason.
- Rendered frames differ from the current ones by no more than sub-pixel antialiasing at 1280x720 and 720x360.
- Compressed SVG bytes drop by about 18%.

## Decisions

## Outcome
