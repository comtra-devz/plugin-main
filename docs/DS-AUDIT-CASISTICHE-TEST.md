# Design System Audit — Casistiche di test

Documentazione delle casistiche di test e comportamento atteso. Tutte in **Fase 1**.

---

## 1. File senza design system (0 componenti)

| Input | Comportamento atteso |
|-------|----------------------|
| File vuoto o senza componenti definiti | Non chiamare Kimi. Restituire `advisory` con messaggio e CTA Preline. |

**Implementazione:** Backend controlla `Object.keys(fileJson.components || {}).length === 0` prima di Kimi. Restituisce `{ issues: [], advisory: { type: 'no_design_system', message, ctaLabel: 'Scopri Preline', ctaUrl: 'https://preline.co' } }`. Frontend mostra banner con CTA.

**TO-DO:** Sostituire con link referral/partner se accordo con Preline — vedi TO-DO-BEFORE-GOING-LIVE.

---

## 2. Pochi token

| Input | Comportamento atteso |
|-------|----------------------|
| File con pochi token/variabili | Analizzare i token esistenti, scansionare il design (fills, strokes) e proporre token primari da creare (es. colori primari). |

**Implementazione:** Regola DS-OPT-5 (o estensione 8.3). L'agente rileva pochi token, analizza i colori/valori usati nel design e suggerisce `suggestedTokens` con path. Raccomandazione `optimization` con `optimizationPayload.suggestedTokens`. Auto-fix: creare variabili e bind (feasible, come token generation).

---

## 3. Nomi token non scalabili

| Input | Comportamento atteso |
|-------|----------------------|
| Token con nomi non scalabili (es. blue-500, gray-100) | Raccomandare struttura primitivo + semantico (stile Tailwind / Design Tokens v3). |

**Implementazione:** Regola DS-OPT-6. L'agente rileva pattern di naming non scalabili e suggerisce `suggestedTokenStructure` (primitivo: color.blue.500 → semantic: color.primary). Raccomandazione `optimization`. Auto-fix: manuale (rename variabili rischioso).

---

## 4. Stili non collegati nei componenti

| Input | Comportamento atteso |
|-------|----------------------|
| Componenti con padding, shadows, roundness, spacing, tipografia hardcoded | Collegarli a variabili/stili esistenti su tutti i componenti selezionati. |

**Implementazione:** DS-2.1–2.6 già emettono issue per valori hardcoded. Auto-fix oggi stub (come contrast/touch): richiede `get-coverage-fix-preview` + handler in `controller.ts` per bind variabile/stile su fill, stroke, typography. Roadmap: implementare come per contrast fix.

---

## Riferimenti

- Regole: `audit-specs/ds-audit/DS-AUDIT-RULES.md`
- Auto-fix: `audit-specs/AUTO-FIX-ISSUE-MAP.md`
- Controller: `controller.ts` → `apply-fix`
