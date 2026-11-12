import { ACHIEVEMENTS_STYLE } from "./achievementsCard.ts";
import { CONTROL_HELP_STYLE } from "./controlHelp.ts";
import { CONVERSATION_STYLE } from "./conversation.ts";
import { DISABLED_BANNER_STYLE } from "./disabledBanner.ts";
import { GALAXY_MAP_STYLE } from "./galaxyMap.ts";
import { ITEM_NOTICE_STYLE } from "./itemNotice.ts";
import { KEEPER_STYLE } from "./keeperBlock.ts";
import { LOADING_STYLE } from "./loadingBar.ts";
import { MAP_SCREEN_STYLE } from "./mapScreen.ts";
import { NOTICE_STYLE } from "./notice.ts";
import { PAUSE_GRID_STYLE } from "./pauseCard.ts";
import { RESTART_STYLE } from "./restartCard.ts";
import { SETTINGS_STYLE } from "./settings.ts";
import { SHIP_CARD_STYLE } from "./shipCard.ts";
import { START_SCREEN_STYLE } from "./startScreen.ts";
import { STATION_STYLE } from "./station.ts";
import { STATUS_PILL_STYLE } from "./statusPill.ts";
import { STORYBOOK_STYLE } from "./storybook.ts";
import { WEAPON_STYLE } from "./weapons.ts";

// The HTML interface's whole stylesheet, which uiStylePlugin (src/tools/uiStylePlugin.ts) serves
// as a CSS module, so the page links it as a file from its own origin as the CSP's style-src
// 'self' allows. Equal-specificity rules resolve by order: the loading bar and the conversation
// box first, then the controls layer and its shared card styles (SETTINGS_STYLE holds the modal's),
// then the cards that refine them, the storybook after the shared card styles it refines.
export const UI_STYLESHEET = [
  LOADING_STYLE,
  CONVERSATION_STYLE,
  CONTROL_HELP_STYLE,
  SETTINGS_STYLE,
  NOTICE_STYLE,
  START_SCREEN_STYLE,
  STATION_STYLE,
  KEEPER_STYLE,
  WEAPON_STYLE,
  STATUS_PILL_STYLE,
  ITEM_NOTICE_STYLE,
  DISABLED_BANNER_STYLE,
  MAP_SCREEN_STYLE,
  PAUSE_GRID_STYLE,
  SHIP_CARD_STYLE,
  ACHIEVEMENTS_STYLE,
  STORYBOOK_STYLE,
  GALAXY_MAP_STYLE,
  RESTART_STYLE,
].join("\n");
