# Design Handoff & Drift — Ruleset per consigli e contesto Sync

Ruleset **trasversale** basata su ricerca community (thread, articoli, issue): cluster tematici, problemi ricorrenti, severity e tono. Serve a (1) dare contesto quando si interpretano risultati di **Sync** (drift Figma ↔ Storybook/repo); (2) generare **consigli utili** da mostrare insieme alle violazioni; (3) allineare tono e priorità con ciò che i team vivono davvero.

**Uso:**  
- In fase di **risultati Sync**: mappare ogni drift item (es. “padding inconsistency”, “token mismatch”, “componente duplicato”) al cluster più vicino e, se utile, arricchire il messaggio con un consiglio dalla sezione *Consigli durante risultati Sync* del cluster.  
- In **documentazione / copy**: evitare promesse che contrastano con i problemi ricorrenti (es. “handoff perfetto”) e usare un linguaggio che risuoni con frustrazione/rassegnazione osservata.  
- In **priorità prodotto**: severity media per cluster aiuta a decidere dove investire (es. Cluster 2 e 6 hanno impatto alto su qualità e cultura).

---

## Scala di severity (riferimento)

| Livello | Descrizione |
|--------|-------------|
| **1** | Irritazione lieve, piccolo attrito, problemi “annoying but fine”. |
| **2** | Fastidio costante, rallenta il lavoro ma non blocca. |
| **3** | Impatto forte su tempo/qualità, tono spesso rassegnato o sarcastico. |
| **4** | Blocco parziale, rework massiccio, conflitti tra team. |
| **5** | Fallimento sistemico, perdita di fiducia nel processo/strumenti, thread molto accesi o pessimisti. |

---

## Cluster 1 – Handoff rotto e comunicazione (people/process)

### Problemi ricorrenti

- Handoff “one-shot” tipo “hot potato”: file consegnato e poi silenzio; dev costretti a interpretare.
- Mancanza di contesto: nessuna priorità, rationale, edge case, logiche di business, solo mockup “perfetti”.
- Troppi canali non coordinati (Figma + Slack + ticket + doc sparsi) → versioni divergenti della “verità”.
- Problemi che emergono *dopo* l’handoff, quando correggere è troppo tardi e costoso.

### Severity media

**4/5** — Tono: frustrato e rassegnato (“handoff is still incredibly broken”, “true work starts after the handoff”), cinismo su meeting per chiarire ciò che poteva essere discusso prima.

### Consigli durante risultati Sync

- Quando il drift riguarda **più componenti o più pagine**: suggerire di non trattare il Sync come “fix one-off”, ma di introdurre un checkpoint (es. breve call o doc condivisa) su priorità e edge case *prima* del prossimo ciclo.
- Se le violazioni sono **numerose e sparse**: ricordare che spesso il problema non è solo “Figma vs codice”, ma mancanza di un canale unico (es. “Usa questa lista di drift come agenda per un sync design–dev su cosa è fonte di verità”).
- Copy suggerito: *“Questi drift spesso nascono da handoff a senso unico. Un rapido allineamento su priorità e stati (loading, error, empty) prima del prossimo sprint riduce il rework.”*

---

## Cluster 2 – Dev–design mismatch e design drift sul prodotto

### Problemi ricorrenti

- UI finale diversa dal design: spacing, font, colori, border-radius, interazioni non corrispondono; tempo passato a “fixare piccole inconsistenze CSS” o ad accettare compromessi.
- Componenti simili ma non uguali (“UI patchwork”): pulsanti clonati, card con varianti ad-hoc, pattern duplicati → prodotto “quasi coerente ma non davvero”.
- UX che “si rompe dopo l’handoff” per tagli, scorciatoie tecniche o mancanza di comprensione delle priorità UX.
- Design system che “driftano silenziosamente”: non esplodono con bug eclatanti, ma accumulano deviazioni fino a diventare irriconoscibili.

### Severity media

**4–5/5** — Alto impatto su qualità percepita e coerenza. Tono: frustrazione (“our design to dev handoff is a mess”), ironia amara (“design systems don’t break loudly, they drift quietly”), impotenza davanti ai compromessi tecnici.

### Consigli durante risultati Sync

- Per **singola violazione** (es. padding, colore, radius): *“Piccole deviazioni come questa si sommano e diventano ‘design system che driftano in silenzio’. Correggerle ora evita il patchwork.”*
- Per **più violazioni sullo stesso componente**: *“Questo componente sta divergendo dalla source of truth. Valuta se creare una variante in Figma/Storybook invece di override locali.”*
- Per **pattern ripetuti** (es. stesso tipo di drift su più card/pulsanti): *“Sembra un caso di UI patchwork: componenti simili ma non uguali. Un unico componente con varianti riduce il drift futuro.”*
- Copy suggerito: *“Il drift non fa rumore: si accumula. Sync regolari + fix incrementali tengono il prodotto allineato al design.”*

---

