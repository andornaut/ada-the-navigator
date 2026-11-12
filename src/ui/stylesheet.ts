import { ACHIEVEMENTS_STYLE } from "./achievements-card.ts";
import { CONTROL_HELP_STYLE } from "./control-help.ts";
import { CONVERSATION_STYLE } from "./conversation.ts";
import { DISABLED_BANNER_STYLE } from "./disabled-banner.ts";
import { ITEM_NOTICE_STYLE } from "./item-notice.ts";
import { LOADING_STYLE } from "./loading-bar.ts";
import { MAP_SCREEN_STYLE } from "./map-screen.ts";
import { NOTICE_STYLE } from "./notice.ts";
import { PAUSE_GRID_STYLE } from "./pause-card.ts";
import { RESTART_STYLE } from "./restart-card.ts";
import { ROUTE_MAP_STYLE } from "./route-map.ts";
import { SETTINGS_STYLE } from "./settings.ts";
import { SHIP_CARD_STYLE } from "./ship-card.ts";
import { START_SCREEN_STYLE } from "./start-screen.ts";
import { STATION_STYLE } from "./station.ts";
import { STATUS_PILL_STYLE } from "./status-pill.ts";
import { STORYBOOK_STYLE } from "./storybook.ts";
import { WEAPON_STYLE } from "./weapons.ts";

// The HTML interface's whole stylesheet, which uiStylePlugin (src/tools/ui-style-plugin.ts) serves
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
  WEAPON_STYLE,
  STATUS_PILL_STYLE,
  ITEM_NOTICE_STYLE,
  DISABLED_BANNER_STYLE,
  MAP_SCREEN_STYLE,
  PAUSE_GRID_STYLE,
  SHIP_CARD_STYLE,
  ACHIEVEMENTS_STYLE,
  STORYBOOK_STYLE,
  ROUTE_MAP_STYLE,
  RESTART_STYLE,
].join("\n");
