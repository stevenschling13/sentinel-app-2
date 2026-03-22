---
name: sentinel-env-check
description: Validate environment variables across all Sentinel Trading Platform 2.0 environments
---

# Sentinel Environment Variable Check

Validate that all required environment variables are set across local, Railway, and Vercel environments for the Sentinel Trading Platform 2.0.

## Service Details

- **Railway Project ID:** `ceafb27f-fe58-4ec5-a0cc-db23212d8f11`
- **Engine Service ID:** `5b063e49-b6d4-4a09-a789-98afc23c6804`
- **Agents Service ID:** `70608770-0c0c-450c-bac5-4a8c460f7632`
- **GitHub Repo:** `stevenschling13/sentinel-app-2`

## Procedure

### 1. Check Local Environment

Read the local `.env`, `.env.local`, and `.env.development.local` files in the project root. List all variables found and flag any that:

- Have empty values
- Contain placeholder text like `your-key-here`, `TODO`, `CHANGEME`, `xxx`, or `placeholder`
- Are commented out but appear to be required

Common expected variables (check for presence):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
ENGINE_URL
AGENTS_URL
OPENAI_API_KEY
ANTHROPIC_API_KEY
```

### 2. Check Railway Environment Variables

Use the Railway CLI to list env vars for each service:

```bash
# Engine env vars
railway variables --service 5b063e49-b6d4-4a09-a789-98afc23c6804

# Agents env vars
railway variables --service 70608770-0c0c-450c-bac5-4a8c460f7632
```

Flag any variables that are empty or contain placeholder values.

### 3. Check Vercel Environment Variables

Use the Vercel CLI to list env vars:

```bash
vercel env ls
```

If the Vercel CLI is not authenticated or the command fails, try using the GitHub repo to check if there is a `vercel.json` or `.vercel` configuration that references expected variables.

### 4. Cross-Environment Consistency

Compare variables across environments and flag:

- **Missing in production:** A variable exists locally but not in Railway/Vercel
- **Missing locally:** A variable exists in Railway/Vercel but not in the local `.env` files
- **Value mismatches:** URLs or non-secret values that differ unexpectedly between environments (e.g., `NEXT_PUBLIC_SUPABASE_URL` should be the same everywhere)
- **Secrets in wrong places:** Service role keys or API keys that should not be in the web/Vercel environment

### 5. Supabase Connection Test

If `DATABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is available locally, test the connection:

```bash
# Quick connectivity check using the Supabase REST API
curl -sf -o /dev/null -w "%{http_code}" \
  -H "apikey: <ANON_KEY>" \
  https://luwyjfwauljwsfsnwiqb.supabase.co/rest/v1/
```

## Report Format

Present results grouped by environment:

```
LOCAL (.env.local)
  NEXT_PUBLIC_SUPABASE_URL      = set
  NEXT_PUBLIC_SUPABASE_ANON_KEY = set
  SUPABASE_SERVICE_ROLE_KEY     = MISSING
  OPENAI_API_KEY                = set
  ...

RAILWAY: Engine
  DATABASE_URL                  = set
  OPENAI_API_KEY                = set
  ...

RAILWAY: Agents
  DATABASE_URL                  = set
  ANTHROPIC_API_KEY             = MISSING  <-- WARNING
  ...

VERCEL
  NEXT_PUBLIC_SUPABASE_URL      = set
  ...

ISSUES FOUND:
  - SUPABASE_SERVICE_ROLE_KEY missing from local env
  - ANTHROPIC_API_KEY missing from Agents service on Railway
```

Never print actual secret values. Only report whether each variable is "set", "MISSING", or "PLACEHOLDER".
