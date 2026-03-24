# Code Generation — Specifiche agente

Specifiche per l'agente di **Code Generation** usato da Comtra (tab Code → Target). Genera codice production-ready da un nodo Figma selezionato nel formato richiesto dall'utente.

## Contenuto

| File | Uso |
|------|-----|
| **CODE-GEN-RULES.md** | Regole per ogni formato output (React, Storybook, Liquid, CSS, Vue, Svelte, Angular): best practice, mappatura Figma→codice, esempi. Riferimento per system prompt e backend. |
| **README.md** | Questa guida. |

## Formati supportati

| ID | Label | Riferimento regole |
|----|-------|-------------------|
| REACT | React + Tailwind | § 2 |
| STORYBOOK | Storybook (.stories.tsx) | § 3 |
| LIQUID | Shopify Liquid | § 4 |
| CSS | HTML + Clean CSS | § 5 |
| VUE | Vue 3 | § 6 |
| SVELTE | Svelte | § 7 |
| ANGULAR | Angular | § 8 |

## Come si usa

1. **System prompt (backend):** costruire il prompt da `CODE-GEN-RULES.md` includendo le regole trasversali (§ 1) e le regole specifiche per il formato richiesto (§ 2–8).
2. **Input agente:** JSON del **sotto-albero** ancorato al nodo selezionato (`node_id`) + `format` (ID formato). Vedi **§ 1.1 Scope del nodo target** in `CODE-GEN-RULES.md`: il root della generazione è sempre la selezione utente, non un atomo sostitutivo; Storybook sync non restringe lo scope.
3. **Output:** stringa codice o JSON `{ code, format, componentName, warnings }`.
4. **Integrazione:** il plugin mostra il codice nell'area Generate Code e permette Copy.

## Endpoint

`POST /api/agents/code-gen` (da implementare). Input: `file_key`, `node_id`, `format`. Output: codice generato.

## Riferimenti

- `docs/ACTION-PLAN-KIMI-AGENTS.md` — Fase 5 Code Gen
- `docs/CODE-TARGET-TAB-SPEC.md` — UI tab Target
- `docs/GENERATION-ENGINE-RULESET.md` — governance token
