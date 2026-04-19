# Generate Conversational UX — Implementation Plan

COMTRA by Ben & Cordiska — Aprile 2026

---

## 1) Scope and principle

Primary goal:

- Transform `Generate` into a real conversational experience without changing current generation logic as default behavior.

Hard rule:

- Conversation is an orchestration layer.
- Existing logic (DS gating, validation, credits, apply flow, repair flow) remains the source of truth.
- User can steer behavior during conversation; defaults stay unchanged.

Execution order:

1. Verify `Generate` stability and DS recognition end-to-end.
2. Implement conversational UX changes.

---

## 2) Precondition gate: Generate must be stable first

Before UX refactor starts, all checks below must pass.

### 2.1 Plugin startup

- Plugin opens with no startup runtime errors.
- No sandbox SyntaxError loops in Figma console.

### 2.2 DS recognition for `Custom (Current)`

- For imported file:
  - DS is recognized as ready.
  - Generate does not force re-import incorrectly.
- For non-imported file:
  - UI correctly asks for import.

### 2.3 Generate execution baseline

- `POST /api/agents/generate` returns valid action plan or explicit actionable error.
- No ambiguous "silent fail" path.
- Credits and apply-to-canvas flow operate as expected.

### 2.4 Server context shape robustness

- `GET /api/user/ds-imports/context` accepted whether `ds_context_index` arrives as object or JSON string.
- Client and server both normalize safely.

---

## 3) Product intent for conversational Generate

### 3.1 What conversation must do

- Let user ask, refine, and iterate naturally.
- Expose concise reasoning summary.
- Offer contextual actions under assistant responses.
- Preserve context from:
  - selected frame/layer
  - screenshot upload
  - active DS import/snapshot

### 3.2 What conversation must NOT do

- Must not bypass existing validations.
- Must not introduce hidden "alternative pipelines" without explicit product decision.
- Must not consume credits opaquely.

---

## 4) ToV (Tone of Voice) for conversational agent

Target ToV: **design-aware, easy going, practical**.

Style rules:

- Friendly and confident, never robotic.
- Design-language native (hierarchy, rhythm, density, affordance, contrast).
- Brief by default, expands on request.
- Gives options, does not over-command.
- Always clear about impact and cost before action.

Response structure:

1. Intent understanding (1 short line)
2. Reasoning summary (2-4 bullets, concise)
3. Proposed action (what will be generated/changed)
4. Optional clarifying question (only if needed)
5. Credit hint when action has cost

Avoid:

- Overly formal or legalistic tone
- Long verbose disclaimers
- Generic motivational filler

---

## 5) Conversational UX blueprint (plugin)

### 5.1 Layout model

Generate view becomes:

- Persistent context strip/card (top)
  - active DS
  - context source (selection or screenshot)
  - quick status
- Conversation timeline (center)
  - user bubbles
  - assistant bubbles
  - reasoning summary blocks
  - action chips blocks
- Composer (bottom)
  - text input
  - Enhance Prompt action
  - Generate action
  - optional quick attach/select context actions

### 5.2 Keep existing actions, but conversationally

- `Enhance Prompt`: kept as a first-class composer action.
- Context layer:
  - "Use selected layer"
  - "Upload image"
  - clear visual badge of active context.
- Generate CTA:
  - unchanged core behavior
  - conversational entrypoint.

### 5.3 Reasoning display

- Show "Reasoning summary" (safe summary, not raw chain-of-thought).
- Collapsible details block optional.

### 5.4 Contextual action chips

Shown under assistant bubble after first generate or refinement turn.

Initial chip set (example):

- Tighten spacing
- Increase visual hierarchy
- Stronger CTA emphasis
- Mobile adaptation
- Cleaner density

Each chip shows estimated credit cost before execution.

---

## 6) Credits model for post-first-generate chips

Policy: chip actions are paid refinements after first generation.

Suggested cost tiers:

- Light: 1 credit
  - micro-adjustments (spacing/contrast emphasis)
- Medium: 2 credits
  - moderate structural variation
- Heavy: 3 credits
  - strong layout alternative/regeneration
- XL (optional): 4-5 credits
  - multi-variant compare output

Rules:

- Always display estimated cost pre-action.
- Final consume happens only after successful execution path.
- If validation fails, no hidden extra consume.

---

## 7) Threads and conversation memory

### 7.1 Scope

Thread scope should be contextual to DS:

- key = `file_key + ds_cache_hash` (recommended)

Benefits:

- history follows specific imported DS snapshot
- avoids cross-DS confusion

### 7.2 UI model

- Add "Conversations" tab/panel in Generate:
  - current thread
  - recent threads
  - start new thread

### 7.3 Persistence

