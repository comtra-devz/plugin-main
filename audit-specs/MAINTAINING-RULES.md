# Manutenzione delle regole di audit — Guida per chi modifica o prende in carico

Questa guida spiega **come modificare** i documenti di regole in `audit-specs/` (in particolare `ds-audit/`) e cosa serve per **passare il lavoro ad altre persone** senza perdere coerenza.  
Per **usare** Kimi e testare i prompt vedi **docs/KIMI-FOR-DUMMIES.md**. Per il piano delle fasi vedi **docs/ACTION-PLAN-KIMI-AGENTS.md**.

---

## 1. Struttura della cartella audit-specs

```
audit-specs/
├── README.md                    Panoramica e uso delle specifiche
├── MAINTAINING-RULES.md         Questa guida (manutenzione e handoff)
└── ds-audit/                   Agente Design System Audit
    ├── README.md                Cosa c’è nella cartella e come si usa
    ├── DS-AUDIT-RULES.md        Regole complete (cosa controllare, dove nel JSON, severity, fix)
    ├── OUTPUT-SCHEMA.md         Formato JSON di risposta (issues[], campi obbligatori)
    ├── SOURCES.md               Fonti autorevoli (link, sintesi, mappatura alle regole)
    └── RECURRING-PROBLEMS.md    Problematiche ricorrenti da community, severity 1–5, mappatura
```

Per **altri agenti** (A11Y, UX, Prototype, ecc.) si creeranno cartelle analoghe (es. `a11y-audit/`, `ux-audit/`) con gli stessi tipi di file dove ha senso.

---

## 2. Ruolo di ogni file (chi lo modifica e quando)

| File | Contenuto | Chi lo modifica | Quando |
|------|-----------|-----------------|--------|
| **DS-AUDIT-RULES.md** | Regole numerate (1.1, 1.2, …), dove cercare nel JSON, severity, esempio fix, categoryId | Design / design ops / chi definisce gli standard | Aggiungere regole, cambiare severity, aggiornare “dove nel JSON” se cambia l’API |
| **OUTPUT-SCHEMA.md** | Schema JSON di output (campi issue, obbligatori/opzionali, esempi) | Chi definisce il contratto agente–backend (spesso dev) | Se il frontend si aspetta nuovi campi o valori (es. nuova categoryId) |
| **SOURCES.md** | Link a fonti esterne, sintesi, come sono usate nelle regole | Chi cura le regole o la documentazione | Aggiungere nuove fonti, aggiornare la mappatura regola → fonte |
| **RECURRING-PROBLEMS.md** | Cluster di problemi da community, severity 1–5, mappatura problema → regola | Chi fa ricerca su forum/community o analisi utenti | Aggiungere cluster o problemi, aggiornare la tabella di mappatura |
| **README.md** (in ds-audit) | Indice dei file, categorie (categoryId), riferimenti | Chi mantiene la cartella | Quando si aggiungono file o categorie |

**Regola pratica:** ogni modifica alle **regole** (DS-AUDIT-RULES) va riflessa nel **system prompt** usato da Kimi (es. `auth-deploy/prompts/ds-audit-system.md`) e, se cambiano i campi in uscita, in **OUTPUT-SCHEMA** e nel tipo **AuditIssue** in `types.ts`.

---

## 3. Come aggiungere una nuova regola

1. **Apri** `audit-specs/ds-audit/DS-AUDIT-RULES.md`.
2. Scegli la **sezione** giusta (1. Adoption, 2. Coverage, 3. Naming, 4. Structure, 5. Consistency, 6. Copy, 7. Best practice). Se la regola non rientra, valuta una nuova sezione o mettila in 7.
3. **Aggiungi** un blocco con il formato esistente:
   - **Titolo:** `### X.Y Nome breve (es. "Colore hardcoded")`
   - **Descrizione:** cosa stai controllando e perché conta.
   - **Dove nel JSON del file:** proprietà e nodi da guardare (es. `fills`, `boundVariables`, `type: "INSTANCE"`).
   - **Severity:** HIGH / MED / LOW (e eventuale nota, es. “HIGH per UI core”).
   - **Esempio fix:** testo che l’agente può restituire nel campo `fix`.
   - Opzionale: **tokenPath suggerito** se la regola riguarda token.
4. **Aggiorna** la tabella “Mappatura regola → categoryId” in fondo al file: aggiungi la nuova riga (es. `X.Y | coverage`).
5. Se hai introdotto una **nuova categoryId**, aggiorna:
   - `OUTPUT-SCHEMA.md` (tabella dei campi: valori ammessi per `categoryId`);
   - `audit-specs/ds-audit/README.md` (elenco categorie);
   - `types.ts` se lì è definito un tipo o un enum per le categorie.
6. **Aggiorna** il system prompt (`auth-deploy/prompts/ds-audit-system.md`): includi la nuova regola (o la sua sintesi) e, se serve, il nuovo categoryId nell’elenco ammesso.

---

## 4. Come modificare una regola esistente

- **Solo testo (descrizione, esempio fix):** modifica direttamente in `DS-AUDIT-RULES.md`. Se il prompt riassume le regole, controlla che la sintesi resti allineata.
- **Severity:** cambia in `DS-AUDIT-RULES.md`. Se nel prompt c’è un riepilogo severity, aggiornalo.
- **“Dove nel JSON”:** aggiorna la sezione “Dove nel JSON del file” della regola; utile se l’API del file cambia (es. nuovi campi, struttura diversa).
- **Rinumerare regole:** se inserisci 2.8 tra 2.7 e 2.9, rinumera le successive e aggiorna la tabella “Mappatura regola → categoryId” e ogni riferimento in SOURCES.md / RECURRING-PROBLEMS.md a quel numero.

