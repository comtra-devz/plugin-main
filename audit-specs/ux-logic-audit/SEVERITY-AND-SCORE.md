# UX Logic Audit — Severity e UX Health Score

Framework di severity e calcolo del punteggio per l’UX Logic Audit. Allineato al COMTRA_UX_Logic_Audit_Ruleset_v1.pdf.

---

## Severity

Ogni issue è classificata in uno di tre livelli. La severity determina colore in UI, ordine nel report e impatto sull’UX Health Score.

| Severity | Label | Colore | Criteri | Impatto score |
|----------|--------|--------|---------|----------------|
| **HIGH** | Critical UX Failure | Red #D32F2F | Blocca completamento o comprensione; utente non può procedere, si blocca, perde dati o è ingannato. | −5 pt |
| **MED** | Significant UX Gap | Yellow #F9A825 | Degrada l’esperienza ma non blocca del tutto: label mancanti, pattern inconsistenti, feedback inadeguato. | −2 pt |
| **LOW** | UX Enhancement | Green #66BB6A | Opportunità di miglioramento: tooltip, skeleton, progressive disclosure, microcopy. | −1 pt |

---

## Formula UX Health Score

```
UX_HEALTH_SCORE = max(0, 100 - (HIGH_COUNT × 5) - (MED_COUNT × 2) - (LOW_COUNT × 1))
```

- HIGH_COUNT, MED_COUNT, LOW_COUNT = numero di issue per severity.
- Il risultato è un intero 0–100.

---

## Badge (interpretazione)

| Range score | Badge | Interpretazione |
|-------------|--------|------------------|
| 90–100 | **EXCELLENT** | Il file segue le best practice UX. |
| 70–89 | **GOOD** | Base solida con alcuni gap. |
| 50–69 | **NEEDS WORK** | Molteplici problemi UX che impattano l’esperienza. |
| 0–49 | **CRITICAL** | Fallimenti UX gravi; richiede attenzione immediata. |

---

## Utilizzo in backend e frontend

- **Backend:** dopo aver raccolto le issue dall’agente, calcolare `summary.healthScore` e `summary.badge` con questa formula (o lasciare che l’agente li fornisca e validarli).
- **Frontend:** usare gli stessi colori (HIGH=#D32F2F, MED=#F9A825, LOW=#66BB6A) per badge e indicatori; mostrare il badge (EXCELLENT/GOOD/NEEDS WORK/CRITICAL) accanto allo score nel tab UX.

Le escalation (vedi **ESCALATION-RULES.md**) possono aggiungere flag o etichette speciali (es. CRITICAL FORM, DARK PATTERN ALERT) senza modificare necessariamente il punteggio numerico, a meno che non si decida di applicare penalità aggiuntive in una versione futura.