- Plugin: fast local cache for current thread
- Backend: canonical persistence for thread history

---

## 8) Plugin vs Web split (hybrid architecture)

### 8.1 Plugin responsibilities (execution cockpit)

- Live context binding (selected layer/screenshot)
- Conversational timeline for active work
- Generate/apply actions
- Credits preview + execution confirmation
- Current thread interaction

### 8.2 Web responsibilities (management/governance)

- Full conversation archive and search
- Prompt library and reusable playbooks
- ToV and policy configuration UI
- Analytics (conversion, drop-off, cost per successful output)
- Team review and quality audit surfaces

Principle:

- Plugin = real-time design execution
- Web = memory, governance, analytics

---

## 9) Backend/API plan (incremental)

Keep current generate endpoint and add conversation layer APIs.

Suggested additions:

- `POST /api/generate/threads`
- `GET /api/generate/threads?file_key=&ds_hash=`
- `GET /api/generate/threads/:id/messages`
- `POST /api/generate/threads/:id/messages`
- `POST /api/generate/threads/:id/actions/:chipId`

Compatibility:

- Existing `POST /api/agents/generate` stays unchanged initially.
- Conversation actions call same generate logic with structured intents.

---

## 10) Data model draft

Tables (draft):

- `generate_threads`
  - id
  - user_id
  - file_key
  - ds_cache_hash
  - title
  - created_at
  - updated_at
- `generate_messages`
  - id
  - thread_id
  - role (`user|assistant|system`)
  - message_type (`chat|reasoning_summary|action_result|error`)
  - content_json
  - credit_estimate
  - credit_consumed
  - created_at

---

## 11) Rollout phases

### Phase 0 — Stabilization (now)

- Complete precondition gate from section 2.

### Phase 1 — Conversational shell (plugin UI only)

- New layout with timeline + composer + context strip.
- Existing generate logic wired unchanged.

### Phase 1.5 — Transparency + expectability (Generate)

- Phase strip / labels aligned to `generateStep` and server timings where available.
- Conservative “how long this can take” messaging for the full pipeline (see §15).
- DS import wizard: same expectability pattern for long index builds (cross-link §15.3).

### Phase 2 — Reasoning summary + chips

- Assistant summaries and first chip set.
- Credit estimate per chip.

### Phase 2.5 — Pre-flight clarifier (Questions light)

- Archetype-aware chips / compact clarifier before final generate when triggers fire (§15.2).
- Merge answers into prompt or overrides; telemetry on dismiss vs complete (§15.4–§15.5).

### Phase 3 — Thread persistence

- Thread list + current thread restore.

### Phase 4 — Web conversation hub

- Archive, search, governance, analytics.

### Phase 5 — ToV tuning and quality iteration

- Refine assistant prompts and response behavior with telemetry.

---

## 12) Acceptance criteria (MVP conversational)

- User can run full Generate flow via chat composer with same output quality as current screen.
- Context source (selection/screenshot) is always visible and explicit.
- Assistant provides concise reasoning summary on each major turn.
- At least 3 contextual chips are available post-first-output with visible credit estimate.
- Thread persists and reloads for same `file_key + ds_cache_hash`.
- No regression in DS recognition, validation, or apply-to-canvas flow.

---

## 13) Immediate next steps (recommended)

1. Confirm Generate stability gate on current branch.
2. Approve this plan (sections 5, 6, 8, 11).
3. Start Phase 1 with a UI-only implementation branch.
4. Instrument minimal telemetry from day one:
   - `generate_chat_turn_started`
   - `generate_chat_turn_succeeded`
   - `generate_chip_clicked`
   - `generate_chip_succeeded`
   - `generate_chip_failed`

---

## 14) Implementation trace (already done before full conversational UI)

This section tracks groundwork already implemented so Phase 1/2 conversational UX can ship faster.

### 14.1 Backend (generate core) groundwork done

- **P0-P4 foundation active**:
  - DS readiness gate for custom DS
  - deterministic slot candidate binding
  - layout quality contract gate
  - diagnostics payload (`generation_diagnostics`)
  - deterministic fallback before hard fail
- **Slot metadata for downstream execution**:
  - `slot_id` is now written on `INSTANCE_COMPONENT` actions after slot assignment.
- **User-confirmed assignment override support (conversation-ready)**:
  - `POST /api/agents/generate` accepts:
    - `component_assignment_overrides`
      - shape: `slot_id -> { component_key, component_node_id }`
  - overrides are applied to slot candidates before binding.
- **Ranking upgrade (global, not button-only)**:
  - slot ranking uses:
    - component name
    - slot hints
    - prompt token overlap
    - page context (`pageName`)
    - page order (`pageOrder`) tie-break
