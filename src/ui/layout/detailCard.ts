import { units } from "./css.ts";
import { SHIP_CARD } from "./shipCard.ts";
import { SPACING } from "./tokens.ts";

/** Header and quantity geometry for the shared weapon and resource cards. */
export const DETAIL_CARD_STYLE = `
.ada-controls .ada-detail-body > .ui-layout-stack{
  align-self:stretch;grid-template-columns:minmax(0,1fr)
}
.ada-controls .ada-detail-body .ada-detail-quantity{justify-self:center}
.ada-controls .ada-detail-actions{min-width:0;width:auto;justify-content:space-between}
.ada-controls .ada-detail-actions:has(> .ada-button-presentation:not([hidden])):not(:has(
  > .ada-button-presentation:not([hidden]) ~ .ada-button-presentation:not([hidden])
)){justify-self:center}
.ada-controls .ada-detail-header,.ada-controls .ada-detail-quantity{
  display:flex;align-items:center;justify-content:center;gap:${units(SPACING.gap)}
}
.ada-controls .ada-detail-header>.ada-status-stardust,
.ada-controls .ada-detail-header>.ada-status-ore,
.ada-controls .ada-detail-quantity>.ada-status-stardust,
.ada-controls .ada-detail-quantity>.ada-status-ore{margin:0}
.ada-controls .ada-detail-ammo-icon,.ada-controls .ada-detail-unlimited-icon{
  flex:none;width:${units(SHIP_CARD.icon)};height:${units(SHIP_CARD.icon)};
  background:currentColor;mask:var(--glyph) center/contain no-repeat
}
@media (forced-colors:active){
  .ada-controls .ada-detail-ammo-icon{
    background:CanvasText;forced-color-adjust:none
  }
}
`;
