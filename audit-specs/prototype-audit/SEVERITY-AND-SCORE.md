# Prototype Audit — Severity e Prototype Health Score

Modello di severity e punteggio come da COMTRA_Prototype_Audit_Ruleset_v1.pdf. L’audit non è mai bloccante: l’utente può sempre condividere o continuare a lavorare sul prototipo.

---

## Severity (PDF) e punti

| Severity (PDF) | Punti per violazione | Max impatto per regola | Esempi |
|----------------|----------------------|------------------------|--------|
| Critical | 8 | Uncapped | P-01 Dead-end, P-04 Broken destination |
| High | 5 | Uncapped | P-05 No Back, P-07 Loop, P-09 Smart Animate mismatch |
| Medium | 3 | 30 pt per regola | P-10 Duration, P-12 Overlay, P-15 Variables |
| Low | 1 | 10 pt per regola | P-18 Flow naming, P-20 Presentation |

**Score:** `100 - sum(violations × weight)`. Minimo 0.

Per il tipo `AuditIssue` nel plugin le severity Critical sono trasmesse come **HIGH** (il tipo ammette solo HIGH | MED | LOW). Il calcolo dello score usa comunque i pesi Critical=8, High=5, Medium=3, Low=1 in base al **ruleId** (P-01–P-04 → 8 pt, ecc.).

---

## Formula nel plugin

Per coerenza con gli altri audit (DS, A11Y, UX), il plugin può usare una formula unificata sui conteggi:

- **Critical (mappati a HIGH in issue):** 8 pt ciascuno
- **High:** 5 pt ciascuno
- **Medium (MED):** 3 pt ciascuno
- **Low:** 1 pt ciascuno

Con cap: Medium max 30 pt totali da regole Medium, Low max 10 pt totali da regole Low (opzionale per semplicità nella v1 si può usare solo la somma senza cap).

Formula semplice (senza cap per regola):

```
PROTO_HEALTH_SCORE = max(0, 100 - (critical×8 + high×5 + medium×3 + low×1))
```

Dove critical = numero di issue con ruleId P-01, P-02, P-03, P-04; high = issue High (inclusi quelli che nel PDF sono Critical); medium = MED; low = LOW.

---

## Advisory levels (livelli di avviso)

| Range score | advisoryLevel | Indicatore | Comportamento |
|-------------|---------------|------------|----------------|
| 80–100 | healthy | Green checkmark | Report completo, nessun blocco. Condivisione con fiducia. |
| 50–79 | needs_attention | Yellow warning | Issue correggibili; suggerimenti fix per violazione. Prototipo funzionante con gap di qualità. |
| 26–49 | at_risk | Orange alert | Problemi strutturali; rivedere architettura flussi; lista fix priorizzata. |
| 0–25 | critical | Red alert | Problemi fondamentali; prototipo probabilmente rotto in aree chiave; consiglio di riparare i flussi coinvolti. |

L’audit **non blocca** mai: indipendentemente dallo score, COMTRA mostra sempre i risultati e i consigli; la decisione finale spetta all’utente.