## Cluster 3 – Design system, adozione parziale e governance

### Problemi ricorrenti

- Adozione parziale: team che usano solo alcuni componenti o forkano per “piccoli aggiustamenti” → drift strutturale.
- Mancanza di governance chiara: nessuno approva modifiche, rimuove obsoleti, allinea design e codice; sistemi trattati come “progetti” e non “prodotti”.
- Gap tra system e prodotto: ottimi sistemi, ma feature team che costruiscono UI misaligned per tempo, legacy o mancanza di incentivi.
- Debito di design system: comportamento implementato che diverge da documentazione o Figma kit.

### Severity media

**3–4/5** — Tono: analitico e “post-mortem” negli articoli, esausto nei thread (“we invested so much in the system, yet our product still looks inconsistent”).

### Consigli durante risultati Sync

- Se il drift riguarda **componenti “fuori library” o custom**: *“Questo tipo di drift è spesso sintomo di adozione parziale: qualcuno ha costruito fuori dal system. Valuta se portare il pattern in library invece di mantenere un fork.”*
- Se le violazioni sono **ricorrenti sullo stesso tipo di componente**: *“Una governance chiara (chi approva cambi, chi rimuove obsoleti) riduce il drift. Usa questa lista per una review design–code condivisa.”*
- Copy suggerito: *“Il design system è un prodotto, non un progetto una tantum. Sync e audit periodici aiutano a trattarlo così.”*

---

## Cluster 4 – Design tokens, theming e “token drift”

### Problemi ricorrenti

- Drift dei design token: valori aggiornati in Figma ma non in codice (o viceversa); pipeline manuali fragili.
- Theming multi-brand/multi-piattaforma: varianti di tema che non ricevono gli stessi update → incoerenza tra brand, app e web.
- Token non istituzionalizzati: team “non ancora pronti per i tokens” ma che soffrono di drift cromatico/typografico.
- Mancanza di automazione: il drift diminuisce quando i token sono compilati automaticamente verso CSS, mobile e docs.

### Severity media

**3/5** — Tono: tecnico e sperimentale; “speranzoso” (chi posta soluzioni, plugin, architetture), con consapevolezza che senza token governance il drift è inevitabile.

### Consigli durante risultati Sync

- Per **violazioni su colori, spacing, font** (tipico token drift): *“Questo è classico token drift: Figma e codice non condividono la stessa fonte. Considera un unico export (Figma Variables → CSS/JSON) e un solo flusso di update.”*
- Per **multi-brand / multi-tema**: *“Se hai più temi o brand, assicurati che ogni variante riceva gli stessi aggiornamenti token; altrimenti il drift si moltiplica.”*
- Copy suggerito: *“I token sono la base della coerenza. Automatizzare l’export (es. tab Tokens → Storybook/repo) riduce il drift senza sforzo manuale.”*

---

## Cluster 5 – Specifiche, documentazione e stati/edge case mancanti

### Problemi ricorrenti

- Design specs che non servono ai dev: troppo verbose o troppo vaghe, non aggiornate, non rappresentano la UI reale in produzione.
- Stati “invisibili” non progettati: error, loading, empty, skeleton, edge case data, breakpoint intermedi → dev improvvisano → drift.
- Prototipi “happy path” senza condizioni limite, leading, overflow, localizzazioni o numeri grandi → problemi in late QA o post-release.
- Mancanza di feedback loop: pochi team fanno review di design a fine sviluppo con screenshot del prodotto reale.

### Severity media

**4/5** — Tono: esausto (“design problems often appear during handoff, not creation”), frustrazione nel dover indovinare stati mancanti.

### Consigli durante risultati Sync

- Se il drift riguarda **stati o varianti** (es. hover, disabled, error): *“Molto drift nasce da stati non progettati (loading, empty, error). Se questo componente non ha tutte le varianti in Figma, è il momento di aggiungerle e risincronizzare.”*
- Se le violazioni riguardano **testo/overflow/numeri**: *“Prototipi spesso coprono solo l’happy path. Overflow, testi lunghi e numeri grandi vanno definiti in design per evitare fix ad hoc in codice.”*
- Copy suggerito: *“Usa i risultati del Sync come checklist: per ogni componente con drift, chiediti se error/loading/empty sono definiti in Figma. Se mancano, documentali.”*

---

## Cluster 6 – Cultura, ruoli e collaborazione design–dev

### Problemi ricorrenti

- Conflitto di priorità: designer su coerenza/polish, dev su performance/debito/scadenze → compromessi silenziosi alla base del drift.
- Assenza di ruoli di ponte (design ops, design system engineer, UX engineer): “no one owning the system”.
- Bassa fiducia reciproca: “dev don’t respect the design”, “designers don’t understand constraints”.
- Design-driven development e no-code/low-code: riducono i punti di handoff ma sollevano dubbi sul debito tecnico.

### Severity media

