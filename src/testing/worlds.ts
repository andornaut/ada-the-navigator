/** These suites use fixed inputs rather than the launch-seed sequence. */
export const SEED_INDEPENDENT_TESTS = [
  "src/model/economy.test.ts",
  "src/pwa/index.test.ts",
  "src/tests/hooksSafety.test.ts",
  "src/tools/pacingSim.test.ts",
  "src/tools/phaserBuild.test.ts",
  "src/ui/resourceCard.test.ts",
];

export function seedIndependentTest(path: string): boolean {
  return SEED_INDEPENDENT_TESTS.some((file) => path === file || path.endsWith(`/${file}`));
}
