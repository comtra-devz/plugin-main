# Auto-fix credits mapping

Mappatura unica per il costo in crediti degli auto-fix sui layer (Audit A11Y e DS). Il codice che applica i costi e consuma i crediti è in `views/Audit/autoFixConfig.ts`.

Per **tutte** le audit tab, categorie, `rule_id` e stato reale degli auto-fix (implemented / stub / roadmap) vedi **`audit-specs/AUTO-FIX-ISSUE-MAP.md`**.

## Action type (API credits)

| Action                 | action_type         | Quando viene usato                          |
|------------------------|---------------------|---------------------------------------------|
| Singolo auto-fix       | `audit_auto_fix`    | Conferma "Apply Fix" su una singola issue    |
| Fix All                | `audit_auto_fix_all`| Conferma "Apply All" su tutte le issue       |

## Costo per categoria (default)

Se l’issue non ha `rule_id` in override, si usa il costo per `categoryId`:

| categoryId   | Descrizione (layer / ambito)     | Crediti |
|-------------|-----------------------------------|---------|
| contrast    | Contrasto testo/sfondo (TEXT)     | 2       |
| touch       | Touch target (interattivi)        | 2       |
| focus       | Stato focus (COMPONENT)           | 2       |
| alt         | Alt text (icone/immagini)         | 2       |
| semantics   | Heading / struttura               | 2       |
| color       | Color-only / OKLCH                | 2       |
| adoption    | DS adoption (instance)            | 2       |
| coverage    | Token coverage (hex, font)        | 2       |
| naming      | Naming (layer name)               | 2       |
| structure   | Struttura / auto-layout           | 2       |
| consistency | Grid / spacing / type              | 2       |
| copy        | Copywriting / localizzazione      | 2       |
| flow        | UX flow                           | 2       |
| feedback    | UX feedback                       | 2       |
| logic       | Prototype logic                   | 2       |
| visual      | Prototype visual                  | 2       |

## Override per rule_id (A11Y)

| rule_id   | Descrizione                         | Crediti |
|-----------|-------------------------------------|---------|
| CTR-001   | Contrasto normale < 4.5:1           | 2       |
| CTR-002   | Contrasto large < 3:1               | 2       |
| CTR-003   | Contrasto AAA normale (advisory)    | 2       |
| CTR-004   | Contrasto AAA large (advisory)      | 2       |
| CTR-009   | Focus: variante focus assente (euristica) | 2  |
| TGT-001   | Touch < 24×24 senza spaziatura       | 2       |
| TGT-003   | Touch < 44×44 (AAA advisory)         | 2       |
| CVD-001   | Stati solo per colore (component set) | 2     |
| CLR-002   | OKLCH / RGB advisory (file)         | 2       |

## Eccezioni

| Condizione              | Crediti | Note                                      |
|-------------------------|--------|-------------------------------------------|
| `issue.id === 'p2'`     | 3      | Fix wireframe / "Create Wireframe"        |

## Flusso

1. L’utente clicca **Auto-Fix Layer** o **AUTO-FIX ALL**.
2. Si apre la modale di conferma con il costo (da `getCreditsForIssue` / `getCreditsForFixAll`).
3. Alla conferma viene chiamato `consumeCredits({ action_type, credits_consumed })`.
4. Se la risposta è errore (es. crediti insufficienti), non si applica il fix e si mostra il messaggio.
5. Se la risposta è ok, si applica il fix (marca come fixed) e si chiude la modale.

Riferimento implementazione: `views/Audit/autoFixConfig.ts`, `views/Audit/AuditView.tsx` (handleFix, handleFixAll).
