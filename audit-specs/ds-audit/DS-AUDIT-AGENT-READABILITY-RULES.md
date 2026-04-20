# DS Audit — Agent Readability Rules (English)

Purpose: extend **Design System Audit** with deterministic checks that improve design-system readability for AI agents and humans.

Scope note: this is a **DS Audit** extension. Mentions to Generate are optional context only.

---

## Category and output conventions

- Keep category IDs already used by DS Audit (`adoption`, `coverage`, `naming`, `structure`, `consistency`, `copy`, `optimization`).
- Add `rule_id` for every issue in this extension (`AR-001` ... `AR-010`).
- Keep standard severities: `HIGH`, `MED`, `LOW`.
- Keep fix text actionable and Figma-specific.

---

## Rule set (implementation-ready)

### AR-001 — Generic layer/component naming
- **Category:** `naming`
- **Severity:** `HIGH` (component roots), `MED` (internal groups)
- **Detect when:** node `name` matches default/generic patterns (`Frame 12`, `Group 5`, `Rectangle 2`, `Copy`, etc.).
- **Why it matters:** weak semantic names reduce DS discoverability and maintainability.
- **Fix text:** "Rename with semantic intent (e.g. `Button/Primary`, `Card/Header`, `Input/HelperText`)."

### AR-002 — Missing component description
- **Category:** `adoption`
- **Severity:** `MED`
- **Detect when:** component metadata description is empty/missing.
- **Why it matters:** component usage contract is not explicit.
- **Fix text:** "Add a component description with purpose, usage boundaries, and variant notes."

### AR-003 — Ambiguous variant/property names
- **Category:** `naming`
- **Severity:** `HIGH`
- **Detect when:** variant/property names are generic (`Type`, `Var`, `State1`, `Option`, `Value`) or inconsistent within a set.
- **Why it matters:** component APIs become hard to use and easy to misuse.
- **Fix text:** "Rename properties to explicit API labels (e.g. `Size`, `State`, `Tone`, `LeftIcon`)."

### AR-004 — Hardcoded core colors (no token/style binding)
- **Category:** `coverage`
- **Severity:** `HIGH`
- **Detect when:** core UI layers have local paint values with no variable binding and no style reference.
- **Why it matters:** breaks single source of truth for color.
- **Fix text:** "Bind to semantic color token/style (e.g. `color.surface.default`, `text.on-primary`)."

### AR-005 — Hardcoded spacing/radius values
- **Category:** `coverage`
- **Severity:** `MED`
- **Detect when:** padding, gap, or corner radius values are outside project spacing/radius scales or not tokenized.
- **Why it matters:** creates DS drift and visual inconsistency.
- **Fix text:** "Use spacing/radius tokens from DS scale (e.g. `space.2`, `space.3`, `radius.md`)."

### AR-006 — Text nodes not using DS text styles
- **Category:** `coverage`
- **Severity:** `HIGH`
- **Detect when:** text nodes use raw font size/weight/line-height with no text style/token linkage.
- **Why it matters:** typography system is bypassed.
- **Fix text:** "Apply DS text style/token (e.g. `Text/Body/Medium`, `Text/Heading/H3`)."

### AR-007 — Absolute layout where auto-layout is expected
- **Category:** `structure`
- **Severity:** `MED`
- **Detect when:** repeated UI containers rely on absolute positioning instead of auto-layout for linear content.
- **Why it matters:** poor resilience and harder DS reuse.
- **Fix text:** "Convert container to auto-layout and drive spacing/alignment through DS scale."

### AR-008 — Redundant style definitions
- **Category:** `consistency`
- **Severity:** `MED`
- **Detect when:** same visual style is repeated as local values across multiple nodes without shared style/token.
- **Why it matters:** multiplies maintenance effort and inconsistency risk.
- **Fix text:** "Create/apply shared style or token and replace local duplicates."

### AR-009 — Variable collection/mode naming is too generic
- **Category:** `naming`
- **Severity:** `MED`
- **Detect when:** variable collections/modes/tokens use unclear names (`Default`, `New`, `Blue1`, `Var2`) without hierarchy.
- **Why it matters:** token semantics become unclear across teams.
- **Fix text:** "Adopt hierarchical token naming (primitive + semantic), e.g. `color.blue.500` and `color.surface.default`."

### AR-010 — DS structure lacks clear composition contracts
- **Category:** `adoption`
- **Severity:** `MED`
- **Detect when:** reusable components expose no clear slot/composition strategy (inconsistent child structures for same component intent).
- **Why it matters:** reuse decreases and divergence increases over time.
- **Fix text:** "Define explicit slot/composition model (e.g. `LeftIcon`, `Content`, `RightAction`) and normalize structure."

---

## Suggested rollout (DS Audit only)

### Phase 1 (safe defaults)
- Enable AR-001, AR-004, AR-006 as high-signal checks.
- Cap new findings to avoid noisy reports (e.g. max 3 new AR issues per run).

### Phase 2 (broader quality)
- Enable AR-002, AR-003, AR-005, AR-007, AR-008.

### Phase 3 (governance maturity)
- Enable AR-009, AR-010.

---

## JSON shape example

```json
{
  "id": "ds-ar-001",
  "rule_id": "AR-001",
  "categoryId": "naming",
  "severity": "HIGH",
  "layerId": "12:345",
  "nodeName": "Frame 87",
  "msg": "Generic component naming reduces design-system readability.",
  "fix": "Rename with semantic intent, e.g. Button/Primary."
}
```

