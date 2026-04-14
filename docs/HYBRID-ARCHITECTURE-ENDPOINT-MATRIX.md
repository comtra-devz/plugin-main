# Comtra Hybrid Architecture — Endpoint Matrix (v1)

Purpose: map current API contracts to a tool-agnostic v2 contract (Figma adapter today, Penpot/Web adapters tomorrow) with minimal disruption.

## Scope

- Backend: `auth-deploy/oauth-server/app.mjs`
- Plugin/UI caller: `App.tsx`, `AuditView.tsx`, `controller.ts`
- Focus endpoints: agents + context + account/read models needed for a lightweight webapp

---

## 1) Endpoint-by-endpoint matrix

| Endpoint | Current request contract | Current Figma coupling | Target v2 (tool-agnostic) | Migration cost | Rollout strategy |
|---|---|---|---|---|---|
| `POST /api/agents/ds-audit` | `file_key` or `file_json` + `scope/page_id/node_ids/page_ids` | Medium (server fallback fetch from Figma via token if `file_key`) | `source_tool`, `design_document`, `selection_context`; optional `source_ref` for adapter fetch | Medium | Keep v1 fields, add v2 fields, prefer v2 when present |
| `POST /api/agents/a11y-audit` | `file_key` or `file_json` + scope fields | Medium (same as above) | Same v2 shape as ds-audit | Medium | Same dual-path migration |
| `POST /api/agents/ux-audit` | `file_key` or `file_json` + scope fields | Medium (Figma fetch path + Kimi) | Same v2 shape + optional `document_budget` hints | Medium | Same dual-path migration |
| `POST /api/agents/sync-scan` | `file_key` or `file_json` + storybook URL/token + scope fields | Medium (Figma fetch path) | `source_tool`, `design_document`, `selection_context`, `external_targets.storybook` | Medium | Add v2 payload while preserving old storybook fields |
| `POST /api/agents/generate` | `file_key` (legacy) or `design_document/source_ref` (new), `prompt`, mode, ds fields, optional screenshot | Medium-high (engine still assumes Figma adapter when source is not inline) | `source_tool`, `design_document` or `source_ref`, `prompt`, `generation_context`, `ds_context_index` | High | `/api/agents/generate-v2` added as alias; migrate callers by feature flag then finalize adapter split |
| `POST /api/agents/generate-feedback` | request id + thumbs/comment | Low | unchanged | Low | no change needed |
| `GET /api/user/ds-imports/context` | file-scoped DS context lookup | Low-medium (keyed by current file model) | `source_tool + source_doc_id` keying | Medium | Backward-compatible lookup aliases |
| `GET /api/history` | new read-model endpoint (`generate_ab_requests` + `credit_transactions`) | None (user-token based) | same endpoint, later split by webapp BFF only if needed | Low | enabled now for webapp/account history views |
| `GET /api/credits` and related credit endpoints | user token based | None (tool-neutral already) | unchanged | Low | immediate reuse from webapp |
| `GET /api/trophies` | user token based | None | unchanged | Low | immediate reuse from webapp |

---

## 2) Shared v2 payload proposal

```json
{
  "source_tool": "figma",
  "source_ref": {
    "doc_id": "abcd1234",
    "page_ids": ["1:2"],
    "node_ids": ["3:4"]
  },
  "selection_context": {
    "scope": "all",
    "selection_type": "Page",
    "selection_name": "Checkout"
  },
  "design_document": {
    "document": { "type": "DOCUMENT", "children": [] },
    "components": {}
  },
  "ds_context_index": { "hash": "..." },
  "generation_context": {
    "mode": "create",
    "prompt": "Create a pricing screen"
  }
}
```

Rules:
- At least one between `design_document` and `source_ref` is required.
- Adapter layer resolves `source_ref` to normalized `design_document`.
- Engine layer never calls provider APIs directly.

---

## 3) Responsibility split (target)

| Layer | Keep here | Move out if present |
|---|---|---|
| Plugin adapter (Figma/Penpot) | canvas read/write, selection capture, apply action plan | heavy prompt/context assembly, cross-provider orchestration |
| Backend adapters | fetch/normalize provider docs, auth/token refresh, provider-specific retries | AI policy logic, business rules |
| Backend engines | audit/generate/sync logic on normalized doc, validation, repair, telemetry | provider SDK calls |
| Webapp | account/history/read-only analytics, optional prompt studio | canvas write ops |

---

## 4) First-step sequence (lowest risk)

1. [x] Add v2 fields to `ds-audit`, `a11y-audit`, `ux-audit`, `sync-scan` without breaking v1.
2. [x] Implement adapter function `resolveDesignDocument(payload)` in backend and reuse across agent endpoints.
3. [x] Add `generate-v2` (parallel endpoint), keep existing `generate` untouched until parity.
4. [x] Introduce lightweight webapp screens reusing existing auth/credits/trophies + read-only history endpoint (`/api/history`) with browser OAuth (popup + poll), local session, refresh/export UX, and dashboard summary.
5. [x] Start plugin cutover to v2 with automatic fallback to legacy endpoint.

---

## 5) Breaking-risk checklist

- Do not remove `file_key`/`file_json` fields until plugin and future adapters are migrated.
- Keep response schemas stable (`issues`, `error`, advisory codes).
- Preserve existing error codes (`FIGMA_RECONNECT`, rate-limit codes, input-too-large codes).
- Add endpoint-level metrics by phase (`resolve_source_ms`, `model_ms`, `execute_ms`) before cutover.

---

## 6) Ownership suggestion

- **Backend contract/adapters:** Ben
- **Plugin adapter slimming:** Ben + Cursor
- **Webapp MVP read layer:** shared
- **Penpot adapter spike:** dedicated branch once v2 contract is merged

---

## 7) Web auth + session decision (current)

- Primary auth provider stays Figma OAuth (same existing backend flow and callback page).
- Webapp session currently uses Bearer JWT from OAuth poll response, stored client-side for MVP.
- No httpOnly cookie session yet: this avoids immediate cross-subdomain credential/CORS complexity while webapp remains read-only.
- If/when migrating to cookie session for web, plan for:
  - `Access-Control-Allow-Credentials: true` and explicit origin allowlist for `app.comtra.dev`
  - cookie attributes tuned for cross-subdomain behavior (`Secure`, `SameSite`, domain strategy)
  - CSRF protections on state-changing routes

