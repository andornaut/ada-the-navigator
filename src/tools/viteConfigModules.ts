// What vite.config.ts's plugins take from the repository's code, in one module so the kit's
// gameViteConfig loads it through a single Vite module runner, which resolves @andornaut/game-kit
// as the app does.
export { securityHeadersPlugin } from "../headers/securityHeadersPlugin.ts";
export { homePagePlugin, webManifestPlugin } from "../home-page/html.ts";
export { galaxyPrecacheGroups } from "../pwa/galaxyPrecacheGroups.ts";
export { ICONS } from "../pwa/icons.ts";
export { precachePlugin } from "../pwa/precachePlugin.ts";
export { PHASER_BUILD } from "./phaserBuild.ts";
export { sitePages } from "./sitePages.ts";
export { uiStylePlugin } from "./uiStylePlugin.ts";
export { hashedIconsPlugin } from "@andornaut/game-kit/build/hashedIconsPlugin";
export { phaserBuildPlugin } from "@andornaut/game-kit/build/phaserBuildPlugin";
