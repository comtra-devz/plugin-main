# DS Audit - Spec Coverage Rules

This extension adds specification-coverage checks to Design System Audit output.
Use these rules to catch missing contracts before they cause implementation drift or unreliable AI interpretation.

## SC-001 Missing component purpose statement
- **Category:** `naming`
- **Severity:** `MED`
- **Detect:** Component exists but has no clear description of intent/usage.
- **Why:** Missing purpose makes downstream decisions inconsistent.
- **Fix:** Add a concise description with intent and usage boundaries.

## SC-002 Variant axis incomplete or ambiguous
- **Category:** `consistency`
- **Severity:** `HIGH`
- **Detect:** Variant/property axis names are ambiguous or states are mixed in labels.
- **Why:** Ambiguous axes break deterministic selection logic.
- **Fix:** Split axes into explicit dimensions (e.g. `Size`, `State`, `Tone`) with normalized values.

## SC-003 Missing prop contract/default behavior
- **Category:** `structure`
- **Severity:** `MED`
- **Detect:** Component has configurable parts but no explicit default/required behavior.
- **Why:** Consumers apply inconsistent overrides.
- **Fix:** Define defaults, optional props, and fallback behavior in the component contract.

## SC-004 Missing state matrix
- **Category:** `consistency`
- **Severity:** `HIGH`
- **Detect:** Interactive component lacks one or more standard states (`default`, `hover`, `focus`, `disabled`, `error` where relevant).
- **Why:** Incomplete states cause implementation gaps and accessibility regressions.
- **Fix:** Add missing states and ensure naming parity across variants.

## SC-005 Missing token binding strategy
- **Category:** `coverage`
- **Severity:** `HIGH`
- **Detect:** Core properties (color, spacing, radius, typography) rely on local values rather than tokens/styles.
- **Why:** Hardcoded values reduce system portability and consistency.
- **Fix:** Bind core properties to semantic tokens or shared styles.
