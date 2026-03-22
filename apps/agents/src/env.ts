/**
 * Environment contract for the agents service.
 */

/** Names of environment variables that must be set for full agent functionality. */
export const REQUIRED_AGENT_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ENGINE_URL',
  'ENGINE_API_KEY',
] as const;

/**
 * Optional environment variables (not validated, but documented here):
 * - AUTO_CYCLE: set to "true" to start the orchestrator cycle loop on boot
 * - AGENTS_PORT / PORT: HTTP listen port (default 3001)
 * - WEB_URL: allowed CORS origin (default http://localhost:3000)
 */

/**
 * Returns the subset of {@link REQUIRED_AGENT_ENV_VARS} that are not set.
 * @param env - Process environment to inspect (defaults to `process.env`).
 */
export function getMissingAgentEnvVars(
  env: NodeJS.ProcessEnv = process.env,
): Array<(typeof REQUIRED_AGENT_ENV_VARS)[number]> {
  return REQUIRED_AGENT_ENV_VARS.filter((key) => !env[key]);
}