- **Semantic hardening**:
  - CTA slot penalizes card-like candidates when they are not explicit button/cta/action controls.

### 14.2 DS context index groundwork done

- Component summaries include:
  - `pageName`
  - `pageOrder`
- This enables page-aware ranking and future explainability ("why this component was selected").

### 14.3 Plugin executor groundwork done

- **Resolution success path improved**:
  - prefers resolvable node IDs in-file
  - local fallback by published component key when import-by-key fails
- **Auto-layout visibility fixes**:
  - avoids harmful tiny fixed sizes (e.g., 100x100 artifacts)
  - better FILL/HUG behavior in vertical/horizontal stacks
- **Property engine v1**:
  - supports explicit `variantProperties` / `properties`
  - adds smart fallback for `TEXT` and selected `BOOLEAN` props
  - uses `slot_id` and prompt signals to reduce placeholder-heavy outcomes

### 14.4 DS import wizard groundwork done

- Added user-facing warnings table in recap:
  - text/paint style coverage
  - spacing variable coverage
  - title/description/logo detection
  - linked-library caveat in simple language
- Internal metrics are used for warnings logic without exposing debug counters in user recap.

### 14.5 Conversational UX implications

Because of the groundwork above, conversational Phase 1/2 can focus on UX instead of backend rewrites:

- chip actions can target slot-level intent safely
- user correction turns can send assignment overrides without schema changes
- timeline explanations can reference diagnostics and slot decisions
- future "teach the model for this DS" loop can be scoped by `file_key + ds_cache_hash`

---

## 15) Benchmark synthesis (Apr 2026) — folded into conversational Generate

External tools (e.g. guided DS onboarding + structured “Questions” before build) reinforce patterns that **do not replace** Enhance: they strengthen **Generate** itself by reducing ambiguity **before** the expensive path (Kimi → validate → credits → canvas).

### 15.1 Three UX pillars to merge with §5–§11

| Pillar | Borrowed idea | Comtra mapping |
|--------|----------------|----------------|
| **Expectability** | Explicit max duration for long operations | Generate: conservative “finché…” copy for AI + validation + apply; tie to `generation_diagnostics.phase_timers` where useful |
| **Progress truth** | Checklist / substeps visible (read → list → render…) | Conversation timeline + optional **phase strip**: contesto → modello → validazione → canvas → crediti (already loosely in `generateStep`; surface as numbered steps, not one spinner) |
| **Structured intent** | Questions tab before build (chips), not prose only | **Pre-flight strip** inside Generate chat: archetype-aware chips when triggers fire (below); confirm summary **before** final POST |

### 15.2 Pre-flight “Questions light” (Generate, not Enhance)

Purpose: prevent collapse to a single `component_node_id` / thin slot pack when the user prompt is underspecified.

**Triggers (any → open clarifier):**

- inferred archetype confidence below threshold (see pack `[CONV_UX]` / `disambiguation_protocol`)
- OR prompt length / entropy below threshold (heuristic)
- OR slot pack for inferred archetype has **too few distinct slots** or **too few candidates per slot** (e.g. dashboard with only `stat_card`)
- OR internal signal “repeat risk”: same slot reused for semantically different regions (detector on draft plan optional in later phase)

**Output:** structured answers merge into:

- appended **Goal / Constraints** block for the model (server), and/or
- `component_assignment_overrides` preview for power users (already supported server-side)

**UX:** Claude-style separation is mimicked minimally: **chat bubble** proposes “Ho bisogno di 2 dettagli” → **inline chip row or compact modal** (same thread, no new product). This is the conversational plan’s **orchestration layer**, not a second pipeline.

### 15.3 DS import parity (wizard) vs Generate

Import wizard already has recap/warnings; align **tone**:

- Same pattern as §15.1 for **expectability** when index build is slow (max time messaging + phase list).
- Optional “what you get at the end” one-liner (aligned with named deliverables in benchmark flows): e.g. “Catalogo componenti + hash per Generate”.

### 15.4 Revised rollout additions (increment to §11)

Insert **between current Phase 1 and Phase 2** (or as **Phase 1.5**):

| Sub-phase | Deliverable |
|-----------|-------------|
| **1.5a** | Phase strip / timeline labels wired to existing `generateStep` + server phases from metadata where available |
| **1.5b** | Copy: upper bound time hint for full Generate run (non-binding disclaimer, product-legal reviewed) |
| **2.5** | Pre-flight clarifier MVP: one archetype first (e.g. `dashboard` + `login`), triggers from §15.2, merge answers into prompt body before `POST /api/agents/generate` |
| **2.6** | Pack-driven questions: read `disambiguation_protocol` / `[CONV_UX]` from Design Intelligence pack when pack v2 present |

