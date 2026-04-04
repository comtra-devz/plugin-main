# DS package verification — Material Design 3

**Date:** 2026-04-03  
**Package:** `material3`  
**Official reference:** [Material Design 3 — Color](https://m3.material.io/styles/color/overview), [Type scale](https://m3.material.io/styles/typography/overview), shape tokens as documented alongside components.

This file checks **five representative tokens**: semantic primary color, on-surface text, body-large type scale, medium corner radius analogue, and spacing scale step.

| # | Concept (official / md.sys intent) | Official source | `tokens.json` path | Value in package | Result |
|---|-----------------------------------|-----------------|-------------------|------------------|--------|
| 1 | Primary brand color | M3 light theme primary roles map to primary container palette | `color.semantic.primary` | `{color.primitive.primary40}` → resolved `#6750A4` | **PASS** — aligns with M3 default primary purple family |
| 2 | On-surface default text | M3 on-surface / on-background for legible body | `color.semantic.on-surface` | `#1C1B1F` (primitive neutral10) | **PASS** — matches M3 neutral on-surface range |
| 3 | Body large typescale | md.sys.typescale.body-large size / line height | `typography.scale.body-large` | size `16`, lineHeight `24`, weight `400` | **PASS** — matches M3 body large spec |
| 4 | Medium shape / corner | M3 “medium” corner category (~12dp components) | `borderRadius.md` | `12` (px) | **PASS** — consistent with M3 medium rounding |
| 5 | Medium spacing increment | M3 spacing grid (8dp base; md often 12) | `spacing.md` | `12` | **PASS** — standard M3-friendly step |

**Notes:** Comtra stores tokens under `color.semantic.*` and `typography.scale.*` rather than literal `md.sys.*` JSON paths; semantic equivalence is documented here, not a byte-for-byte copy of Google’s token export format.
