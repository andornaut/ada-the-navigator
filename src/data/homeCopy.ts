// The landing page's and the web app manifest's player strings (gameplay/player-copy.md,
// "Landing page"), filled into pages/index.html and public/manifest.webmanifest at build time
// (src/home-page/html.ts).
export const HOME_COPY = {
  // The landing page's subline, its meta description and the manifest's description.
  description:
    "Join Ada on space adventures and help her community back home with what she learns.",
  // The Mobile controls line; each token is a control name and its icon (src/ui/controlHelp.ts).
  mobile: "Move with the {move}. Aim and fire with the {aim}. Tap {use} to interact.",
} as const;
