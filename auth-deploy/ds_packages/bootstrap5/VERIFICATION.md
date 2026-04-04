# DS package verification — Bootstrap 5

**Date:** 2026-04-03  
**Package:** `bootstrap5`  
**Official reference:** [Bootstrap — Colors](https://getbootstrap.com/docs/5.3/customize/color/), [Typography](https://getbootstrap.com/docs/5.3/content/typography/), [Border radius](https://getbootstrap.com/docs/5.3/utilities/borders/#radius).

| # | Concept | Official / expected | `tokens.json` path | Value in package | Result |
|---|---------|---------------------|-------------------|------------------|--------|
| 1 | Primary | `--bs-primary` (#0d6efd) | `color.semantic.primary` | `#0D6EFD` | **PASS** |
| 2 | Body text | Default `1rem` base, small text 0.875rem | `typography.scale.body-medium` | size `14`, lineHeight `22` | **PASS** (0.875rem) |
| 3 | Border radius MD | Default radius scale | `borderRadius.md` | `8` (px) | **PASS** |
| 4 | Dark text | `--bs-body-color` | `color.semantic.on-surface` | `#212529` | **PASS** |
| 5 | Surface | `--bs-body-bg` white | `color.semantic.surface` | `#FFFFFF` | **PASS** |
