
# Antigravity Deployment Rules (PROD)

## 1. The "Single Source of Truth" Rule
- **Root Folder**: `/PROD` is the **ONLY** folder that matters for the live plugin.
- **AI Constraint**: When asked to make UI/Feature changes, **NEVER** modify files in `/TESTING` or the root directory. ONLY modify files inside `/PROD`.
- **File Integrity**: Do not rename or move `PROD/App.tsx`, `PROD/index.html` (if present), or `PROD/controller.ts` without explicit instruction. These are entry points.

## 2. Database (Supabase)
- **Env**: Production
- **Tables**: `users`, `audits`, `sync_logs`.
- **RLS**: Enforce `auth.uid()` checks strictly.

## 3. Payments (Stripe)
- **Mode**: Live
- **Webhooks**: Must verify signature.
- **Metadata**: Sync `figma_user_id` on every transaction.

## 4. AI Configuration & Prompts
- **Model**: Gemini 1.5 Pro / Claude 3.5 Sonnet.
- **Prompt Storage**: System prompts must be stored in `PROD/constants.ts` or database, NOT hardcoded in components, to allow hot-swapping without code deploy.

## 5. AI-Driven Modification Protocol (CRITICAL)
To ensure zero-error deployment when using Google AI/LLMs:

1.  **Isolation**: Always check if the file path starts with `PROD/`.
2.  **Atomic Components**: If adding a new feature, create a new file in `PROD/components/` rather than expanding a 1000-line file.
3.  **No breaking Imports**: Always use relative imports (e.g., `../types`) assuming `/PROD` is the root context for that module.
4.  **Style Safety**: Use existing constants (`BRUTAL`, `COLORS`) from `PROD/constants.ts`. Do not introduce new hardcoded hex values.

## 6. Deployment Pipeline (CI/CD)
- **Trigger**: Push to `main` branch (GitHub).
- **Builder**: Vercel/Netlify.
- **Figma Update**: Automatic (Iframe points to Vercel URL).
- **Manual Step**: Only `manifest.json` changes require a re-publish to Figma Community.
