/**
 * The Mongo Durable Object is logically partitioned by deployment environment.
 * Keep this decision in one place so WebSocket upgrades, broadcasts and
 * database RPCs cannot silently drift to different objects.
 */
export function gatewayObjectName(appEnv?: string): string {
  return appEnv === "staging" ? "acolhe-staging-mongodb" : "acolhe-mongodb";
}
