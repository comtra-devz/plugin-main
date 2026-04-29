# DS per Generate — guida team

Piccola libreria di testi **per persone** che aggiornano prompt, validator e import DS. Non duplica il motore (index, schema, codice): rimanda a `docs/ds-authority.md` per la gerarchia di verità.

## File in questa cartella

| File | Contenuto |
|------|-----------|
| [FOUNDATIONS.md](./FOUNDATIONS.md) | Cosa significa “token / componente / variabile” nel flusso Figma ↔ Generate |
| [PATTERNS.md](./PATTERNS.md) | Pattern ricorrenti di schermata e dove trovare la logica prodotto (playbook, archetype) |
| [HUMAN-RULES.md](./HUMAN-RULES.md) | Scelte che il validator non può codificare completamente (priorità semantiche di team) |

## Documenti già esistenti da tenere allineati

- Piano Generate tab / UX: `docs/GENERATE-TAB-SPEC.md`, `docs/GENERATE-GATES-POLICY-MATRIX.md`
- Import DS tecnico: `docs/GENERATE-DS-IMPORT-SPEC.md`, `docs/GENERATE-DS-IMPORT-CONTESTO-E-RAGIONAMENTO.md`
- Motore / regole machine-readable: `docs/GENERATION-ENGINE-RULESET.md`, `docs/COMTRA_Generation_Engine_Ruleset_v1.txt`
- Performance index: `docs/DS-CONTEXT-INDEX-PERFORMANCE.md`

## Checklist quando cambia il DS importato o l’hash index

Da fare in PR che tocca DS/context:

1. **Verificare** che gli esempi in `auth-deploy/prompts/generate-system.md` (e correlati) non citino chiavi/token rimossi.
2. **Smoke test** Generate su file di test con DS noto (scope realistico).
3. **Aggiornare** questa cartella solo se cambiano convenzioni “umane” (es. nuova policy su login vs wizard).
4. **Segnalare** in changelog interno / Discord se è breaking per utenti con file vecchi.

Non serve rieseguire l’intera suite ogni volta: bastano i punti sopra quando la modifica è strutturale.

## Per Cursor / AI in repo

All’inizio di lavori su Generate: leggere `docs/ds-authority.md`, poi il file in questa cartella più vicino al task (FOUNDATIONS vs PATTERNS vs HUMAN-RULES).
