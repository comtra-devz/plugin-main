# Generate: Simple Operating Policy and Flow

Updated: April 2026

## 1) Goal in plain words

Generate must produce a usable screen even when the prompt is short or incomplete.

Priority order:

1. Make the base result work.
2. Keep the result aligned to the selected design system.
3. Explain limits and warnings in simple language.

---

## 2) Operating policy (formalized)

### A. Prompt can be poor

- User can send short prompts (for example: "mobile login").
- System must infer missing basics: viewport, hierarchy, required UI blocks, and default spacing rhythm.
- Missing details should not block generation by default.

### B. Gap filling is required

If prompt/data is incomplete, Generate fills gaps with safe defaults:

- infer screen archetype (login/dashboard/form/profile)
- infer key slots (title, inputs, primary CTA, optional logo)
- infer layout structure (main frame + visible content + coherent container hierarchy)

### C. Quality floor is non-negotiable

Generated output must respect minimum quality:

- no empty shell
- no clearly wrong semantic component (example: progress bar as login CTA)
- no fixed tiny layout artifacts that hide components
- preserve DS component usage when DS index provides valid instances

### D. DS-first, then graceful fallback

- Prefer real DS components and known refs (`component_key` + `component_node_id` when available).
- If a specific style/component is unavailable, fallback to best-practice structure while staying readable.
- Surface warning rows in wizard so user knows what was missing.

### E. Transparent behavior

- During generate, show current phase (context -> server model -> canvas apply -> credits).
- On limits/fallbacks, provide simple reason and action (re-import, enable libraries, etc.).

---

## 3) What happens in Generate (simple flow)

1. User enters prompt and clicks Generate.
2. Plugin resolves current file context and DS source.
3. Backend receives prompt + DS context index.
4. Backend builds candidate slots and validates plan quality.
5. Backend returns action plan JSON.
6. Plugin preflights component/variable resolution.
7. Plugin applies nodes on canvas.
8. Credits are consumed only after successful canvas apply.
9. User sees report and can apply again if needed.

---

## 4) Why output can still differ from "perfect"

Typical reasons:

- linked-library styles are not fully exposed as local styles/tokens
- DS has no explicit logo/title/description components
- DS components exist, but naming is ambiguous for semantic matching
- prompt is extremely short and leaves many structural choices open

In these cases Generate should still produce a coherent result, then warn clearly.

---

## 5) Best-practice fallback defaults (used when DS data is incomplete)

These defaults are intentional and should be treated as "safe baseline":

- spacing rhythm: 4 / 8 / 12 / 16 / 24 / 32
- login skeleton: title, credential block(s), single primary CTA, secondary action
- auto-layout preference: fill width + hug height in vertical stacks
- title emphasis over body style for heading-like nodes

These values are not "brand style"; they are fallback logic to avoid broken output.

---

## 6) Fine-tuning levers (for future iterations)

When tuning quality, adjust in this order:

1. **Slot matching rules**  
   Improve semantic mapping (for example, stricter CTA = button, not card).

2. **DS context quality**  
   Improve import index quality (logo/title/description detection, local style coverage).

3. **Executor layout behavior**  
   Improve auto-layout sizing defaults and avoid harmful fixed dimensions.

4. **Prompt shaping**  
   Refine system prompt constraints only after steps 1-3 are stable.

5. **Fallback behavior**  
   Keep fallback deterministic and minimal; fallback must never replace core success path.

---

## 7) Practical acceptance checklist

For a "good enough" Generate run:

- DS recognized for current file
- at least one meaningful DS component instance used
- no obvious semantic mismatch in key actions
- no tiny fixed-box layout that hides components
- text hierarchy is readable (title vs body)
- user can understand warnings without technical jargon

---

## 8) Existing deeper docs

If you need low-level details, see:

- `docs/GENERATE-GATES-POLICY-MATRIX.md`
- `docs/GENERATE-DS-IMPORT-CONTESTO-E-RAGIONAMENTO.md`
- `docs/GENERATE-DS-IMPORT-TECH-REPORT.md`
