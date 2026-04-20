# Generate Design System (Living Spec)

COMTRA plugin - Generate tab  
Owner: Product + Design + AI UX  
Status: v1.0 (conversational shell baseline)

---

## 1) Purpose

This document defines how `Generate` should look, feel, and speak while preserving the existing execution pipeline.

It is a UI/UX contract for:

- visual consistency
- conversational readability
- component behavior
- copy tone and micro-interactions

It is not a replacement for backend logic, credit policy, or DS gating rules.

---

## 2) Non-negotiables

- Keep `POST /api/agents/generate` and canvas apply flow as source of truth.
- Keep DS scope segregation by `file_key + ds_cache_hash`.
- Keep credit transparency before user-triggered paid actions.
- Keep import flow mandatory when `Custom (Current)` is not ready.

---

## 3) Screen Architecture (Generate)

`Generate` is a single conversational column with four layers:

1. **Top bar** (compact): credits + secondary actions.
2. **Context strip** (collapsible): target context + active DS controls.
3. **Conversation body** (scrollable): preflight, reasoning timeline, refinements.
4. **Composer dock** (bottom): prompt editor + actions + generate CTA.

The center body is the primary visual focus.

---

## 4) Import Architecture (GenerateDsImport)

Import starts as a conversational onboarding, then transitions to operational steps.

Flow:

1. Session confirmation message (live Figma context, no upload required).
2. Conversational feed + collapsible operation bars.
3. Stepper-backed import stages (rules -> tokens -> components -> recap).
4. Confirm and persist snapshot.

Import copy is playful and confident in English, with safe fallback lines when Kimi is unavailable.

---

## 5) Tone of Voice

Target tone:

- warm, sharp, design-native
- slightly cheeky when appropriate
- transparent about effort, cost, and limitations

Avoid:

- robotic legal tone
- fake certainty
- long filler paragraphs

Conversation pattern:

1. acknowledge intent
2. short reasoning
3. next action
4. optional question only when blocking

---

## 6) Visual Tokens (v1)

These are semantic tokens; they may map to Tailwind classes or constants.

- `surface.base`: soft warm neutral (conversation container)
- `surface.elevated`: white
- `surface.subtle`: neutral-50
- `border.soft`: neutral-200
- `accent.primary`: yellow (existing Comtra energy)
- `accent.success`: emerald
- `accent.warning`: amber
- `text.primary`: neutral-900
- `text.secondary`: neutral-600
- `radius.lg`: container/cards
- `radius.full`: chips/tabs pills
- `shadow.soft`: low elevation

Rules:

- prefer soft borders and low shadows over heavy brutal blocks in conversation areas
- reserve high-contrast black framing for critical controls/CTAs only

---

## 7) Component Rules

### 7.1 Top bar

- compact height, no oversized badges
- credits always visible
- no duplicated utility actions

### 7.2 Context strip (`details`)

- closed state: one-line summary (target + DS)
- open state: context controls, DS selector, DS status, re-import command
- must not dominate vertical space

### 7.3 Conversation timeline

- user and assistant bubbles visually distinct
- readable line-height and padding
- timeline area scrollable with stable max height in plugin viewport

### 7.4 Action logs (import)

- collapsible "operation bars" with concise labels
- optional details list shown on expand
- states: idle, active, completed, failed

### 7.5 Refinement chips

- chip buttons should look lightweight and reversible
- always show credit estimate hint
- disabled states clear and consistent

### 7.6 Composer dock

- visually docked at bottom of conversation card
- contains:
  - enhance / enhance+
  - rich prompt input
  - generate CTA
  - short hints

---

## 8) Accessibility and Readability

- minimum touch target ~36 px for interactive chips/buttons
- color must not carry state alone
- summary labels should be understandable without expansion
- animated/loading text must stay concise and non-blocking

---

## 9) Telemetry Hooks for UX Evolution

Track these events for iterative improvement:

- `generate_import_session_confirmed`
- `generate_import_operation_expanded`
- `generate_context_strip_toggled`
- `generate_preflight_opened`
- `generate_refinement_chip_clicked`
- `generate_thread_switched`
- `generate_composer_submit`

Telemetry is for UX optimization, not user-facing behavior changes.

---

## 10) Change Policy (How to Evolve)

When changing the UI:

1. update this file first (intent + rules)
2. implement smallest viable visual delta
3. run build and sanity checks in plugin viewport
4. verify no behavioral regression in:
   - DS import gating
   - credits flow
   - generate/apply
   - thread scope by DS hash

Recommended versioning:

- patch: copy/spacing/visual polish
- minor: layout shifts within same flow
- major: flow restructuring or new interaction model

---

## 11) Current v1 Snapshot

Already aligned in code:

- conversational import gate with session confirmation + Kimi/fallback narration
- operation bars for import progress
- compact top bar and collapsible context+DS strip
- conversational column with scroll body + composer dock

Still improving:

- unify spacing scale and typography between import and main chat
- reduce visual leftovers from legacy brutal cards
- expand reusable subcomponents for maintainability

