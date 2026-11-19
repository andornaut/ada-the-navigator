---
id: TBD
title: Keep Show tips again effective in the stored save during a cheat session
status: done
approved: policy 0b35005, owner-attested by Gameplay, 2026-11-19
design: cheats
related: [ada-0311]
---

## Scope

Show tips again is not a cheat. During a cheat session it clears the seen first-flight lessons in
the stored pre-cheat save as well as in the session.

## Criteria

- In a session, Show tips again clears the lessons record in the stored save.
- After Back to title, the restored save has the lessons cleared and nothing else changed.

## Decisions

- The write loads the stored save, clears only its lessons record and saves it past the
  session's suspended `flushScene`; the session's own pre-cheat copy is cleared too.
- Ending the session waits for that write, so the restore reads the cleared save.

## Outcome

`showTipsAgain` in `src/game/sceneUi.ts` writes the cleared lessons through to the stored
pre-cheat save during a cheat session and clears the session's copy; `endCheatSession` waits for
it. `withoutSeenLessons` in `src/model/game.ts` clears only the lessons record.
