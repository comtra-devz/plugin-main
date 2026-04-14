# Punto stabile / ripristino (baseline prestazioni)

Questo file indica **un commit e un tag Git** da usare come riferimento quando vogliamo ricordare una versione in cui le funzioni principali erano **affidabili e con prestazioni accettabili** (audit, crediti, flussi OAuth).

## Tag corrente

| Campo | Valore |
|--------|--------|
| **Tag** | `restore/2026-04-14-hybrid-kickoff` |
| **Commit** | `git rev-parse restore/2026-04-14-hybrid-kickoff` |
| **Data nota** | 14 aprile 2026 |

Aggiorna questa tabella se in futuro promuovi un nuovo tag stabile (vedi sotto).

## Cosa include questo restore point (riepilogo tecnico)

- **Direzione architetturale ibrida confermata**: plugin leggero come adapter canvas; engine pesante su backend/webapp.
- **Matrice operativa endpoint v1→v2** pubblicata in `docs/HYBRID-ARCHITECTURE-ENDPOINT-MATRIX.md`.
- **Linea base performance recente preservata**: fetch multi-pagina in parallelo e crediti ottimizzati (`lite`, query parallele), da mantenere durante il refactor.

## Storico tag di riferimento

| Tag | Nota |
|-----|------|
| `stable/2026-04-07` | Baseline fix performance iniziali (parallelismo pagine + ottimizzazioni crediti). |
| `restore/2026-04-14-hybrid-kickoff` | Nuovo punto di ripartenza per il percorso hybrid architecture. |

## Come tornare a questa versione (solo lettura / confronto)

```bash
git fetch --tags
git checkout restore/2026-04-14-hybrid-kickoff
```

Per un branch di lavoro partendo da qui:

```bash
git checkout -b work/from-hybrid-kickoff restore/2026-04-14-hybrid-kickoff
```

## Come promuovere un nuovo punto stabile

1. Assicurati che `main` (o il branch di release) sia nel stato desiderato e testato.
2. Crea un tag annotato (sostituisci data e messaggio):

   ```bash
   git tag -a restore/YYYY-MM-DD-short-name -m "Restore point: breve descrizione"
   git push origin restore/YYYY-MM-DD-short-name
   ```

3. Aggiorna la tabella e il paragrafo “Cosa include” in questo file.

## Note

- Il tag **non sostituisce** le release semver del prodotto; serve come **checkpoint interno** e per `git bisect` / rollback mirati.
- Se il repository è su Git remoto, esegui `git push origin restore/2026-04-14-hybrid-kickoff` dopo aver creato il tag.
