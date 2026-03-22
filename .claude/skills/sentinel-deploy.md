---
name: sentinel-deploy
description: Deploy one or all Sentinel Trading Platform 2.0 services (engine, agents, web)
---

# Sentinel Deploy

Deploy services for the Sentinel Trading Platform 2.0.

## Service Registry

| Service | Platform | Service ID | Production URL |
|---------|----------|------------|----------------|
| Engine  | Railway  | `5b063e49-b6d4-4a09-a789-98afc23c6804` | `https://engine-production-8052.up.railway.app` |
| Agents  | Railway  | `70608770-0c0c-450c-bac5-4a8c460f7632` | `https://agents-production-633a.up.railway.app` |
| Web     | Vercel   | (auto-deploy on push) | `https://sentinel-app-2.vercel.app` |

- **Railway Project ID:** `ceafb27f-fe58-4ec5-a0cc-db23212d8f11`
- **GitHub Repo:** `stevenschling13/sentinel-app-2`

## Usage

The user will specify which service(s) to deploy. If none is specified, ask before deploying all.

### Deploying the Engine (Python FastAPI)

```bash
railway up --service 5b063e49-b6d4-4a09-a789-98afc23c6804 --detach
```

After deploying, wait 15 seconds then verify the health endpoint:

```bash
curl -sf https://engine-production-8052.up.railway.app/health
```

### Deploying the Agents (Node.js Express)

```bash
railway up --service 70608770-0c0c-450c-bac5-4a8c460f7632 --detach
```

After deploying, wait 15 seconds then verify the health endpoint:

```bash
curl -sf https://agents-production-633a.up.railway.app/health
```

### Deploying the Web App (Next.js on Vercel)

The web app auto-deploys when changes are pushed to `main`:

```bash
git push origin main
```

After pushing, check the Vercel deployment status:

```bash
gh run list --repo stevenschling13/sentinel-app-2 --limit 1
```

Then verify the site is reachable:

```bash
curl -sf -o /dev/null -w "%{http_code}" https://sentinel-app-2.vercel.app
```

### Deploying All Services

Run the Engine and Agents Railway deploys in parallel, then push to main for the web app. After all deploys are triggered, wait 20 seconds and run health checks on all three endpoints.

## Post-Deploy Health Checks

After every deploy, always run and report health status for the deployed service(s):

1. **Engine:** `curl -sf https://engine-production-8052.up.railway.app/health`
2. **Agents:** `curl -sf https://agents-production-633a.up.railway.app/health`
3. **Web:** `curl -sf -o /dev/null -w "%{http_code}" https://sentinel-app-2.vercel.app` (expect 200)

Report results clearly: which services are healthy and which failed. If a health check fails, suggest checking Railway logs with:

```bash
railway logs --service <SERVICE_ID>
```
