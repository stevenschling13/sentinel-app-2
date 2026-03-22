import { describe, it, expect } from 'vitest';
import { getMissingAgentEnvVars, REQUIRED_AGENT_ENV_VARS } from '../env.js';

describe('getMissingAgentEnvVars', () => {
  it('returns all vars when none are set', () => {
    const missing = getMissingAgentEnvVars({} as NodeJS.ProcessEnv);
    expect(missing).toEqual([...REQUIRED_AGENT_ENV_VARS]);
  });

  it('returns empty array when all are set', () => {
    const env = {
      ANTHROPIC_API_KEY: 'key',
      SUPABASE_URL: 'url',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
      ENGINE_URL: 'url',
      ENGINE_API_KEY: 'key',
    } as unknown as NodeJS.ProcessEnv;
    expect(getMissingAgentEnvVars(env)).toEqual([]);
  });

  it('returns only missing vars', () => {
    const env = {
      ANTHROPIC_API_KEY: 'key',
      SUPABASE_URL: 'url',
    } as unknown as NodeJS.ProcessEnv;
    const missing = getMissingAgentEnvVars(env);
    expect(missing).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(missing).toContain('ENGINE_URL');
    expect(missing).not.toContain('ANTHROPIC_API_KEY');
  });
});
