---
name: sentinel-health
description: Quick health check across all Sentinel Trading Platform 2.0 services
---

# Sentinel Health Check

Run a comprehensive health check across all Sentinel Trading Platform 2.0 services.

## Endpoints

| Service  | Health URL | Expected |
|----------|-----------|----------|
| Engine   | `https://engine-production-8052.up.railway.app/health` | 200 with JSON body |
| Agents   | `https://agents-production-633a.up.railway.app/health` | 200 with JSON body |
| Web      | `https://sentinel-app-2.vercel.app` | 200 |
| Supabase | `https://luwyjfwauljwsfsnwiqb.supabase.co/rest/v1/` | 200 (needs apikey header) |

## Procedure

Run all health checks in parallel using curl. For each endpoint, capture the HTTP status code and response body (or error).

### 1. Direct Service Health

```bash
# Engine
curl -sf -w "\nHTTP_STATUS:%{http_code}\n" https://engine-production-8052.up.railway.app/health

# Agents
curl -sf -w "\nHTTP_STATUS:%{http_code}\n" https://agents-production-633a.up.railway.app/health

# Web (just check reachability)
curl -sf -o /dev/null -w "HTTP_STATUS:%{http_code}\n" https://sentinel-app-2.vercel.app
```

### 2. Supabase Connectivity

Check that the Supabase REST endpoint is reachable. The anon key is required in the `apikey` header. Read it from the local `.env` or `.env.local` file first:

```bash
# Extract NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local or .env
ANON_KEY=$(grep -E "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local .env 2>/dev/null | head -1 | cut -d= -f2-)
curl -sf -o /dev/null -w "HTTP_STATUS:%{http_code}\n" \
  -H "apikey: $ANON_KEY" \
  https://luwyjfwauljwsfsnwiqb.supabase.co/rest/v1/
```

If no anon key is found locally, skip the Supabase check and note it in the report.

### 3. Vercel Proxy Routes (optional)

If the web app proxies API requests to the engine or agents, check those routes too:

```bash
# Engine proxy (if configured)
curl -sf -o /dev/null -w "HTTP_STATUS:%{http_code}\n" https://sentinel-app-2.vercel.app/api/health

# Agents proxy (if configured)
curl -sf -o /dev/null -w "HTTP_STATUS:%{http_code}\n" https://sentinel-app-2.vercel.app/api/agents/health
```

If proxy routes return 404, that is not a failure -- just note that proxy routes are not configured.

## Report Format

Present results as a clear summary table:

```
Service     Status    Response Time    Notes
─────────   ──────    ─────────────    ─────
Engine      UP        120ms            healthy
Agents      UP        95ms             healthy
Web         UP        210ms            200 OK
Supabase    UP        80ms             REST API reachable
Proxy /api  N/A       -                not configured
```

Mark any service returning a non-2xx status or timing out (>10s) as DOWN. If a service is down, suggest checking Railway logs:

```bash
railway logs --service <SERVICE_ID>
```
