import actionGroupCss from "@andornaut/game-kit/runtime/web/ui/dom/actionGroup.css?raw";
import hudDiscCss from "@andornaut/game-kit/runtime/web/ui/dom/hudDisc.css?raw";
import layoutTreeCss from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree.css?raw";

import { ACHIEVEMENTS_STYLE } from "./achievements/index.ts";
import { BOSS_HUD_STYLE } from "./bossHud.ts";
import { COMPLETION_INDICATOR_STYLE } from "./completionIndicator.ts";
import { CONTROL_HELP_STYLE } from "./controlHelp.ts";
import { CONVERSATION_STYLE } from "./conversation.ts";
import { DISABLED_BANNER_STYLE } from "./disabledBanner.ts";
import { GALAXY_MAP_STYLE } from "./galaxy/index.ts";
import { ITEM_NOTICE_STYLE } from "./itemNotice.ts";
import { KEEPER_STYLE } from "./keeperBlock.ts";
import { UNLISTED_COLOURS } from "./layout/colours.ts";
import { ADA_CONTROL_PRESENTATION_STYLE } from "./layout/controlPresentation.ts";
import { DETAIL_CARD_STYLE } from "./layout/detailCard.ts";
import { FPS_STYLE } from "./layout/fpsCounter.ts";
import { NAVIGATION_BUTTON_STYLE } from "./layout/navigationButton.ts";
import { PAUSE_GRID_STYLE } from "./layout/pauseCard.ts";
import { QUESTS_SCREEN_STYLE } from "./layout/questsScreen.ts";
import { SHIP_CARD_STYLE } from "./layout/shipCard.ts";
import { STATION_STYLE } from "./layout/stationStyle.ts";
import { LOADING_STYLE } from "./loadingBar.ts";
import { MAP_SCREEN_STYLE } from "./map/index.ts";
import { NOTICE_STYLE } from "./notice.ts";
import { PENNY_MARKERS_STYLE } from "./pennyMarkers.ts";
import { RESTART_STYLE } from "./restartCard.ts";
import { SETTINGS_STYLE } from "./settings.ts";
import { START_SCREEN_STYLE } from "./startScreen.ts";
import { STATUS_PILL_STYLE } from "./statusPill.ts";
import { STORYBOOK_STYLE } from "./story/index.ts";
import { WEAPON_STYLE } from "./weapons.ts";

// The page's inherited text colour and its ground under the game.
const PAGE_STYLE = `:root{color:${UNLISTED_COLOURS.pageText};background:${UNLISTED_COLOURS.pageBackground}}`;

// The HTML interface's whole stylesheet, which uiStylePlugin (src/build/uiStylePlugin.ts) serves
// as a CSS module, so the page links it as a file from its own origin as the CSP's style-src
// 'self' allows. Equal-specificity rules resolve by order: the loading bar and the conversation
// box first, then the controls layer and its shared card styles (SETTINGS_STYLE holds the modal's),
// then the cards that refine them, the storybook after the shared card styles it refines.
export const UI_STYLESHEET = [
  layoutTreeCss,
  actionGroupCss,
  hudDiscCss,
  PAGE_STYLE,
  COMPLETION_INDICATOR_STYLE,
  LOADING_STYLE,
  CONVERSATION_STYLE,
  CONTROL_HELP_STYLE,
  SETTINGS_STYLE,
  NAVIGATION_BUTTON_STYLE,
  ADA_CONTROL_PRESENTATION_STYLE,
  NOTICE_STYLE,
  START_SCREEN_STYLE,
  STATION_STYLE,
  KEEPER_STYLE,
  WEAPON_STYLE,
  DETAIL_CARD_STYLE,
  STATUS_PILL_STYLE,
  BOSS_HUD_STYLE,
  ITEM_NOTICE_STYLE,
  DISABLED_BANNER_STYLE,
  PENNY_MARKERS_STYLE,
  MAP_SCREEN_STYLE,
  PAUSE_GRID_STYLE,
  QUESTS_SCREEN_STYLE,
  SHIP_CARD_STYLE,
  ACHIEVEMENTS_STYLE,
  STORYBOOK_STYLE,
  GALAXY_MAP_STYLE,
  RESTART_STYLE,
  FPS_STYLE,
].join("\n");
