// The game's icons, each a file under public/ at this URL: the web app manifest's, and the pages'
// favicons and apple-touch-icon. The build writes each again under a content-hashed name in
// /assets/ and points the built pages and manifest there (the kit's hashedIconsPlugin), so a
// redrawn icon reaches an installed app. The source pages and manifest keep the plain URLs.
export const ICONS: readonly string[] = [
  "/art/app-icon/apple-touch-icon.png",
  "/art/app-icon/favicon-16.png",
  "/art/app-icon/favicon-32.png",
  "/art/app-icon/favicon.ico",
  "/art/app-icon/icon-192.png",
  "/art/app-icon/icon-512.png",
  "/art/app-icon/icon-maskable-512.png",
];
