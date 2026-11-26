// The play bootstrap and main load this first, so later module evaluation failures reach the
// crash listener. The DOM presenter and its recovery controls are Phaser-free.
import "../ui/crashScreen.ts";
