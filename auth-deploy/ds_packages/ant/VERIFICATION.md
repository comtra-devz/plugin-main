# DS package verification — Ant Design

**Date:** 2026-04-03  
**Package:** `ant`  
**Official reference:** [Ant Design — Colors](https://ant.design/docs/spec/colors), [Typography](https://ant.design/components/typography), component tokens for radius.

| # | Concept | Official / expected | `tokens.json` path | Value in package | Result |
|---|---------|---------------------|-------------------|------------------|--------|
| 1 | Primary | Ant primary blue (`colorPrimary`) | `color.semantic.primary` | `#1677FF` | **PASS** |
| 2 | Body text size | Default body ~14px | `typography.scale.body-medium` | size `14`, lineHeight `22` | **PASS** |
| 3 | Control corner | Small radius (≈2–8px) | `borderRadius.md` | `8` (px) | **PASS** |
| 4 | Error | Ant error red | `color.semantic.error` | `#FF4D4F` | **PASS** |
| 5 | Surface / background | Default page white / light gray | `color.semantic.surface` | `#FFFFFF` | **PASS** |

**Note:** Font family is `Inter` in this bundle (Ant docs often reference system stacks); sizes and chroma above track the Ant Design token intent.
