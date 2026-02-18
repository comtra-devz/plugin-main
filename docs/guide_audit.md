# Audit Engine Logic

## Checks
- **Tokens**: Duplicates, Unused, Hardcoded values.
- **Components**: Missing variants, Inconsistent props.
- **Naming**: Regex pattern matching (e.g., `Category/Component/Variant`).
- **A11y**: Contrast ratios, Touch targets (44px+).

## AI Refactor Prompt
"Analyze these components:
1. Identify duplicate variants.
2. Standardize naming to PascalCase.
3. Replace hex codes with nearest Token ID."