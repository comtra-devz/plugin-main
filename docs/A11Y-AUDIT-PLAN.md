# Piano agente Accessibility Audit — Kimi + stack open source

Piano per l’agente **Accessibility (A11Y)** Comtra: **Kimi** (audit su design / Figma JSON) + **tre layer su codice generato** (axe-core, HTML_CodeSniffer, Lighthouse) + **verifica metodo colore OKLCH**. Tutti i componenti sono open source, zero costi di licenza.

---

## 0. Stack A11Y Comtra (sintesi)

| Livello | Strumento | Cosa fa | Dove gira |
|---------|-----------|---------|-----------|
| **Design (Figma JSON)** | Kimi + calcoli backend | Euristiche (heading, alt, focus), contrast/touch da JSON, report issue | Backend: JSON file → Kimi; contrast/touch opzionale in backend |
| **Codice generato / HTML** | **axe-core** | Engine primario: analizza il **DOM** del codice generato (semantica, ARIA, contrasto su stili applicati) | Backend o job post–Code Agent: HTML renderizzato → axe.run() |
| **Codice generato / HTML** | **HTML_CodeSniffer** | Verifica **statica** sull’HTML (markup, attributi, struttura) | Backend: HTML/CSS sorgente → CodeSniffer |
| **Report finale** | **Lighthouse** | Punteggio sintetico (Performance, Accessibility, Best Practices) nel report finale | Backend: URL o HTML → Lighthouse (CLI/API) → score A11Y |
| **Colore** | **Sistema OKLCH** | Verifica che i colori usino il metodo **OKLCH** e che contrasto/accessibilità siano rispettati in OKLCH | Design: conversion hex→OKLCH + ratio; Codice: parsing CSS OKLCH + verifica |

**In sintesi:** tre layer su codice (axe-core, HTML_CodeSniffer, Lighthouse) + Kimi su design + OKLCH per il metodo colore. Vedi sotto i dettagli e l’ordine di integrazione.

---

## 1. Ruolo di Kimi vs backend/API (audit su design)

| Cosa | Chi | Note |
|------|-----|------|
| **Interpretazione del JSON Figma** | Kimi | Nodi, gerarchia, nomi, tipo (TEXT, RECTANGLE, COMPONENT…), bounds, fills. |
| **Euristiche (heading, alt, focus, semantica)** | Kimi | Nomi generici, struttura, varianti componente, ordine suggerito. |
| **Calcolo contrast ratio** | Backend (consigliato) | Formule WCAG da hex/rgba; nessuna API esterna. |
| **Calcolo touch target** | Backend | Da `absoluteBoundingBox`; nessuna API esterna. |
| **Simulazione daltonismo (opzionale)** | Backend + lib/API gratuita | Trasformazione colore (deuteranopia/protanopia); risultato passato a Kimi o usato per flag. |
| **Report unificato e fix** | Kimi | Riceve JSON file + eventuali dati pre-calcolati; restituisce `issues[]` in formato AuditIssue. |

In sintesi: **backend** fa calcoli precisi (contrasto, dimensioni) e può chiamare **API/servizi gratuiti** per daltonismo; **Kimi** fa il resto (regole qualitative, messaggi, fix, coerenza output).

---

## 2. Cosa fare senza API esterne (solo backend)

- **Contrast ratio:** da `fills` (hex o rgba) di testo e sfondo: calcolo luminance (WCAG) e ratio. Implementazione in JS/Node in poche righe; nessuna chiamata HTTP.
- **Touch target:** da `absoluteBoundingBox.width` e `.height`; confronto con soglia 44 (o 48) px.
- **Font size:** da stili testo nel JSON (se presenti) per euristiche su “testo grande” vs “testo normale” (soglie WCAG).

Questi dati possono essere:
- **Opzione A:** inviati a Kimi come “contesto aggiuntivo” (es. “Per i seguenti nodeId il contrast ratio è sotto 4.5:1: …”) così Kimi scrive le issue e i fix.
- **Opzione B:** il backend genera direttamente parte delle issue (contrast, touch) e le unisce a quelle restituite da Kimi (euristiche alt, focus, semantics).

---

## 3. API / servizi gratuiti utili (opzionali)

- **Simulazione daltonismo (colori):**  
  - Librerie JS open source che trasformano hex/rgb in versione “deuteranopia” o “protanopia”. Nessuna API esterna; si applicano ai `fills` e si confrontano con originali per vedere se due stati restano distinguibili.  
  - Alternativa: servizi REST gratuiti che restituiscono “colore simulato” (cercare “color blindness simulation API”); uso opzionale se si preferisce non includere dipendenze.

