export type DevModeEnv = {
  nodeEnv: string | undefined;
  flag: string | undefined;
};

const currentEnv = (): DevModeEnv => ({
  nodeEnv: process.env.NODE_ENV,
  flag: process.env.NEXT_PUBLIC_USE_DEV_FIXTURES,
});

export function isDevFixtureMode(env: DevModeEnv = currentEnv()): boolean {
  return env.nodeEnv === "development" && env.flag === "1";
}

export async function loadDevFixtures(env: DevModeEnv = currentEnv()) {
  if (!isDevFixtureMode(env)) return null;
  return import("./dev-fixtures");
}
