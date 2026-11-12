// Installs the page's crash screen. src/main.ts, the play page's entry, imports this module first:
// modules run in import order, a module's own imports first, so the crash screen listens before
// Phaser or any game module runs, and an error thrown while one loads shows it rather than a blank
// page. The screen imports only its words, the build label and the kit, not the game.
import "./crash-screen.ts";
