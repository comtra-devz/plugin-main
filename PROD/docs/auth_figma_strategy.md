# Figma Authentication Strategy (Antigravity Backend)

This document outlines the architecture for implementing "Login with Figma" in the Antigravity backend to support user authentication within the Comtra plugin.

## 1. Overview

Instead of using generic Email/Google login, we will leverage Figma's OAuth 2.0 provider. This ensures:
1.  We verify the user's identity via their Figma account.
2.  We can access their Figma ID (`figma_user_id`) to map subscription data correctly.
3.  We can eventually read/write files via the REST API if permissions are granted.

## 2. Authentication Flow

### A. The Plugin Side (Frontend)
1.  User clicks "Try for free with Figma" on the Landing page.
2.  The plugin cannot open a popup directly due to sandbox restrictions. It must call `figma.openExternal('https://api.comtra.ai/auth/figma/login')`.
3.  The backend handles the OAuth dance.
4.  Upon success, the browser redirects to a success page which provides a unique **Auth Token**.
5.  User copies this token and pastes it back into the Plugin (or we use a polling mechanism if the plugin is open).

*Alternative (Simpler for Plugins)*: 
The plugin uses `figma.currentUser` to get the `id` and `name`. We send this signed (if possible) or trust it for basic identity, but for secure actions (Payments), we prefer the OAuth flow or a Supabase Auth flow initiated via browser.

### B. The Backend Side (Supabase Edge Function)

**Endpoint**: `/auth/figma/login`
1.  Redirects user to `https://www.figma.com/oauth` with:
    *   `client_id`: [YOUR_CLIENT_ID]
    *   `redirect_uri`: `https://api.comtra.ai/auth/figma/callback`
    *   `scope`: `file_read` (minimal scope)
    *   `state`: [RANDOM_STRING] (CSRF protection)

**Endpoint**: `/auth/figma/callback`
1.  Receives `code` from Figma.
2.  Exchanges `code` for `access_token` via `POST https://www.figma.com/api/oauth/token`.
3.  Calls `GET https://api.figma.com/v1/me` to get user profile (`id`, `email`, `handle`).
4.  **Upsert User**: Checks `users` table in Supabase.
    *   If exists: Update `last_login`.
    *   If new: Insert record.
5.  **Generate Session**: Creates a Supabase JWT for the user.
6.  Returns HTML page to the user: "Login Successful. Your code is: [JWT]".

## 3. Database Updates

Update the `users` table schema to support Figma Auth:

```sql
ALTER TABLE users 
ADD COLUMN figma_access_token TEXT,
ADD COLUMN figma_refresh_token TEXT,
ADD COLUMN figma_token_expires_at TIMESTAMP;
```

## 4. Implementation Steps (Antigravity)

1.  **Register App**: Create an app in Figma Developers Console to get Client ID/Secret.
2.  **Edge Function**: Create `supabase/functions/figma-auth`.
3.  **Frontend Update**: Update `LoginModal.tsx` to trigger the external link flow.

## 5. Security Considerations

*   **Token Storage**: Store refresh tokens encrypted in Supabase (pgsodium).
*   **Scopes**: Only request `file_read` initially. Request `file_write` only when Deep Sync features are used.