- **Validazione WCAG / contrasto:**  
  - Formule WCAG sono pubbliche; non serve un’API per il ratio. Se si vuole “WCAG level AA/AAA” come etichetta, è sufficiente applicare le soglie nel backend.

- **axe-core / HTML_CodeSniffer / Lighthouse:**  
  - Vedi **§ 7. Tre layer su codice generato** in questo documento. Non sul file Figma (axe e Lighthouse richiedono DOM/URL); si usano sul codice generato (post–Code Agent) o su HTML/CSS fornito dall’utente.

---

## 4. Flusso consigliato (MVP)

1. **Plugin** → Scan (o “Run A11Y Audit”) → invia `file_key` + JWT (come per DS Audit).
2. **Backend** → legge token Figma, chiama `GET /v1/files/:key`, ottiene il JSON.
3. **Backend** → (opzionale) pre-calcola per un sottoinsieme di nodi: contrast ratio (testo/sfondo), touch target sotto soglia. Costruisce un breve “contesto numerico” (es. lista nodeId + ratio o “sotto 44px”).
4. **Backend** → legge `auth-deploy/prompts/a11y-audit-system.md` (system prompt con regole da **audit-specs/a11y-audit/A11Y-AUDIT-RULES.md** e **OUTPUT-SCHEMA.md**).
5. **Backend** → chiama Kimi: system message = prompt, user message = JSON file (+ eventuale blocco “Pre-computed: contrast/touch …”). Kimi restituisce `{ "issues": [ ... ] }`.
6. **Backend** → estrae e valida le issue (formato **audit-specs/a11y-audit/OUTPUT-SCHEMA.md**), mappa a `AuditIssue`, restituisce al plugin.
7. **Plugin** → tab A11Y mostra le issue (come per DS).

Se si sceglie **Opzione B** (backend genera issue contrast/touch): il backend dopo il passo 3 genera le issue per contrast e touch, poi chiama Kimi solo per le altre categorie (alt, focus, semantics, color) e unisce le liste prima di restituire al plugin.

---

## 5. Materiali da produrre (allineati ad ACTION-PLAN Fase 2)

| Cosa | Dove |
|------|------|
| Regole A11Y | **audit-specs/a11y-audit/A11Y-AUDIT-RULES.md** (già creato) |
| Schema output | **audit-specs/a11y-audit/OUTPUT-SCHEMA.md** (già creato) |
| **Matrice crediti (v1.0 senza Kimi)** | **docs/COST-ESTIMATE-A11Y.md** — bande complessità come DS, 1/2/4/6 crediti |
| System prompt | **auth-deploy/prompts/a11y-audit-system.md** (solo se si aggiunge Kimi in seguito) |
| Endpoint | **POST /api/agents/a11y-audit** (file_key, JWT, Figma JSON → backend deterministico → issues) |
| Plugin | `fetchA11yAudit`, tab A11Y con issue reali, stima crediti con `getA11yCostAndSize(nodeCount)` |

---

## 6. Ordine di lavoro suggerito

1. Completare **Fase 0** e **Fase 1** (DS Audit) — pipeline dati e primo agente funzionante.
2. Scrivere **a11y-audit-system.md** (prompt) usando **A11Y-AUDIT-RULES.md** e **OUTPUT-SCHEMA.md**.
3. Testare su kimi.com: primo messaggio = prompt, secondo = JSON file (o JSON ridotto); verificare che le issue abbiano categoryId e severity corretti.
4. Implementare **POST /api/agents/a11y-audit**: stesso schema di ds-audit (getFigmaAccessToken, GET file, chiamata Kimi, parsing JSON).
5. (Opzionale) Aggiungere in backend il pre-calcolo contrast/touch e passarli a Kimi come contesto (o generare issue contrast/touch lato backend e unire a quelle Kimi).
6. Integrare nel plugin: `fetchA11yAudit(fileKey)`, salvare issue A11Y in stato, mostrare nel tab A11Y.
7. **(Fatto v1.0 design)** Backend deterministico: **oauth-server/a11y-audit-engine.mjs** (contrast, touch, focus, alt, semantics, color, OKLCH). Endpoint **POST /api/agents/a11y-audit**; plugin tab A11Y con stima crediti (getA11yCostAndSize) e consume `a11y_audit`. (Dopo MVP) Integrare **tre layer su codice** (axe-core, HTML_CodeSniffer, Lighthouse) e **verifica OKLCH su HTML** (vedi § 7 e § 8): endpoint es. **POST /api/agents/a11y-audit-code** (input: html o url).

---

## 7. Tre layer su codice generato (axe-core, HTML_CodeSniffer, Lighthouse)

