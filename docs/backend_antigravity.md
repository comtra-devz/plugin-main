# Antigravity Backend

## Edge Functions
Use Supabase Edge Functions to hide API Keys.
1. `supabase functions new ai-audit`
2. `supabase functions new code-gen`

## Database Schema (Updates)
- **table: patterns**: Store accepted designs for AI training.
  - `input_json` (jsonb)
  - `output_json` (jsonb)
  - `rating` (int)

## Security
- Never expose `ANTHROPIC_API_KEY` or `STRIPE_SECRET` in the frontend `manifest.json` or React code.
- Always proxy requests through the backend.