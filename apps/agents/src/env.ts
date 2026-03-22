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
 * Returns the subset of {@link REQUIRED_AGENT_ENV_VARS} that are not set.
 * @param env - Process environment to inspect (defaults to `process.env`).
 */
export function getMissingAgentEnvVars(
  env: NodeJS.ProcessEnv = process.env,
): Array<(typeof REQUIRED_AGENT_ENV_VARS)[number]> {
  return REQUIRED_AGENT_ENV_VARS.filter((key) => !env[key]);
}
