# Comtra Plugin Requirements

## 1. Code Export & Storybook
- **Selection**: User must select specific Figma Frames to generate code.
- **Limits**: Maximum 3 frames selected at once.
- **Formats**: 
  - React + Tailwind (Default)
  - Storybook Stories (`.stories.tsx`)
  - HTML/CSS (Legacy)

## 2. Integrated Audit Dashboard
- **Layout**: Split view. 
  - *Left/Top*: System Health Stats (%), Token Count, Issue Count.
  - *Right/Bottom*: Audit List or Empty State ("Start First Audit").
- **Detail View**: clicking an issue opens a detail panel containing:
  - Description of the error.
  - "Fix it" suggestion.
  - Deep link to the specific Figma Layer/Node.
  - Token reference (e.g., "Use `text-xl` instead of `20px`").

## 3. Deep Sync (New)
- **Access**: PRO Plan only.
- **Platforms**: Storybook (Active), GitHub (Coming Soon).
- **Workflow**:
  1. Connect Account (OAuth mock).
  2. Scan for "Drift" (Differences between Figma and Code).
  3. List unsynced components.
  4. Actions: Sync Individual, Sync All, Go to Figma Component.
- **Feedback**: Positive empty state when 100% synced.

## 4. Generative AI
- **Guidance**: Provide context tips below the prompt area (e.g., "Wireframe desktop...").
- **Access**: Pro users only.

## 5. General
- **Style**: Brutalist (Gumroad-like). Pink primary, heavy borders.
- **Auth**: Freemium model (20% scan for free).