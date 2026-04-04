# DS package verification — iOS Human Interface Guidelines

**Date:** 2026-04-03  
**Package:** `ios-hig`  
**Official reference:** [Apple HIG — Color](https://developer.apple.com/design/human-interface-guidelines/color), [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout).

| # | Concept | Official / expected | `tokens.json` path | Value in package | Result |
|---|---------|---------------------|-------------------|------------------|--------|
| 1 | System blue (labels/links) | iOS systemBlue | `color.semantic.primary` | `#0A84FF` | **PASS** |
| 2 | Primary label / text | `label` / dark primary | `color.semantic.on-surface` | `#1C1C1E` | **PASS** |
| 3 | Body typography | SF Pro, ~17pt body, ~15pt secondary | `typography.scale.body-large` | size `17`, lineHeight `24` | **PASS** |
| 4 | Font family | SF Pro | `typography.families.primary` | `SF Pro Text` | **PASS** |
| 5 | Grouped background | iOS grouped secondary background | `color.semantic.surface-variant` | `#F2F2F7` | **PASS** |

**Note:** Some container tokens in this bundle mirror other Comtra packages for schema consistency; re-audit if you need strict 1:1 Apple color asset names.
