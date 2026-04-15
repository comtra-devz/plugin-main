# Generate Gates Policy Matrix

COMTRA by Ben & Cordiska — Aprile 2026

---

## 1) Objective

Define a clear policy for Generate validations:

- Which gates are always blocking (**hard**)
- Which gates may degrade to warnings in constrained DS states (**soft**)
- What UX fallback to show when data is missing

This document is the operational contract between:

- backend validation flow
- plugin UX/copy
- conversational Generate behavior

---

## 2) Gate glossary

- **G1 Schema**: action plan structure validity (`validateActionPlanSchema`)
- **G2 DS package rules**: no invented refs against resolved DS package (`validateActionPlanAgainstDs`)
- **G3 Visible content**: no empty shell output (`validateActionPlanVisiblePrimitives`)
- **G4 Public DS instance rule**: instance restrictions on public DS (`validateActionPlanNoInstanceForPublicDs`)
- **G5 File DS index**: refs must exist in imported custom index (`validateActionPlanAgainstFileDsIndex`)

Error examples:

- `ACTION_PLAN_SCHEMA_FAILED`
- `DS_VALIDATION_FAILED`
- `VISIBLE_CONTENT_REQUIRED`
- `PUBLIC_DS_NO_INSTANCE`
- `FILE_DS_INDEX_VIOLATION`

---

## 3) DS input quality profile

For `Custom (Current)`, classify DS context as:

- **A — Full**: components + rules/guidance + tokens/styles available
- **B — Components-first**: components available, rules/guidance missing, tokens/styles partial/zero
- **C — Weak custom**: components missing or empty index

For public DS packages, use profile:

- **P — Public package**: package-driven constraints, no file index dependency

---

## 4) Policy matrix (hard vs soft)

| Profile | G1 Schema | G2 DS Rules | G3 Visible | G4 Public Instance | G5 File DS Index | Decision |
|---|---|---|---|---|---|---|
| A Full (custom) | **Hard** | **Hard** | **Hard** | n/a | **Hard** | Full strict mode |
| B Components-first (custom) | **Hard** | **Hard** (components refs strict, token refs relaxed with warning) | **Hard** | n/a | **Hard** for components, **Soft warning** for token refs | Controlled degrade |
| C Weak custom | **Hard** | **Hard** | **Hard** | n/a | **Hard fail** | Stop and require re-import |
| P Public package | **Hard** | **Hard** | **Hard** | **Hard** | n/a | Public strict mode |

Notes:

- `Schema` and `Visible content` are always hard.
- `File DS index` can be partially softened only in profile B and only for token refs (never for components).
- If components are missing in custom DS, fail early (profile C).

---

## 5) Minimal requirement policy (custom DS)

Recommended minimum for runnable custom DS:

- **Required**: components catalog (`components > 0`)
- **Recommended**: rules/guidance
- **Optional with warning**: tokens/styles

Implication:

- Missing tokens/styles should not fully block if components catalog is solid.
- Missing components should block generation for custom DS.

---

## 6) Backend behavior by failure type

### 6.1 Always blocking (422)

- G1 schema fail
- G3 visible content fail
- G4 public instance fail
- G5 components refs fail (custom)

### 6.2 Degrade with warnings (200 + metadata warnings)

Only when profile B:

- token refs not found in file index
- rules/guidance unavailable
- styles/tokens unavailable in file

Backend should append metadata warnings such as:

- `rules_missing`
- `guidance_missing`
- `token_index_partial`
- `styles_unavailable`

---

## 7) UX fallback policy (plugin)

### 7.1 For profile B (degrade mode)

Show non-blocking notice:

- "Using components-first alignment. Rules/tokens are partial."

Do not block Generate CTA.

### 7.2 For profile C (blocking)

Show blocking callout:

- "Custom DS index is missing components. Re-import this file before Generate."

Keep Generate blocked for `Custom (Current)`.

### 7.3 Error copy mapping

When 422 occurs, map code to explicit next action:

- `ACTION_PLAN_SCHEMA_FAILED` -> "Retry generate (internal plan format issue)."
- `VISIBLE_CONTENT_REQUIRED` -> "Refine prompt to request concrete UI content."
- `FILE_DS_INDEX_VIOLATION` -> "Re-import DS or switch to public package."

---

## 8) Conversational Generate implications

When chat UX is enabled:

- assistant must state active profile (A/B/C/P) in concise form
- if profile B, assistant should mention "components-first mode"
- if profile C, assistant should ask to re-import before spending credits

Action chips availability:

- A/B/P: enabled
- C: disabled until re-import

---

## 9) Telemetry to validate policy

Track:

- gate failure count by code
- profile distribution (A/B/C/P)
- success rate by profile
- credit spend per successful output by profile
- recovery rate after 422 (did user recover in same session?)

---

## 10) Rollout recommendation

1. Implement profile detection server-side from `ds_context_index`.
2. Enforce matrix above in validator orchestration.
3. Add metadata warnings for profile B.
4. Align plugin copy and Generate conversational prompts.
5. Monitor telemetry for 1 week before tightening/relaxing any gate.

