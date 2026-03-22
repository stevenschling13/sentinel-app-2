/**
 * Environment contract for the agents service.
 */

export const REQUIRED_AGENT_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ENGINE_URL',
  'ENGINE_API_KEY',
] as const;

export function getMissingAgentEnvVars(
  env: NodeJS.ProcessEnv = process.env,
): Array<(typeof REQUIRED_AGENT_ENV_VARS)[number]> {
  return REQUIRED_AGENT_ENV_VARS.filter((key) => !env[key]);
}
