---
id: TBD
title: Stop rebuilding the restart card every frame
status: approved
approved: user, 2026-11-18, structured prompt to Tech, fix both story-page findings
design: runtime
related: []
---

## Scope

`refreshScene` closes the restart card on every frame outside the start screen, and each close rebuilds the card's layout with style reads. Close it only when it is open, so a closed card is not laid out again every frame.

## Criteria

- In flight and on story pages, a closed restart card is not laid out again per frame.
- Opening, cancelling and confirming a restart behave as before.

## Decisions

## Outcome
