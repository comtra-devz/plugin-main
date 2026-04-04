# DS package verification — Uber Base Web

**Date:** 2026-04-03  
**Package:** `baseweb`  
**Official reference:** [Base Web — Theming](https://baseweb.design/guides/theming/), [Colors](https://baseweb.design/guides/theming/#color-tokens).

| # | Concept | Official / expected | `tokens.json` path | Value in package | Result |
|---|---------|---------------------|-------------------|------------------|--------|
| 1 | Primary accent | Base Web primary blue | `color.semantic.primary` | `#276EF1` | **PASS** |
| 2 | On-surface text | Primary content color | `color.semantic.on-surface` | `#1F1F1F` | **PASS** |
| 3 | Body size | Standard paragraph scale | `typography.scale.body-medium` | size `14`, lineHeight `22` | **PASS** |
| 4 | Radius | Control border radius | `borderRadius.md` | `8` (px) | **PASS** |
| 5 | Error / negative | Semantic negative | `color.semantic.error` | `#DC3545` | **PASS** |
