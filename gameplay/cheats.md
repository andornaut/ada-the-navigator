# Cheats

The [shared saves and cheats policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#saves-and-cheats) applies.
The user approved this list on 2026-11-18.

Cheats exist only in a browser tab, never in the installed app. Ada uses the
published `runsInAppWindow` check both when opening cheats and when running an
action. Settings shows Open Cheats next to its Back button there. Open Cheats
opens the Cheats modal: a Small card (400 wide, 16 px screen margin) whose body
is one column of full-width buttons under the Run-only and Save-changing
headings. Its height follows its content and the body scrolls, never pages,
when it is taller than the available space. Close is the bottom primary button.
A group with no actions is hidden.

No cheat grants an achievement, counts toward one or adds statistics, and an
unlock marks nothing cleared: no chapter, holodisk, quest, landmark or project
counts as done.

## Run-only

Run-only actions change only the current flight and never the save's progress.

- **Grant all weapons** idempotently adds every weapon Ada does not own
  (Multi-Laser, Rapid Missile, Heavy Missile, Scattershot and Phaser) to the
  current flight's loadout only, each with its three included packs. The grants
  are not added to permanent weapon ownership or permanent ammunition, and do
  not change levels or Stardust. The grants and their remaining ammunition stay
  in the current resumable flight through normal saving and Continue, and end
  with that flight. Selection, shield, story, cargo and fire cooldown remain
  unchanged. A granted weapon lost in a quantum jump home costs nothing beyond
  the flight. Without an active flight, or once Ada owns every weapon, the
  action is disabled; it never launches a flight.

## Save-changing

Save-changing actions write the save at once.

- **Unlock all weapons** makes Ada own Multi-Laser, Rapid Missile, Heavy
  Missile, Scattershot and Phaser. Each newly owned weapon gets the three ammo
  packs a purchase includes; a weapon already granted for the current flight
  becomes owned and keeps its current ammunition instead. Levels, selection and
  Stardust are unchanged. Disabled once Ada owns every weapon.
- **Unlock all equipment** sets Shield, Engine tuning and Tractor beam to level
  3 and makes Ada own every ship paint; the selected paint stays. Disabled once
  all are at level 3 and every paint is owned.
- **Unlock all galaxies** unlocks all six route positions, so the galaxy map can
  jump to any of them. Story progress, holodisks, chapters and quests are
  unchanged, and the next boarding plays the route flight to the farthest newly
  unlocked galaxy. Disabled once every galaxy is unlocked.
- **Max weapon levels** sets every owned weapon, Laser included, to level 3.
  Disabled once every owned weapon is at level 3.
- **Add 1,000 ore** adds 1,000 to Ada's ore balance on every press, with or
  without an active flight.
- **Add 1,000 Stardust** adds 1,000 Stardust on every press.
- **Show tips again** clears the record of first-flight lessons Ada has seen,
  so each plays again under its normal trigger.
- **Reset save**, last, asks first on a card titled "Reset save?" with Reset
  and Cancel; back and Escape cancel. Reset clears the whole save, achievements
  and every cheat grant included, and returns to the start screen as on a first
  launch. Device settings that are not part of the save stay.

## FPS counter

The Cheats modal also has an FPS counter toggle, Off by default. When On, the
game shows its frames per second in the bottom-right corner of the device
viewport, inset from the safe area and drawn above everything, letterbox bands
included, so on a wide phone it can sit in a band. It is a display toggle, not a save change.
