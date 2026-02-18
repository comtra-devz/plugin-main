
# Comtra - Technical Masterplan

This document details the complete technology stack, data flows, and architectural logic for the Comtra Design System Plugin.

## 1. Technology Stack

### Frontend (Figma Plugin)
*   **Framework**: React 19 (TypeScript)
*   **Build Tool**: Vite (Single file bundle for Figma `index.html`)
*   **Styling**: TailwindCSS (Brutalist Theme)
*   **State Management**: React Hooks + Local State (minimal complexity)
*   **Figma Bridge**: `controller.ts` (Sandbox environment) communicates via `postMessage`.

### Backend & Database
*   **Platform**: Supabase
*   **Auth**: Supabase Auth (Google OAuth + Email)
*   **Database**: PostgreSQL
*   **API Layer**: Supabase Edge Functions (Deno/Node) to proxy AI and Stripe calls securely.

### AI Engine
*   **Provider**: Google Gemini API (`@google/genai`) and Anthropic Claude (via backend proxy).
*   **Models**:
    *   `gemini-3-flash-preview`: For fast auditing, text analysis, and lightweight logic.
    *   `claude-3-5-sonnet`: For advanced code generation, semantic HTML analysis, and routing logic.
    *   `gemini-2.5-flash-image`: For generating mockups and assets.

---

## 2. User Management (Supabase)

### Auth Flow
1.  Plugin creates a UUID for the user based on Figma User ID.
2.  If `PRO`, authenticates via Supabase Auth to sync subscription status across devices.

### Database Schema (`public`)

**`users` Table**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid | Primary Key (Supabase Auth ID) |
| `figma_id` | text | Unique Figma User ID |
| `email` | text | User email |
| `plan` | enum | `FREE`, `PRO`, `ENTERPRISE` |
| `credits_remaining` | int | For non-annual Pro users |
| `subscription_end` | timestamp | Expiry date |
| `storybook_url` | text | Connected Storybook instance URL |
| `github_repo` | text | Connected GitHub Repo (e.g., `org/design-system`) |

**`sync_logs` Table**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | FK to users |
| `component_name` | text | e.g., "Button" |
| `status` | enum | `SYNCED`, `DRIFT`, `FAILED` |
| `timestamp` | timestamp | Time of check |

---

## 3. The Audit Engine (AI Scanning)

The Audit logic combines deterministic checks (algorithmic) with AI analysis.

### Flow
1.  **Scope Selection**: User selects "Exclude Pages" (e.g., Drafts, Archive) via dropdown. `controller.ts` filters the node tree traversal accordingly.
2.  **Extraction**: `controller.ts` traverses the valid Figma Nodes.
3.  **Sanitization**: Converts Nodes to a simplified JSON schema (stripping heavy binary data).
    ```json
    { "type": "FRAME", "name": "Card", "fills": ["#FF0000"], "layoutMode": "AUTO", "pageId": "p1", "pageName": "Home V2" }
    ```
4.  **Algorithmic Check**:
    *   *Accessibility*: Checks contrast ratios locally using math logic.
    *   *Naming*: Checks regex patterns (e.g., `Category/Component`).
5.  **AI Analysis (Gemini Flash)**:
    *   Input: The JSON structure + Design Tokens list.
    *   Prompt: "Analyze this structure. Does it use hardcoded hex values instead of the provided tokens? Is the hierarchy logical?"
    *   Output: Structured list of issues with specific "Fix" suggestions.
6.  **Result Grouping**: The frontend receives flat issues and groups them by `pageName` for display. Multiple instances of the same component error (Component Deviation) are aggregated into single, navigable cards ("Layer 1 of N").

---

## 4. Code & Token Generation (Advanced)

Generates clean code from wireframes using Design System context and Smart Routing.

### Context Injection (RAG Lite)
To ensure the code uses *your* variables (e.g., `var(--color-primary)`) instead of raw CSS:
1.  Plugin extracts local Figma Variables (Tokens).
2.  Sends Tokens + Component JSON to AI Model.

### Generation Rules (Claude 3.5 Sonnet)
The backend enforces specific engineering standards during generation:
*   **Semantic HTML5**: Forces the use of `<nav>`, `<header>`, `<main>` instead of generic divs.
*   **Accessibility**: Automatically adds `:focus-visible` states to all interactive elements.
*   **Smart Routing**: Analyzes Figma `transitionNodeID`. If two buttons have the same text but different prototype destinations, the AI generates distinct routes (e.g., `/login-nav` vs `/login-footer`) to prevent routing conflicts.
*   **Naming Convention**: Enforces `ds-[category]-[element]-[state]` for consistent class naming.

### Output Formats
*   **React**: Functional components with Tailwind classes.
*   **CSS**: Raw CSS Variables block.
*   **Storybook**: Generates `.stories.tsx` files automatically based on variants found in Figma.

---

## 5. Deep Sync & Drift Detection

This feature ensures Figma and Code (GitHub/Storybook) stay in sync.

### The "Drift" Algorithm
1.  **Figma Signature**: We generate a hash/signature of the Figma Component based on its properties (Props, Variants, Key Styles).
2.  **Code Signature**: We fetch the `component-meta.json` from the connected Storybook/GitHub repo.
3.  **Comparison**:
    *   If `Figma.props != Code.props`: **Drift Detected (Structure)**.
    *   If `Figma.tokens != Code.tokens`: **Drift Detected (Style)**.

### Continuous Synchronization & Rate Limiting
To ensure efficiency and prevent API abuse, the sync mechanism follows strict polling rules:

1.  **Polling Strategy**:
    *   Once a file is synced (Tokens, Component, or Project), a lightweight background process (via Supabase Edge Functions) checks the Storybook API every **15 minutes** (low frequency) to detect external changes.
    *   If a change is detected on Storybook/GitHub that doesn't match the last known Figma signature, the status is updated to `DRIFT`.

2.  **Manual Re-Sync & Cooldown**:
    *   **Cooldown**: Users can manually trigger a re-sync on any tab (Tokens, Target, Sync) only once every **2 minutes**.
    *   **Timer**: A countdown timer is displayed on the CTA button preventing interaction until the cooldown expires.
    *   **Cost**: Every manual re-sync action consumes **credits** (e.g., -5 Credits), even if the user has synced the file previously. This applies to all three tabs.

### Sync Actions
*   **Push to GitHub**:
    1.  User clicks "Sync GitHub".
    2.  Plugin generates updated React code.
    3.  Backend creates a Pull Request via GitHub API with the new code.
*   **Pull from Storybook**:
    1.  Plugin reads Storybook args.
    2.  Updates Figma Component properties to match valid code props.

---

## 6. Asset Generation (Mockups)

Uses `gemini-2.5-flash-image`.

*   **Trigger**: User selects a placeholder frame (e.g., "Avatar").
*   **Action**: "Generate Image: Professional headshot".
*   **Result**: AI generates an image, Plugin receives Base64, creates an `ImageFill` in Figma.