# Pattern di schermata e flussi

## Scopo

Colmare il divario tra **“come pensa il prodotto”** (archetype, playbook, Design Intelligence) e **“cosa deve produrre Generate”** (action plan valido). Qui non elenchiamo ogni archetype: indichiamo **dove** vive la logica aggiornata.

## Dove guardare nel repo

| Dominio | Documenti / entry point |
|---------|-------------------------|
| Pack v2 archetype, wizard, tone | `docs/DESIGN-INTELLIGENCE-PACK-v2.md`, playbook Generate |
| Gates e policy UX | `docs/GENERATE-GATES-POLICY-MATRIX.md` |
| Conversazione / thread Generate | `docs/GENERATE-CONVERSATIONAL-UX-IMPLEMENTATION-PLAN.md` |
| Acceptance / smoke prompt | `docs/GENERATE-ACCEPTANCE-PROMPTS.md` |

## Convenzione per chi aggiunge un nuovo pattern ricorrente

1. Documentare il comportamento atteso nel playbook o nella matrice gates **se** influisce su crediti, qualità o sicurezza.
2. Se il pattern richiede **nuovi controlli nel validator**, va nel codice — non solo qui.
3. Aggiornare una riga in questa tabella se introduce una **nuova famiglia** di schermate (es. “dashboard analytics”) così il team sa dove cercare.

## Tabella sintetica (esempio — aggiornare se necessario)

| Famiglia | Note |
|----------|------|
| Auth (login, register, …) | Guardrail semantici nel motore per non mischiare wizard/step dove non richiesto |
| Liste / feed | Preferenza composizione DS + spacing da index |
| Form complessi | Form layout da playbook + variabili DS |

Ultimo aggiornamento: struttura iniziale; arricchire solo quando un pattern si ripete spesso in supporto o QA.
