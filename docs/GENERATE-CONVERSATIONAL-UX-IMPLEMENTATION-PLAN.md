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

### Phase 2 — Reasoning summary + chips

- Assistant summaries and first chip set.
- Credit estimate per chip.

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