---

## 5. Come aggiungere o cambiare una categoria (categoryId)

Le categorie attuali sono: `adoption`, `coverage`, `naming`, `structure`, `consistency`, `copy`.

- **Aggiungere una categoria** (es. `accessibility`):
  1. In `DS-AUDIT-RULES.md`: aggiungi la categoria nella tabella iniziale “Categorie di issue” e assegna le regole che la usano nella tabella “Mappatura regola → categoryId”.
  2. In `OUTPUT-SCHEMA.md`: nella descrizione del campo `categoryId` aggiungi il nuovo valore (es. “Una di: adoption, coverage, …, accessibility”).
  3. In `audit-specs/ds-audit/README.md`: aggiungi la riga nell’elenco “Categorie (categoryId)”.
  4. Nel frontend: in `types.ts` (o dove sono definiti i filtri per tab) aggiungi il nuovo categoryId se le issue vengono filtrate per categoria.
  5. Nel system prompt: aggiorna l’elenco dei categoryId ammessi.
- **Rinominare o rimuovere una categoria:** stesse posizioni; verifica che nessuna regola resti orfana (senza categoryId) e che il plugin non si aspetti più il vecchio valore.

---

## 6. Come aggiornare OUTPUT-SCHEMA

- **Nuovo campo opzionale** (es. `suggestion`): aggiungi la riga nella tabella “Oggetto issue”, indica “No” in obbligatorio, descrivi. Il backend può ignorarlo finché non lo usa; il frontend può mostrarlo se presente.
- **Nuovo campo obbligatorio:** aggiungi alla tabella, “Sì” in obbligatorio. Poi: (1) system prompt: “Ogni issue deve includere anche il campo X”; (2) backend: validazione/mappatura; (3) `types.ts`: aggiungi il campo a `AuditIssue` (o tipo equivalente).
- **Nuovi valori per categoryId o severity:** aggiorna la descrizione del campo e gli esempi; aggiorna il prompt con l’elenco esatto dei valori ammessi.

---

## 7. Come aggiornare SOURCES.md e RECURRING-PROBLEMS.md

- **SOURCES.md:** per ogni nuova fonte autorevole aggiungi una sezione (numero, titolo generico, link, sintesi, “Criteri usati nelle regole” con riferimenti tipo “→ 2.1, 3.1”). Non usare nomi di prodotti o marchi nel testo visibile; per i link puoi usare etichette tipo “Risorsa N — Titolo”.
- **RECURRING-PROBLEMS.md:** per un nuovo cluster o problema ricorrente aggiungi il blocco nella sezione appropriata e una riga nella “Mappatura: problema ricorrente → regole di audit” (quali regole lo coprono o “Non auditabile dal file”).

---

## 8. Checklist handoff (passare il lavoro ad altri)

Quando qualcuno prende in carico la manutenzione delle regole o l’onboarding di un nuovo agente, assicurati che abbia:

- [ ] Accesso alla repo e alle cartelle `audit-specs/` e `auth-deploy/prompts/`.
- [ ] Letto **audit-specs/README.md** e **audit-specs/ds-audit/README.md** (cosa c’è e a cosa serve).
- [ ] Letto **docs/KIMI-FOR-DUMMIES.md** (come si testa un agente su kimi.com senza toccare il backend).
- [ ] Letto **docs/ACTION-PLAN-KIMI-AGENTS.md** (fasi, endpoint, integrazione plugin).
- [ ] Capito il flusso: **regole (DS-AUDIT-RULES) → system prompt (ds-audit-system.md) → test su kimi.com → endpoint → plugin**.
- [ ] Riferimento al tipo **AuditIssue** in `types.ts` (campi che il frontend si aspetta).
- [ ] Convenzioni: severity HIGH/MED/LOW; categoryId solo dall’elenco; “Dove nel JSON del file” sempre compilato per ogni regola; niente nomi di prodotti o fonti nel testo delle regole (vedi convenzioni del progetto).
- [ ] Dove trovare la documentazione dell’API del file (link in ds-audit/README o OUTPUT-SCHEMA) per sapere quali campi esistono nel JSON.

Opzionale: una **conversazione di esempio** (test su kimi.com con system prompt + JSON + risposta) salvata in `docs/` o in uno snippet, per mostrare il formato atteso.

---

## 9. Riferimenti incrociati

| Se serve… | Vedi |
|-----------|------|
| Aggiungere / modificare una regola DS | Questa guida § 3, 4 |
| Cambiare formato output (campi issue) | OUTPUT-SCHEMA.md + questa guida § 6; poi types.ts e backend |
| Aggiungere una categoria | Questa guida § 5 |
| Testare Kimi senza backend | docs/KIMI-FOR-DUMMIES.md |
| Implementare endpoint e plugin | docs/ACTION-PLAN-KIMI-AGENTS.md |
| Fonti e problematiche ricorrenti | audit-specs/ds-audit/SOURCES.md, RECURRING-PROBLEMS.md |
| Tipo AuditIssue nel frontend | types.ts |
