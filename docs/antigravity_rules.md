# Antigravity Rules

## General Philosophy
1. **Logic Separation**: Keep UI (React), Business Logic (Hooks/Utils), and Backend (Figma Controller) strictly separate.
2. **File Size**: Max 500 chars per file where possible. Split components aggressively.

## Supabase (Database)
1. **Naming**: Use `snake_case` for all Postgres identifiers.
2. **Auth**: Use RLS (Row Level Security). Policy: `auth.uid() = user_id`.
3. **Table: users**
   - `id` (uuid, PK)
   - `figma_id` (text, unique)
   - `email` (text)
   - `plan_tier` (enum: 'free', 'pro')
   - `subscription_end` (timestamp)
   - `prompts_limit` (int)
   - `prompts_used` (int)
   - `github_connected` (boolean)
   - `storybook_connected` (boolean)
4. **Table: audits**
   - `id` (uuid, PK)
   - `user_id` (fk)
   - `issues_found` (jsonb)
   - `score` (int)
5. **Table: sync_logs**
   - `id` (uuid, PK)
   - `user_id` (fk)
   - `component_id` (text)
   - `direction` (enum: 'push', 'pull')
   - `status` (enum: 'success', 'failed')
   - `timestamp` (timestamp)

## Stripe (Payments)
1. **Metadata**: ALWAYS pass `figma_user_id` and `supabase_uid` in checkout session metadata to link webhooks back to users.
2. **Products**:
   - `prod_free`: 0$, limited features.
   - `prod_pro`: 19$/mo, enable AI generation.
3. **Webhooks**: Listen for `checkout.session.completed` to update `users.plan_tier` and `users.prompts_limit`.

## Figma Plugin
1. **Undo**: Since Figma API lacks direct Undo for plugins, maintain a localized `history` state stack.
2. **Messages**: Typed JSON interface for `postMessage` between UI and `controller.ts`.

## Subscription & Limits (New)
1. **Visuals**: The Subscription page must display the specific plan type (e.g., "6 Months"), expiration date, and a progress bar for prompts used vs. limit.
2. **Enforcement**: If `users.prompts_used` >= `users.prompts_limit`, block AI generation actions and display the "Out of Energy" popup modal prompting an upgrade.
3. **Reset**: Ensure logic exists to reset `prompts_used` or top-up `prompts_limit` upon successful subscription renewal via Stripe webhook.

## Code Generation (New)
1. **Timestamps**: All generated code (CSS, React, Liquid, etc.) MUST include a comment at the top indicating the date and time of generation (e.g., `// Generated on 10/24/2023, 10:00:00 AM`).
2. **Sync Status**: The UI must explicitly show if the current code is "Outdated" compared to what is deployed on Storybook/GitHub.

## Deep Sync & Drift (New)
1. **Drift Detection**: Backend must accept Figma Node properties and compare them against stored Code/Storybook definitions to calculate a "Drift Score".
   - If drift > 0, highlight component in UI as "Drift Detected".
2. **Storybook Sync**: Implement OAuth flow for Storybook (or token based). Store connection status in `users` table.
3. **GitHub Integration**: Prepare database schema for `github_repo_id` and `access_token`. This feature is flagged as `coming_soon` in API responses but database must support it.
4. **Sync History**: Log every sync action in `sync_logs` table.

## Deployment & Security (CRITICAL)
1. **ONLY PROD GOES LIVE**: The only environment authorized for online deployment is the `PROD` folder. The `TESTING` folder must be excluded from production builds.
2. **Anti-Tampering**: Ensure the site code (both PROD and TESTING) is immutable at runtime. No code injection via browser console or external scripts is allowed.
3. **CSP**: Implement a strict Content Security Policy to prevent XSS.
4. **Isolation**: There must be ZERO dependency between `PROD` and `TESTING`. They share no files, no CSS, no state.