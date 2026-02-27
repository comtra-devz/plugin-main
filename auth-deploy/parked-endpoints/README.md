These files are parked API handlers that are not deployed on Vercel in the MVP, to stay under the Hobby plan limit of 12 Serverless Functions.

They can be restored later if we move to a Pro plan or introduce a catch-all API handler:

- Original paths (now removed from `auth-deploy/api`):
  - `api/test/simulate-referral.mjs`
  - `api/figma-oauth.mjs`
  - `api/affiliates/me.mjs`
  - `api/affiliates/register.mjs`

All backend logic for affiliates, trophies, and OAuth still lives in `oauth-server/app.mjs` and the database schema (`auth-deploy/schema.sql`).