**4–5/5** — Influenza tutti gli altri cluster. Tono: polarizzato; costruttivo (“bridging the gap”) vs frustrazione, sarcasmo e flame tra ruoli.

### Consigli durante risultati Sync

- Quando il **numero di violazioni è alto** o **ripetuto nel tempo**: *“Il drift ripetuto spesso segnala un problema di priorità e ownership. Una persona o un piccolo team ‘ponte’ (design system engineer, design ops) può tenere Figma e codice allineati.”*
- Per **violazioni “di compromesso”** (es. spacing/colore “quasi giusto”): *“Compromessi silenziosi tra design e dev creano questo tipo di drift. Un breve sync su vincoli tecnici e priorità di design aiuta a evitare il ‘quasi giusto’.”*
- Copy suggerito: *“Sync e drift non sono solo tecnici: sono anche priorità e fiducia. Usa i risultati per una conversazione design–dev, non solo per una lista di fix.”*

---

## Cluster 7 – Strumenti, workflow e limiti dell’ecosistema

### Problemi ricorrenti

- Strumenti che migliorano i dettagli ma non eliminano il “translation gap” (Figma, Zeplin, Dev Mode, plugin).
- Troppo focus su export asset/codice, poco su collaborazione, versioning e responsabilità condivisa.
- Disallineamento tra librerie UI (React/Vue ecc.) e componenti di design: API dei componenti che non riflettono più il design, o viceversa.

### Severity media

**3–4/5** — Tono: critico ma pragmatico (“today’s tools haven’t solved the handoff problem”), orientato alla proposta.

### Consigli durante risultati Sync

- Per **drift su API/props** (componente in codice con props diverse da Figma): *“Spesso il gap non è solo visivo: le API dei componenti (React/Vue) non riflettono più le proprietà di Figma. Controlla che varianti e props in Storybook corrispondano al design.”*
- Copy suggerito: *“Gli strumenti da soli non risolvono l’handoff. Il Sync ti dice *dove* c’è drift; il *come* risolverlo (processo, ownership, review) dipende dal team.”*

---

## Cluster 8 – Technical debt, regressioni e monitoraggio del drift

### Problemi ricorrenti

- Ogni piccola deviazione (quick fix CSS, override locale) accumula debito che si manifesta come drift diffuso.
- Mancanza di strumenti di monitoraggio: pochi team hanno snapshot visivi, audit periodici o automazioni.
- Regressioni tra release: modifiche a componenti condivisi che rompono la coerenza in contesti non testati.

### Severity media

**4/5** — Tono: tecnico e “ingegneristico”, con sottotesto allarmato (debito che “uccide lentamente” i team front-end).

### Consigli durante risultati Sync

- Per **violazioni che sembrano “piccoli fix”** (es. un padding, un colore): *“Ogni piccolo override aggiunge debito. Fixare ora ed evitare override locali tiene il sistema sostenibile.”*
- Per **drift su componenti condivisi**: *“Modifiche a componenti condivisi possono rompere altri contesti. Dopo il fix, vale la pena un check (o test visivo) su tutte le usanze del componente.”*
- Copy suggerito: *“Il drift non si risolve una volta per tutte: serve monitoraggio periodico. Usa il Sync come audit ricorrente, non solo come one-off.”*

---

## Mappatura rapida: tipo di drift → cluster

| Tipo di drift (esempi) | Cluster principale | Severity tipica |
|------------------------|--------------------|------------------|
| Padding, spacing, colori, font, radius (singoli) | 2, 4 | 3–4 |
| Token mismatch (Figma vs codice) | 4 | 3 |
| Componente duplicato / variante ad-hoc | 2, 3 | 4 |
| Stati mancanti (loading, error, empty) | 5 | 4 |
| API/props non allineate a Figma | 7 | 3–4 |
| Molte violazioni sparse, ripetute nel tempo | 1, 6, 8 | 4–5 |
| Adozione parziale, fork, “fuori library” | 3 | 3–4 |
| Quick fix / override che si accumulano | 8 | 4 |

---

## Come usare questa ruleset (per AI / team)

1. **In output Sync:** per ogni drift item restituito (id, name, desc), scegliere il cluster più vicino (e, opzionalmente, il tipo dalla tabella sopra) e arricchire il messaggio con un consiglio dalla sezione *Consigli durante risultati Sync* del cluster, adattando il testo al singolo caso.
2. **In copy UI:** evitare promesse (“handoff perfetto”, “zero drift”) e usare formulazioni che riconoscano il problema (es. “il drift si accumula in silenzio”, “sync regolari riducono il rework”).
3. **In priorità:** cluster con severity 4–5 (1, 2, 5, 6, 8) meritano messaggi e suggerimenti più evidenti; cluster 3, 4, 7 possono essere più “tecnici” e orientati a governance/strumenti.

Fine ruleset. Per estendere: aggiungere nuovi problemi ricorrenti sotto ogni cluster e nuovi consigli in base a feedback utenti sui risultati Sync.