Phase 3+ (threads, web hub) unchanged in intent; pre-flight feeds **same** thread as user messages (“User answered: KPI + chart + table”).

### 15.5 Acceptance add-ons (extend §12)

- User sees **step list** during Generate (at least 4 phases) without exposing raw chain-of-thought.
- If clarifier opens, user completes or dismisses explicitly; dismissal logs telemetry and proceeds with degraded risk acceptance.
- No duplicate credit charge for clarifier-only turns (LLM optional: rule-based chips first).

### 15.6 Non-goals (for this merge)

- Full reproduction of external “Design Files / SKILL.md export” inside Figma plugin.
- Replacing DS import wizard with a chat-only import (keep wizard; only align **expectability** patterns).

---

## 16) Implementation coverage vs sections 5–10 (snapshot)

| Section | Topic | Status |
|--------|--------|--------|
| **§5** | Blueprint layout (strip, timeline, composer, chips) | Fatto nel plugin (`Generate.tsx`). |
| **§6** | Tier crediti chip post-output | Policy lato API `generate_refinement_light|medium|heavy`; UI chiama `estimateCredits` per chip; **consumo finale** sempre da `metadata.estimated_credits` dopo run ok. |
| **§7** | Thread `file_key + ds_cache_hash`, lista, nuova, persistenza locale + server | Tabelle + API + pannello inline con **Recenti** (titolo + tempo) + select server; sync lista dopo append. |
| **§8** | Split plugin vs web | Cockpit + tab Chat/Conversazioni nel plugin; admin: **conversazioni** (ricerca anche nei messaggi + analytics plugin), **governance** (playbook + JSON ToV), §17 per azioni deploy/agent. |
| **§9–10** | API + modello dati | `generate_threads` / `generate_messages`; optional `actions/:chipId` = stesso generate (non route separata). |

**Gap noti (post-fase corrente):** Phase 5 ToV iterativo; hub web completo (search full-text, playbooks); trigger §15.2 avanzati (slot pack thin, dual-archetype conflict) se servono in produzione.

---

## 17) Stato “completo piano” + azioni solo umane

Questa sezione aggiorna il gap dopo implementazione nel repo (plugin + admin dashboard + migrazioni).

### Coperto in codice (check)

| Voce piano | Implementazione |
|-------------|-----------------|
| §5.3 Diagnostica collassabile | `<details>` su blocco diagnostica timeline (`Generate.tsx`). |
| §6 Consume refinement | `consumeCredits.action_type` = `generate_refinement_*` da tier chip quando `chipId` è una refinement chip. Importo ancora da `metadata.estimated_credits` del piano server. |
| §8 Ricerca archivio | Admin: ricerca thread anche su **contenuto** `generate_messages.content_json` (ILIKE). |
| §8 Analytics | Admin: `route=generate-plugin-analytics` (eventi `generation_plugin_events` + conteggi thread/messaggi nel periodo). UI riassunto in **Generate · conversazioni**. |
| §8 Playbook + ToV storage | Tabella `generate_playbooks`, `generate_tov_config`; API `POST/GET /api/generate-governance`; pagina **Generate · governance**. |
| §13 Telemetria elenco | Eventi `generate_chat_turn_*`, `generate_chip_*`, `generate_preflight_*` già inviati dal plugin (verificare dashboard/event DB in produzione). |

### Da fare da te (non automatizzabile dal solo codice)

1. **Migrazione DB**: eseguire `auth-deploy/migrations/015_generate_playbooks_and_tov.sql` sul **Postgres usato dalla dashboard admin** (stesso `POSTGRES_URL` dei thread Generate). Senza questo, governance resta 503 / messaggio migrazione.
2. **Deploy**: pubblicare dashboard (nuove route API + pagine) e plugin (consume + UI diagnostica).
3. **Agente Generate (server)**: leggere `generate_tov_config.prompt_overrides` e playbook in `POST /api/agents/generate` / hint layer — oggi sono **persistenza + audit**, non ancora injection automatica nel modello (richiede patch `auth-deploy` agents).
4. **§15.2 avanzati / 2.6 pack**: logica aggiuntiva su slot pack, confidence da pack, ecc. — molti segnali vivono nel motore generate; va pianificato commit per commit nel server agent.
5. **Phase 5 qualità ToV**: revisione copy e prompt con dati reali dopo telemetria in produzione.
6. **§2 gate stabilità**: smoke test manuale ricorrente su Figma (plugin + file importati).

### “TUTTO” letterale del documento

Il piano include intenti **prodotto/legal** (copy upper-bound tempo, review team, analytics conversione avanzate). Restano **processo e prodotti** oltre il repository; il codice qui copre **storage, API, UI admin, plugin behavior** allineati alle sezioni §5–§11 e §8.2 operative.

