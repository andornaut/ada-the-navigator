# Cheats

The [shared saves and cheats policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#saves-and-cheats) applies.
The user approved this list on 2026-11-18, with cheats that never touch the save.

Cheats exist only in a browser tab, never in the installed app. Ada uses the
published `runsInAppWindow` check both when opening cheats and when running an
action. Settings shows Open Cheats next to its Back button there. Open Cheats
opens the Cheats modal: a Small card (400 wide, 16 px screen margin) whose body
is one column of full-width buttons, the cheats first, then Show tips again, the
FPS counter toggle and Reset save. Its height follows its content and the body
scrolls, never pages, when it is taller than the available space. Close is the
bottom primary button.

## Cheat session

Using any cheat first saves play up to that moment, then starts a cheat
session. From then on nothing is saved, earned or banked: story progress, unlocks, ownership, levels, Stardust, ore, jobs,
achievements and statistics all stay as they were in the save before the first
cheat. Returning to the start screen from play, by Back to title or by closing and
reopening the game, ends the session; Continue then loads the save as it was
before the first cheat. No cheat grants an achievement or counts toward one, and
an unlock marks nothing cleared: no chapter, holodisk, quest, landmark or
project counts as done.

Cheats also work on the start screen: their grants apply to the cheat session
that the next Start or Continue begins, and returning to the start screen from
play ends it.

## Cheats

- **Unlock all weapons** makes Ada own Multi-Laser, Rapid Missile, Heavy
  Missile, Scattershot and Phaser, each with the three ammo packs a purchase
  includes. Levels, selection and Stardust are unchanged. Disabled once Ada owns
  every weapon.
- **Unlock all equipment** sets Shield, Engine tuning and Tractor beam to level
  3 and makes Ada own every ship paint; the selected paint stays. Disabled once
  all are at level 3 and every paint is owned.
- **Unlock all galaxies** unlocks all six route positions, so the galaxy map can
  jump to any of them. Story progress, holodisks, chapters and quests are
  unchanged, and the next boarding plays the route flight to the farthest newly
  unlocked galaxy. Disabled once every galaxy is unlocked.
- **Max weapon levels** sets every owned weapon, Laser included, to level 3.
  Disabled once every owned weapon is at level 3.
- **Add 1,000 ore** adds 1,000 to Ada's ore balance on every press.
- **Add 1,000 Stardust** adds 1,000 Stardust on every press.

## Other actions

These are not cheats and start no cheat session.

- **Show tips again** clears the record of first-flight lessons Ada has seen in
  the save, so each plays again under its normal trigger. Used during a cheat session, it
  still clears that record in the stored save, as well as in the session.
- **FPS counter** toggles a frames-per-second readout, Off by default. When On,
  it shows in the bottom-right corner of the device viewport, inset from the
  safe area and drawn above everything, letterbox bands included, so on a wide
  phone it can sit in a band. It is a display toggle, not part of the save.
- **Reset save**, last, asks first on a card titled "Reset save?" with Reset
  and Cancel; back and Escape cancel. Reset clears the whole save, achievements
  included, ends any cheat session and returns to the start screen as on a first
  launch. Device settings that are not part of the save stay.
