// The game loop's frame step with or without rendering. Phaser's loop calls loop.callback once per
// frame; the game's step updates the scenes and then renders and presents the canvas, and its
// headless step updates them alone, so an unchanged canvas is not drawn or presented again.

/** The parts of a Phaser game the loop switch touches. */
export interface RenderLoopGame {
  readonly loop: { callback: (time: number, delta: number) => void };
  step(time: number, delta: number): void;
  headlessStep(time: number, delta: number): void;
}

const steps = new WeakMap<
  RenderLoopGame,
  {
    readonly headless: (time: number, delta: number) => void;
    readonly render: (time: number, delta: number) => void;
  }
>();

/** Runs the game's frames with rendering, or with updates only. */
export function setRendering(game: RenderLoopGame, render: boolean): void {
  let pair = steps.get(game);
  if (!pair) {
    pair = { headless: game.headlessStep.bind(game), render: game.step.bind(game) };
    steps.set(game, pair);
  }
  const callback = render ? pair.render : pair.headless;
  if (game.loop.callback !== callback) {
    game.loop.callback = callback;
  }
}
