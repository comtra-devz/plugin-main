# Roadmap — intelligence da Notion → migliorie prodotto

Descrizione **semplice** delle fasi. L’ordine conta: ogni fase si appoggia alle precedenti.

---

## Fase 0 — Già in piedi (baseline)

- Leggere la pagina / database **Notion** da env.
- Estrarre i **link**, filtrare rumore (es. blocchi da escludere).
- **Dedup** degli URL tra una run e l’altra (così non rifai tutto ogni volta).
- **LinkedIn**: arricchimento con **Apify** (testo post + link nel post).
- **Cron** su Vercel + **gate giorni** configurabile (`PRODUCT_SOURCES_CRON_GATE_DAYS`).
- Salvataggio **Markdown** in Postgres + **Discord** + **storico** in dashboard.

---

## Fase 1 — Fetch “web” generico (non LinkedIn)

- Per gli URL **nuovi** che sono **siti normali** (http/https), fare un **download leggero** della pagina e ricavare **testo** (senza dipendenze pesanti).
- **Limiti** per run: timeout, dimensione massima, numero massimo di URL (come per LinkedIn).
- **Opt-in** con variabile d’ambiente (`PRODUCT_SOURCES_FETCH_WEB=1` sul **cron**).
- Risultato nel **report MD** in una sezione dedicata.

*Obiettivo:* avere **contenuto** anche per blog, docs competitor, articoli, ecc.

### Fase 1 bis — Stessa cosa dalla dashboard (manuale)

- Checkbox **«Fetch web + strategia tipo URL»** in *Migliorie prodotto → Scansione manuale*, oppure body API `fetchWeb: true`.
- Opzionale: `PRODUCT_SOURCES_MANUAL_FETCH_WEB_DEFAULT=1` su Vercel per avere il fetch web attivo anche senza checkbox (attenzione ai tempi di richiesta).

---

## Fase 2 — Tipi di contenuto e strategia per dominio (**implementata — baseline**)

- **Classificazione** in `lib/product-source-fetch-strategy.mjs`: `html`, `github` (preferenza URL **raw** + fallback HTML repo), `youtube` e `social_x` (**stub** testuale senza API video/thread), `pdf_path` + rilevamento **PDF** binario (messaggio “decoder non attivo”).
- **Allowlist / blocklist** hostname: `PRODUCT_SOURCES_DOMAIN_ALLOWLIST`, `PRODUCT_SOURCES_DOMAIN_BLOCKLIST` (virgole o newline). Gli stub YouTube/X **non** sono bloccati dall’allowlist (non fanno fetch di rete oltre al controllo policy); restano soggetti alla **blocklist**.
- Estensioni future: altri actor Apify, parser PDF, transcript YouTube, ecc.

*Obiettivo:* meno errori e meno sprechi; comportamento **esplicito** per tipo di link.

---

## Fase 3 — Coda e spezzamento lavoro (scale)

- Se gli URL sono **molti**, una sola funzione serverless non basta.
- **Coda** in database (job per URL o per batch) + più invocazioni cron o worker.
- Ripresa da interruzioni e **progress** visibile in dashboard.

*Obiettivo:* niente timeout, pipeline **affidabile** con decine/centinaia di link.

---

## Fase 4 — Snapshot documentazione plugin

- Raccogliere in automatico (o da path fissi) **rules**, **docs**, README rilevanti del **plugin**.
- Versione “testo” da passare al modello come **contesto ufficiale** (“cosa fa oggi il prodotto”).

*Obiettivo:* il confronto non è nel vuoto, è **contro la doc reale**.

---

## Fase 5 — Sintesi intelligente (LLM)

- Input: **fonti nuove** (testo fetch + LinkedIn Apify) + **snapshot doc**.
- Output: un **unico documento MD** strutturato: idee di miglioria **tecniche e strategiche**, con **riferimento alle fonti**, linguaggio semplice.
- **Guardrail** in prompt: niente proposte “peggiorative”, niente breaking non richiesti, incertezza esplicita.

*Obiettivo:* il report diventa un **backlog da revisionare**, non solo link e copia-incolla.

---

## Fase 6 — “Niente di nuovo, niente lavoro pesante”

- Se **nessun URL nuovo** (e opzionalmente **nessun cambiamento** rilevato in Notion), **saltare** fetch costosi e **saltare** LLM.
- Eventuale riga in storico: “controllo effettuato, nulla di nuovo”.

*Obiettivo:* rispetto del ciclo (es. ogni 4 giorni) **senza** costi inutili.

---

## Fase 7 — Integrazione Git / docs (come vuoi tu)

- **Manuale (default):** tu copi il MD in `docs/` e apri PR da Cursor.
- **Opzionale dopo:** branch + commit + PR automatica (policy di review e segreti da definire).

---

## Dove siamo adesso

- **Fase 0** ok.
- **Fase 1** — fetch web opt-in nel cron + sezione report.
- **Fase 1 bis** — fetch web da API manuale + checkbox UI.
- **Fase 2** — strategia tipo URL + allow/block list + GitHub raw + stub social/video + PDF rilevato (senza parser binario).
