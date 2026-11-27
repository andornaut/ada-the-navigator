# Completion indicators

`createCompletionIndicator` renders every read-only completion checkbox. A complete
item has a gold box and a visible checkmark. An incomplete item has a blue empty
box. The shared stylesheet and size apply identically to every consumer.

Achievements use `AchievementEntry.unlocked` in `src/ui/achievementsCard.ts`.
Quest requirements, including job objectives, use `requirement.checked` in
`src/ui/questsScreen.ts`.

Quest requirements without a boolean completion state retain their existing text
or counts. Station held, owned and selected states, galaxy selection and unlock
availability, Settings switches, shield recharge ticks and numeric progress are
not completion checkboxes. They retain their separate semantics and renderers.

The indicator does not change achievement requirements, quest progress, story
state or the quest layout. Its accessible checkbox state is read-only and does not
introduce a keyboard or pointer action.
