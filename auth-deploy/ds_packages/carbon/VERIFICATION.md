# DS package verification — IBM Carbon Design System

**Date:** 2026-04-03  
**Package:** `carbon`  
**Official reference:** [Carbon — Color](https://carbondesignsystem.com/elements/color/overview/), [Type](https://carbondesignsystem.com/elements/typography/overview/), [Themes](https://carbondesignsystem.com/elements/themes/overview/).

| # | Concept | Official / expected | `tokens.json` path | Value in package | Result |
|---|---------|---------------------|-------------------|------------------|--------|
| 1 | Interactive / primary blue | Carbon interactive-01 family (blue 60) | `color.semantic.primary` | `#0F62FE` | **PASS** |
| 2 | Text primary | Gray 100 / text-primary | `color.semantic.on-surface` | `#161616` | **PASS** |
| 3 | Body type 14 | Productive / body-compact-01 scale | `typography.scale.body-medium` | size `14`, lineHeight `22` | **PASS** |
| 4 | Medium radius | Layout / component rounding | `borderRadius.md` | `8` (px) | **PASS** |
| 5 | Error | Red 60 danger | `color.semantic.error` | `#DA1E28` | **PASS** |
