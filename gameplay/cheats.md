# Cheats

The [shared saves and cheats policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#saves-and-cheats) applies.
Ada opens cheats through Settings and uses the published `runsInAppWindow` check
both when opening cheats and when executing an action.

The approved action is **Grant all weapons**, in Run-only. No save-changing action
is specified. Hide a group that has no actions.

Grant all weapons idempotently adds Multi-Laser, Rapid Missile, Heavy Missile, Scattershot and Phaser to the
current flight's loadout only. The grants are not added to permanent weapon
ownership or permanent ammunition, and do not change levels or Stardust. Each
granted weapon gets its three included packs for the current flight. The grants
and their remaining ammunition stay in the current resumable flight through
normal saving and Continue, and end with that flight. Selection, shield, story,
cargo and fire cooldown remain unchanged. A granted weapon lost in a quantum jump
home costs nothing beyond the flight.

Without an active flight, disable the grant action. It must not launch a flight.
