# AI Assistant (Screen Gen)

## Input
- User Prompt ("Create dashboard with dark mode").
- Cleaned DS JSON (Tokens + Component definitions).

## Output
- Figma Layout JSON (Auto-layout frames).
- Uses *only* approved components.
- Responsive constraints applied.

## Training
- Capture designer's manual fixes to fine-tune the model.
- Use "Few-Shot" prompting with examples of perfect layouts.