# Punto stabile / ripristino (baseline prestazioni)

Questo file indica **un commit e un tag Git** da usare come riferimento quando vogliamo ricordare una versione in cui le funzioni principali erano **affidabili e con prestazioni accettabili** (audit, crediti, flussi OAuth).

## Tag corrente

| Campo | Valore |
|--------|--------|
| **Tag** | `stable/2026-04-07` |
| **Commit** | `git rev-parse stable/2026-04-07` — include questo file; le fix prestazioni sono nell’antenato `15c1d0c` (*Slow performance fix*) |
| **Data nota** | 7 aprile 2026 |

Aggiorna questa tabella se in futuro promuovi un nuovo tag stabile (vedi sotto).

## Cosa include questa baseline (riepilogo tecnico)

- **Audit multi-pagina (DS / A11y / UX)**: fetch Figma per più pagine in **parallelo** (concorrenza limitata), invece di una richiesta sequenziale per pagina.
- **`GET /api/credits`**: query principali in **parallelo** (`users`, `tags`, `gift`; in modalità full anche stats + transazioni recenti), per ridurre latenza e timeout lato plugin.
- **Crediti “lite”**: `?lite=1` per il saldo senza aggregazioni pesanti; timeout client distinti lite/full.
- **Contesto file**: per scope `all`, il plugin invia `page_ids` e il backend non serializza tutto in un’unica catena sequenziale di GET Figma.

## Come tornare a questa versione (solo lettura / confronto)

```bash
git fetch --tags
git checkout stable/2026-04-07
```

Per un branch di lavoro partendo da qui:

```bash
git checkout -b fix/from-stable-2026-04-07 stable/2026-04-07
```

## Come promuovere un nuovo punto stabile

1. Assicurati che `main` (o il branch di release) sia nel stato desiderato e testato.
2. Crea un tag annotato (sostituisci data e messaggio):

   ```bash
   git tag -a stable/YYYY-MM-DD -m "Baseline: breve descrizione di cosa funziona bene"
   git push origin stable/YYYY-MM-DD
   ```

3. Aggiorna la tabella e il paragrafo “Cosa include” in questo file.

## Note

- Il tag **non sostituisce** le release semver del prodotto; serve come **checkpoint interno** e per `git bisect` / rollback mirati.
- Se il repository è su Git remoto, esegui `git push origin stable/2026-04-07` dopo aver creato il tag.
