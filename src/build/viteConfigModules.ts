// What vite.config.ts's plugins take from the repository's code, in one module so the kit's
// gameViteConfig loads it through a single Vite module runner, which resolves @andornaut/game-kit
// as the app does.
export { homePagePlugin, webManifestPlugin } from "./homePage.ts";
export { ICONS } from "./icons.ts";
export { PHASER_BUILD } from "./phaserBuild.ts";
export { precachePlugin } from "./precachePlugin.ts";
export { securityHeadersPlugin } from "./securityHeadersPlugin.ts";
export { sitePages } from "./sitePages.ts";
export { uiStylePlugin } from "./uiStylePlugin.ts";
export { hashedIconsPlugin } from "@andornaut/game-kit/build/hashedIconsPlugin";
export { phaserBuildPlugin } from "@andornaut/game-kit/build/phaserBuildPlugin";
