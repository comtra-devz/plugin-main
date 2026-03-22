# Archivio report “fonti prodotto” (Notion)

Qui puoi versionare **copie** dei report Markdown generati dalla pipeline (cron o scansione manuale), per storia e diff nel repo.

- **Contenuto live delle run cron:** database Postgres (`product_sources_cron_runs.report_markdown`), non questa cartella.
- **Convenzione file:** vedi **`docs/PRODUCT-SOURCES-GIT-WORKFLOW.md`** (Fase 7).
- **Sottocartella:** `archive/` — snapshot opzionali `YYYY-MM-DD-cron-{id}.md`.

La cartella `archive` è tracciata con `.gitkeep` così il percorso esiste anche prima del primo commit di report.
