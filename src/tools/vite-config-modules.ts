// What vite.config.ts's plugins take from the repository's code, in one module so the kit's
// gameViteConfig loads it through a single Vite module runner, which resolves @andornaut/game-kit
// as the app does.
export { securityHeadersPlugin } from "../headers/security-headers-plugin.ts";
export { homePagePlugin, webManifestPlugin } from "../home-page/html.ts";
export { ICONS } from "../pwa/icons.ts";
export { precachePlugin } from "../pwa/precachePlugin.ts";
export { PHASER_BUILD } from "./phaser-build.ts";
export { sitePages } from "./site-pages.ts";
export { uiStylePlugin } from "./ui-style-plugin.ts";
export { phaserBuildPlugin } from "@andornaut/game-kit/web/build/vite/phaserBuildPlugin";
export { hashedIconsPlugin } from "@andornaut/game-kit/web/pwa/vite/hashedIconsPlugin";
