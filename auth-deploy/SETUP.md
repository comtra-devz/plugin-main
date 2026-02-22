# Deploy OAuth (auth-deploy)

Questa cartella viene deployata come **progetto Vercel separato** (Root Directory = `auth-deploy`) per servire **auth.comtra.dev** (solo login Figma).

**Guida completa:** [../docs/OAUTH-FIGMA.md](../docs/OAUTH-FIGMA.md)

In sintesi: nuovo progetto Vercel → import repo **plugin-main** → Root Directory **auth-deploy** → dominio **auth.comtra.dev** → variabili (FIGMA_*, BASE_URL, REDIS_URL) → redeploy → `npm run check-auth`.
