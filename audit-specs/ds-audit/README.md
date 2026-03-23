# Design System Audit — Specifiche agente

Questa cartella contiene le specifiche per l’agente di **Design System Audit** usato da Comtra (prompt Kimi, integrazione backend e plugin).

## Contenuto

| File | Uso |
|------|-----|
| **DS-AUDIT-RULES.md** | Regole complete dell’audit: cosa controllare, dove cercare nel JSON del file, severity, esempio di fix. Riferimento per il system prompt e per chi implementa l’endpoint. |
| **OUTPUT-SCHEMA.md** | Schema JSON che l’agente deve restituire (`issues[]` con campi `AuditIssue`). Esempi e regole di validazione. |
| **SOURCES.md** | Fonti autorevoli: link, sintesi e come sono usate nelle regole. |
| **RECURRING-PROBLEMS.md** | Problematiche ricorrenti da 100 thread (forum, community, repository, governance, multi‑prodotto): cluster, severity 1–5, mappatura alle regole di audit. |
| **README.md** | Questa guida. |

## Come si usa

1. **System prompt (backend):** costruire il prompt di sistema per Kimi includendo (in sintesi o per intero) le regole da `DS-AUDIT-RULES.md` e le istruzioni di output da `OUTPUT-SCHEMA.md`.
2. **Input agente:** il backend invia il JSON del file (da `GET /v1/files/:key`) come messaggio utente (o parte del contesto).
3. **Output:** l’agente risponde con un JSON `{ "issues": [ ... ] }` conforme a `OUTPUT-SCHEMA.md`.
4. **Integrazione:** il backend mappa le `issues` al tipo `AuditIssue` del frontend e le restituisce al plugin per il tab Design System.

## Riferimento: library e scale

L’audit è fatto **rispetto alla library che l’utente sta controllando** (library nel file o library esterna/linkata). Scale, token e valori citati nelle regole (es. 4, 8, 16, type scale) sono **solo esempi**; la fonte di verità sono le definizioni presenti nel file o nella library quando rilevabili. Vedi la sezione “Riferimento: library su cui si fa l’audit” in **DS-AUDIT-RULES.md**.

## Categorie (categoryId)

- `adoption` — Uso componenti, istanze staccate, orfani, duplicati.
- `coverage` — Token/variabili: colori, tipografia, spacing, radius, effetti.
- `naming` — Convenzioni nomi layer, componenti, pagine.
- `structure` — Ghost node, nesting, auto-layout, constraints.
- `consistency` — Griglia, spacing scale, type scale, line height.
- `copy` — Placeholder, terminologia, overflow/localizzazione.
- `optimization` — Raccomandazioni: merge famiglie, slot, token, varianti (sistemi più snelli).

## Riferimenti

- **Fonti autorevoli (design system):** vedi **SOURCES.md**.
- **Problematiche ricorrenti (community):** vedi **RECURRING-PROBLEMS.md** per cluster, severity e mappatura alle regole.
- REST API del servizio (documentazione file e nodi): [File node types](https://developers.figma.com/docs/rest-api/file-node-types), [File endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/).
- Tipo frontend: `AuditIssue` in `types.ts`.
- Piano d’azione: `docs/ACTION-PLAN-KIMI-AGENTS.md`.
