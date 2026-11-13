import { units } from "./css.ts";
import { SHIP_CARD } from "./shipCard.ts";
import { SPACING } from "./tokens.ts";

/** Header and quantity geometry for the shared weapon and resource cards. */
export const DETAIL_CARD_STYLE = `
.ada-controls .ada-detail-header,.ada-controls .ada-detail-quantity{
  display:flex;align-items:center;justify-content:center;gap:${units(SPACING.gap)}
}
.ada-controls .ada-detail-header>.ada-status-stardust,
.ada-controls .ada-detail-header>.ada-status-ore,
.ada-controls .ada-detail-quantity>.ada-status-stardust,
.ada-controls .ada-detail-quantity>.ada-status-ore{margin:0}
.ada-controls .ada-detail-ammo-icon{
  flex:none;width:${units(SHIP_CARD.icon)};height:${units(SHIP_CARD.icon)};
  background-position:0 0;background-size:200% 100%;background-repeat:no-repeat;
  image-rendering:pixelated
}
.ada-controls .ada-detail-unlimited-icon{
  flex:none;width:${units(SHIP_CARD.icon)};height:${units(SHIP_CARD.icon)};
  background:currentColor;mask:var(--glyph) center/contain no-repeat
}
`;
