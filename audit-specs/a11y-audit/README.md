# Accessibility Audit — Specifiche agente

Questa cartella contiene le specifiche per l’agente di **Accessibility Audit (A11Y)** usato da Comtra. L’agente combina **Kimi** (audit su design / Figma JSON) con la **stack su codice generato**: **axe-core** (engine primario sul DOM), **HTML_CodeSniffer** (verifica statica HTML), **Lighthouse** (punteggio sintetico report). In più: **verifica metodo colore OKLCH**. Tutti open source, zero costi. Vedi **docs/A11Y-AUDIT-PLAN.md** per il piano completo.

## Contenuto

| File | Uso |
|------|-----|
| **A11Y-AUDIT-RULES.md** | Regole complete: cosa controllare (contrasto, touch target, heading/alt, focus, colore), dove cercare nel JSON Figma, severity, fix. Riferimento per l’endpoint e l’engine. |
| **OUTPUT-SCHEMA.md** | Schema JSON di risposta (`issues[]` compatibile con `AuditIssue`). Stessa struttura del DS Audit; `categoryId` specifici A11Y. |
| **TYPES-AND-CATEGORIES.md** | Riferimento unico: severity, categoryId, label (modello DS). Vedi **audit-specs/ds-audit/TYPES-AND-CATEGORIES.md**. |
| **ISSUE-TYPES.md** | Lista completa delle tipologie di issue (per categoria: messaggio, severity, quando, fix). |
| **README.md** | Questa guida. |

## Come si usa

1. **System prompt:** `auth-deploy/prompts/a11y-audit-system.md` — ruolo + regole (da A11Y-AUDIT-RULES.md) + formato output (OUTPUT-SCHEMA.md).
2. **Input:** JSON del file Figma (stesso di DS Audit, da `GET /v1/files/:key`). Opzionale: il backend può pre-calcolare contrast ratio o touch size e passarli come contesto aggiuntivo (Kimi + dati da “API” interne o gratuite).
3. **Output:** `{ "issues": [ ... ] }` con `categoryId` in `contrast`, `touch`, `focus`, `alt`, `semantics`, `color` (vedi OUTPUT-SCHEMA.md).
4. **Integrazione:** endpoint `POST /api/agents/a11y-audit`; plugin tab A11Y mostra le issue come per DS.

## Kimi + stack su codice + OKLCH

- **Kimi (design):** interpreta il JSON Figma, applica euristiche (heading, alt, focus, semantica), suggerisce fix, unifica il report. Calcoli backend: contrast ratio, touch target (nessuna API esterna).
- **Su codice generato (tre layer, open source):** **axe-core** (DOM), **HTML_CodeSniffer** (HTML statico), **Lighthouse** (punteggio A11Y nel report). Vedi **docs/A11Y-AUDIT-PLAN.md** (§ 7).
- **OKLCH:** verifica metodo colore OKLCH (contrasto e preferenza per token/CSS moderno). Vedi **docs/A11Y-AUDIT-PLAN.md** (§ 8).

## Categorie (categoryId)

Vedi **TYPES-AND-CATEGORIES.md** e **ISSUE-TYPES.md** per la lista completa e le tipologie di issue.

- `contrast` — Rapporto di contrasto testo/sfondo (WCAG AA/AAA).
- `touch` — Dimensione area cliccabile (es. ≥ 44×44 pt).
- `focus` — Indicazione stati focus (design).
- `alt` — Testo alternativo / descrizione per immagini/icone.
- `semantics` — Struttura heading, landmark, ordine lettura.
- `color` — Uso del solo colore per informazione; OKLCH / token.

## Riferimenti

- **Piano A11Y (Kimi + API gratuite):** docs/A11Y-AUDIT-PLAN.md
- **Piano generale agenti:** docs/ACTION-PLAN-KIMI-AGENTS.md (Fase 2)
- **Fattibilità (axe-core, WCAG su design):** docs/FEASIBILITY-KIMI-SWARM.md
- **Tipo frontend:** `AuditIssue` in `types.ts` (stesso del DS Audit).