Per Comtra la stack consigliata sull’**output del Code Agent** (o su HTML/CSS fornito dall’utente) è:

| Layer | Strumento | Ruolo | Licenza |
|-------|------------|--------|---------|
| **1. Engine primario** | **axe-core** | Analizza il **DOM** del codice generato: semantica, ARIA, contrasto sugli stili applicati, label, heading, focus. È lo standard de facto per audit automatici su pagina renderizzata. | Open source (MPL-2.0) |
| **2. Verifica statica HTML** | **HTML_CodeSniffer** | Verifica **statica** sull’HTML (markup, attributi, struttura, convenzioni WCAG). Complementare ad axe: cattura problemi che axe valuta in contesto (es. markup malformato prima del render). | Open source (GPL v3) |
| **3. Punteggio sintetico report** | **Lighthouse** | Punteggio sintetico (Performance, Accessibility, Best Practices, SEO) nel **report finale**. L’utente vede un voto A11Y chiaro; le issue dettagliate restano da axe + CodeSniffer + Kimi. | Open source (Apache 2.0) |

**Flusso suggerito (post–Code Agent o su URL/HTML fornito):**

1. Backend riceve HTML (generato o upload/URL).
2. (Opzionale) Rendering in headless browser (Puppeteer/Playwright) per ottenere DOM completo.
3. **axe-core:** `axe.run(document)` → lista violazioni + passi; mappare a `AuditIssue[]` (categoryId es. `contrast`, `aria`, `semantics`).
4. **HTML_CodeSniffer:** analisi statica sull’HTML sorgente → messaggi/principi WCAG; unire alle issue (evitare duplicati con axe).
5. **Lighthouse:** esecuzione (CLI o programmatica) su URL o HTML → estrarre **Accessibility score** (e opzionale Performance/Best Practices); includere nel report finale come “Punteggio A11Y: X/100” e breakdown.

**Implementazione:** tutti e tre sono utilizzabili in Node/backend (axe-core e CodeSniffer come lib; Lighthouse come CLI o modulo). Zero costi di licenza.

---

## 8. Verifica metodo colore OKLCH

Oltre al contrast ratio in hex/sRGB (WCAG), Comtra integra un **sistema di verifica del metodo colore OKLCH**.

**Perché OKLCH:** OKLCH (Oklab Lightness Chroma Hue) è uno spazio colore percepibilmente uniforme, adatto a design system e token (es. `oklch(0.65 0.15 250)`). Permette di verificare contrasto e accessibilità in uno spazio più coerente con la percezione e con le best practice moderne (CSS Color Module Level 4).

**Cosa verificare:**

| Contesto | Verifica |
|----------|----------|
| **Design (Figma JSON)** | Conversion hex/rgba → OKLCH (se i `fills` sono hex/rgba); calcolo contrast ratio in OKLCH (o sRGB dopo conversione) e confronto con soglie WCAG. Segnalare se i token/colori del file potrebbero essere espressi in OKLCH per coerenza design–code. |
| **Codice (CSS generato)** | Parsing delle dichiarazioni colore: rilevare uso di `oklch(...)` vs `hex`/`rgb()`; segnalare dove sarebbe preferibile OKLCH (es. token, variabili). Verifica contrasto per coppie testo/sfondo in OKLCH quando entrambi sono in OKLCH. |

**Implementazione:** librerie JS open source per conversione sRGB/hex ↔ OKLCH e per contrast ratio in OKLCH (o uso delle formule WCAG applicate dopo conversione a luminance). Nessuna API esterna obbligatoria.

**Output:** issue con categoryId `color` (o sottocategoria `oklch`) e fix tipo “Use OKLCH for this token” o “Contrast in OKLCH below 4.5:1”.

---

## Riferimenti

- **Regole e schema A11Y:** audit-specs/a11y-audit/ (README, A11Y-AUDIT-RULES.md, OUTPUT-SCHEMA.md)
- **Piano generale agenti:** docs/ACTION-PLAN-KIMI-AGENTS.md (Fase 2)
- **Fattibilità (axe, WCAG su design):** docs/FEASIBILITY-KIMI-SWARM.md
- **Pipeline e knowledge:** docs/AUDIT-PIPELINE-AND-KNOWLEDGE.md
- **axe-core:** [github.com/dequelabs/axe-core](https://github.com/dequelabs/axe-core)
- **HTML_CodeSniffer:** [github.com/squizlabs/HTML_CodeSniffer](https://github.com/squizlabs/HTML_CodeSniffer)
- **Lighthouse:** [developer.chrome.com/docs/lighthouse](https://developer.chrome.com/docs/lighthouse)
