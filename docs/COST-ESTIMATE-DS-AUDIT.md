# Stima costi — DS Audit (Kimi)

Stima **sostenibile** per i primi utenti free (es. 100 utenti × 25 crediti).

---

## Modello e prezzi (riferimento)

- **Modello:** `kimi-k2-0905-preview` (default in backend).
- **Prezzi indicativi** (verifica su [platform.moonshot.ai](https://platform.moonshot.ai)):
  - Input: ~**$0.40 / 1M token**
  - Output: ~**$2.00 / 1M token**

---

## Token per singola chiamata DS Audit

| Componente | Token stimati |
|------------|----------------|
| **System prompt** (ds-audit-system.md) | ~2 500 |
| **User message** (JSON file, depth=2) | 15 000 – 50 000 (dipende da file: piccolo 10k, medio 25k, grande 60k+) |
| **Output** (max 6 issue in JSON) | ~600 – 1 000 |

**Caso “tipico”** (file medio, 6 issue): **~25 000 input** + **~800 output**.

---

## Costo per singola audit (visione 5/6 elementi)

- **Input:** 25 000 / 1 000 000 × 0.40 ≈ **$0.010**
- **Output:** 800 / 1 000 000 × 2.00 ≈ **$0.0016**
- **Totale per chiamata:** **~$0.012** (circa **1,2 centesimi**).

Con **max 6 issue** nel prompt (già impostato) l’output resta contenuto; il costo è dominato dall’input (dimensione del JSON).

---

## Scenario: primi 100 utenti, 25 crediti free ciascuno

- **Crediti totali:** 100 × 25 = **2 500 crediti**.
- **Crediti per scan:** 2–11 (in base a nodi: ≤500 → 2, ≤5k → 5, ≤50k → 8, oltre → 11). Media realistica **~4–5 crediti/scan**.
- **Scan massimi** (se tutti usano tutti i crediti): 2 500 / 4 ≈ **625 scan** (stima conservativa).
- **Costo Kimi** (625 × $0.012): **~$7.50**.

Se solo una parte degli utenti consuma tutti i crediti (es. 30–50%):
- 30%: 750 scan → **~$9**
- 50%: 1 250 scan → **~$15**

**Conclusione:** con **visione 5/6 elementi** (max 6 issue) e modello `kimi-k2-0905-preview`, l’ordine di grandezza è **$10–15 per i primi 100 utenti** che usano il free tier. Sostenibile.

---

## Come tenere i costi sotto controllo

1. **Limite 6 issue** nel prompt (già presente): output piccolo e prevedibile.
2. **`max_completion_tokens: 4096`** nella chiamata API (già impostato).
3. **`depth=2`** per il file Figma: riduce la dimensione del JSON in input.
4. **Modello economico** come default: `kimi-k2-0905-preview`.
5. (Futuro) Per file molto grandi: troncare il JSON a un massimo di token (es. primi 30k token) prima di inviare a Kimi.

---

## Riferimenti

- Variabili e modello: **auth-deploy/SETUP.md** (KIMI_API_KEY, KIMI_MODEL).
- Prompt: **auth-deploy/prompts/ds-audit-system.md** (istruzione “at most 6 issues”).
