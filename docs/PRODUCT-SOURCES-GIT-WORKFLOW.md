# Fase 7 — Da report Notion al repo (Git / docs)

Workflow **manuale** (default Comtra): nessuna PR automatica dalla dashboard; tracciamento stato Git/PR in Postgres.

Documentazione pipeline completa: **`admin-dashboard/docs/NOTION-PRODUCT-SOURCES.md`** (nello stesso monorepo).

---

## 1. Dove sta il Markdown

| Origine | Dove lo trovi |
|---------|----------------|
| **Cron** | Dashboard → *Migliorie prodotto* → **Storico cron & documenti** → **Leggi** / **Scarica .md** (oppure API admin `GET /api/product-sources-runs?id=…`). |
| **Scansione manuale** | Stessa scheda → dopo l’estrazione, **Copia report Markdown** o textarea sotto. |

Il testo completo resta sempre in **`product_sources_cron_runs.report_markdown`** per le run cron.

---

## 2. Dove salvarlo nel repo plugin

Cartella consigliata (versionabile, fuori dalle rules operative):

```text
docs/product-sources/archive/
```

**Nome file (convenzione):**

- Run cron: `YYYY-MM-DD-cron-{id}.md` (l’`id` è quello della riga nello storico / DB; la data è **UTC** del `ran_at`, come lo **Scarica** in dashboard).
- Solo manuale senza id: `YYYY-MM-DD-manual.md` o `YYYY-MM-DD-manual-{breve-nota}.md`.

Esempio: `docs/product-sources/archive/2026-03-16-cron-42.md`

La cartella `archive/` può restare vuota finché non committi il primo report; vedi `docs/product-sources/README.md`.

---

## 3. Branch e PR

1. Crea un branch dedicato, es. `docs/product-sources-2026-03-16` o `chore/product-sources-run-42`.
2. Aggiungi **solo** il file (o pochi file) del report; PR **piccola**, review umana.
3. Incrocia con le sezioni reali del ruleset (`audit-specs/`, `.cursor/rules/`, `docs/GENERATION-ENGINE-RULESET.md`, …) prima di modificare regole di prodotto.
4. Dopo l’apertura della PR su GitHub, registra l’URL nella dashboard (vedi §4).

**Non** committare segreti (token Notion, Gemini, webhook Discord, ecc.).

---

## 4. Tracciamento in admin dashboard

Scheda **Storico cron & documenti**:

- **Segna in lavorazione** (`request_pr_stub`) — opzionale, stato `pending`.
- **Imposta URL PR** — incolla `https://github.com/org/repo/pull/…` → stato `pr_opened`.
- **Reset Git** — ripulisce stato/URL se la PR è stata chiusa o annullata.

Le colonne sono descritte in **`admin-dashboard/migrations/005_product_sources_git_discord.sql`**.

---

## 5. Cosa non facciamo (e perché)

- **Nessun** commit o PR automatici dal server Vercel verso questo repo (policy di sicurezza e review).
- Un’automazione futura (bot, GitHub App) andrebbe progettata a parte: branch protetti, secret dedicati, scope minimo.

---

## 6. Checklist rapida

- [ ] Markdown copiato o scaricato (cron id noto se applicabile).
- [ ] File salvato sotto `docs/product-sources/archive/` con nome datato.
- [ ] Branch + commit + PR su GitHub.
- [ ] URL PR salvato nello storico dashboard.
- [ ] (Opzionale) Discord già notificato dalla run cron — niente duplicazioni sensibili in PR.

---

## Riferimenti

- Roadmap fasi: **`admin-dashboard/docs/PRODUCT-SOURCES-ROADMAP.md`**
- Notion, cron, Apify, LLM, Fase 6: **`admin-dashboard/docs/NOTION-PRODUCT-SOURCES.md`**
