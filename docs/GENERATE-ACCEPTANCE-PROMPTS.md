# Generate Acceptance Prompts

These prompts are the mandatory acceptance suite for DS-governed Generate.
Each prompt must pass schema validation, DS validation, and context-profile constraints.

## Suite

- **AT-01 Dashboard Analytics**: il test piu ampio, copre il range massimo di componenti e token in un singolo output.
- **AT-02 Checkout Mobile**: multi-step flow, valida i vincoli mobile (48px touch target) e la gestione form states.
- **AT-03 DS Conversion (Modify)**: il test governance puro, verifica che il mapping sia semantico e non visivo.
- **AT-04 Screenshot Recreation**: testa la pipeline multimodale Kimi K2.5, dal raster al node tree governato.
- **AT-05 Complex Form**: stress test sullo state-mapping, ogni campo deve avere tutti i 5 stati con token corretti.
- **AT-06 Navigation Layout**: composizione complessa, verifica regole di gerarchia elevation e mutual exclusion dei componenti nav.
- **AT-07 Feedback Patterns**: dialog, snackbar, progress, tooltip, badge; componenti con piu stati per viewport.
- **AT-08 Data-Dense Table**: consistenza token a scala, 50+ celle con token identici senza derive.
- **AT-09 Empty States**: governance nei contesti a basso contenuto, dove tipicamente si rompono le regole.
- **AT-10 Accessibility**: WCAG 2.2 AA enforced a livello di generazione, focus indicators, contrast ratios, touch targets.

## Pass Criteria

- `action_plan` valido rispetto allo schema.
- Nessun `DS_VALIDATION_FAILED`.
- Nessun token o componente fuori package DS selezionato.
- Rispetto del `context_profile` (`platform`, `density`, `input_mode`, `selection_type`).
- Per `AT-04`, output coerente con la struttura dello screenshot e con regole/token DS.
