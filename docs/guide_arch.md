# Architecture Flow

1. **Extraction**: Plugin UI -> JSON Export (Figma Nodes).
2. **Orchestrator**: Backend receives JSON.
3. **Audit Engine**: Checks duplicates, hardcoded styles, a11y.
4. **AI Layer**: Suggests refactors/merges.
5. **Report**: Returns Score + Issues to Plugin.
6. **Action**: Designer applies fixes.
7. **Sync**: Backend generates React code -> Pushes to Storybook.
8. **Loop**: AI learns from accepted changes.