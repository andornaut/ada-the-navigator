import { units } from "./css.ts";
import { BUTTON_GAP } from "./tokens.ts";

/** Approved quest card geometry, in logical pixels. */
export const QUEST_ROUTE_ARROW = {
  head: "M10 0L18 6L10 12Z",
  shaft: "M0 5H10V7H0Z",
  viewBox: "0 0 18 12",
} as const;

export const QUEST_LIST_PAGE_SIZE = 2;

export const QUESTS_SCREEN_STYLE = `
.ada-controls .ada-quests-screen{padding:${units(12)}}
.ada-controls .ada-quests-screen .ada-card-frame{width:100%;
  height:100%;
  min-height:0}
.ada-controls .ada-quests-screen .ada-card{width:100%!important;
  height:100%;
  padding:0 ${units(8)}}
.ada-controls .ada-quests-screen .ada-card header{margin-top:${units(4)};
  padding:0}
.ada-controls .ada-quests-screen .ada-card-body{overflow:visible;
  align-items:stretch;
  gap:${units(8)};
  margin-top:${units(8)};
  padding-bottom:${units(8)};
  flex:1;
  min-height:0}
.ada-controls .ada-quest-content{position:relative;
  flex:1;
  min-height:0;
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  grid-template-rows:minmax(0,1fr) auto;
  gap:${units(8)} ${units(16)};
  padding:${units(4)} ${units(8)} ${units(8)};
  background:#302e42;
  border:1px solid #777186}
.ada-controls .ada-quest-content::before{content:"";
  position:absolute;
  left:50%;
  top:${units(6)};
  bottom:${units(6)};
  width:1px;
  background:#777186}
.ada-controls .ada-quest-content section{min-width:0}
.ada-controls .ada-quest-content h3,.ada-controls .ada-quest-content p{font:inherit;
  margin:0;
  overflow-wrap:anywhere}
.ada-controls .ada-quest-content h3{color:#b8b3c9;
  font-weight:bold;
  margin-bottom:${units(4)}}
.ada-controls .ada-quest-description{margin-top:${units(8)}!important;
  color:#c0bbd0}
.ada-controls .ada-quest-route{display:grid;
  grid-template-columns:minmax(0,1fr) ${units(46)} minmax(0,1fr);
  gap:${units(4)};
  align-items:center;
  margin-top:${units(8)};
  padding:${units(8)};
  background:#262b44;
  border:1px solid #55516b}
.ada-controls .ada-quest-endpoint{display:flex;
  align-items:center;
  gap:${units(4)};
  min-width:0;
  color:inherit;
  font:inherit;
  text-align:left;
  background:none;
  border:0;
  padding:0;
  cursor:pointer}
.ada-controls .ada-quest-endpoint:disabled{opacity:1;
  cursor:default}
.ada-controls .ada-quest-endpoint>span{min-width:0;
  overflow-wrap:anywhere}
.ada-controls .ada-quest-endpoint small{display:block;
  font:inherit;
  color:#b8b3c9}
.ada-controls .ada-quest-icon{display:block;
  flex-shrink:0;
  width:${units(24)};
  height:${units(24)};
  padding:${units(2)};
  border-radius:50%;
  object-fit:contain;
  image-rendering:pixelated}
.ada-controls .ada-quest-arrow{display:block;
  width:${units(18)};
  height:${units(12)};
  margin:auto}
.ada-controls .ada-quest-footer{display:flex;
  justify-content:flex-end;
  gap:${units(8)};
  flex:none}
.ada-controls .ada-quest-footer:has(>[data-action="quest-other"]){gap:${units(BUTTON_GAP)}}
.ada-controls .ada-quest-footer .ada-button:first-child:not(:last-child):not([data-action="quest-other"]){
  margin-right:auto
}
.ada-controls .ada-quest-list{flex:1;
  min-height:0;
  display:flex;
  flex-direction:column;
  gap:${units(8)};
  overflow:visible}
.ada-controls .ada-quest-list .ada-button{display:flex;
  align-items:center;
  gap:${units(8)};
  white-space:normal;
  text-align:left;
  flex:none}
.ada-controls .ada-quest-requirement{display:flex;align-items:center;gap:${units(6)}}
.ada-controls .ada-quest-requirement input{width:${units(16)};height:${units(16)};margin:0;opacity:1}
.ada-controls .ada-quest-list h3{font:inherit;margin:0;color:#b8b3c9}
.ada-controls .ada-quests-screen .ada-card header h2{color:#ead4aa}
.ada-controls .ada-quest-content p{color:#ead4aa}
.ada-controls .ada-quest-objective>p:first-of-type,.ada-controls .ada-quest-reward p{font-weight:bold}
.ada-controls .ada-quest-objective .ada-quest-description{color:#c0bbd0}
`;
