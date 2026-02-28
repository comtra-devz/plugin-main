# Problematiche ricorrenti (community e forum)

Sintesi di **100 thread** analizzati da utenti su design system: forum ufficiale del tool di design e relative community, community informali (design system, UX, design), repository di design system open source, articoli di esperti su governance, ecosistemi multi‑prodotto (white‑label, ecc.).  
Questo documento serve a: (1) dare contesto al tono e alla severity delle issue; (2) mappare ogni problema ricorrente alle regole di audit verificabili dal file di design; (3) segnalare ciò che **non** è auditabile dal solo JSON (governance, processi, design–dev gap).

---

## Scala di severity (riferimento community)

| Livello | Nome       | Descrizione |
|--------|------------|-------------|
| **1**  | Nuisance   | Fastidio minore, workaround ovvi (es. incertezze su DS della Community). |
| **2**  | Irritante  | Rallenta ma non blocca (struttura non ottimale, stato issue poco chiaro). |
| **3**  | Strutturale| Crea debito costante (doc scarsa, gap design–dev, multi‑brand non risolto). |
| **4**  | Critico   | Impatta seriamente adoption e qualità (governance debole, drift, team che ignorano il DS). |
| **5**  | Bloccante  | Ferma il lavoro o mina l’intero investimento (componenti rotti in massa, DS che collassa). |

**Mapping verso severity audit (DS-AUDIT-RULES):** HIGH ≈ 4–5, MED ≈ 3, LOW ≈ 1–2.

---

## Cluster 1 — Forum ufficiale e community del tool di design

### Problemi ricorrenti

1. **Componenti che “si rompono” dopo update o publish**  
   Allineamenti di testo che cambiano (centrato → left/right); nested components che scalano in modo imprevedibile; componenti in file di prodotto che non rispecchiano lo stato del design system. Tono: frustrato, spesso “disperato” (“½ of my library is broken”).
2. **Update del design system che rompono i layout**  
   Come aggiornare senza rompere layout complessi; pushed changes che distruggono direzioni di auto‑layout, ore di fix manuale.
3. **Connessioni rotte tra file e libreria / variabili**  
   Migrazioni di account/piani che staccano componenti e variabili; “Repair Component/Variables Connections” che non funziona come atteso.
4. **Organizzazione e struttura del DS nell’editor**  
   Come strutturare da zero (file, pagine, naming, gerarchie); come usare un DS dalla community (cosa staccare, cosa mantenere linkato).
5. **Nuove feature del tool vs sistemi esistenti**  
   Integrazione con DS esistenti; incertezza su compatibilità con nuovi flussi del tool.

### Severity media (cluster 1)

- Componenti rotti / layout che saltano → **5** (bloccante)
- Connessioni rotte dopo migrazioni → **4** (critico)
- Organizzazione / setup → **3** (strutturale)
- DS da community / nuove feature del tool → **2–3** (irritante / strutturale)

---

## Cluster 2 — Community informali

### Problemi ricorrenti

1. **Inconsistenza e drift del sistema** — Varianti che divergono, componenti quasi uguali ma non identici; sistemi che “si erodono”.
2. **Doc mancante o obsoleta** — Difficile capire come usare componenti, quando usare varianti, cosa è canonical.
3. **Gap design–dev e “DS definito dai developer”** — Solo schermi da cui i dev estraggono pattern; designer che non usano le style library; dev che rincorrono l’estetica dei designer.
4. **Scalabilità e complessità eccessiva** — Troppi componenti/varianti, difficile da mantenere.
5. **Adozione e buy‑in** — Team che usano solo pezzi, altri che “fanno meglio loro”, conflitti.
6. **Accessibilità e constraints tecnici** — Garantire accessibilità consistente; token & styling (mappare a CSS, color spaces).
7. **Breakage nell’editor** — Cambi pushati che rompono direzioni di autolayout, ore di fix manuale.

### Severity (cluster 2)

- Drift / inconsistenza → **4**; doc / gap design–dev → **3–4**; breakage specifica → **5**.

---

## Cluster 3 — Repository e design system ufficiali

### Problemi ricorrenti

1. **Component lifecycle e governance su larga scala** — Propose → review → build → document → release → deprecate; backward compatibility.
2. **Contributi esterni / community contribution** — Guidelines, qualità, duplicazione tra contributor.
3. **Annunci e breaking changes** — Versioning, migrazioni; design drift se i consumer non seguono changelog.
4. **Multi‑brand / multi‑product** — Foundation condivise vs differenziazione brand; theme structure, evitare esplosione di varianti.

### Severity (cluster 3)

- Lifecycle / governance mancante → **4–5**; multi‑brand/theme → **3–4**; contribution rules → **2–3**.

---

## Cluster 4 — Governance / articoli esperti

### Problemi ricorrenti

1. **Governance debole → design drift** — Solo ~40% dei DS “sopravvive” dopo 12–18 mesi; motivo non tecnico ma governance e conversazioni assenti; DS che “vivono” solo nel file di design invece che in canali condivisi e decision log.
2. **Reluctance / adozione parziale** — Team che usano solo parti o creano “better ways”; nuovi membri senza ownership.
3. **Confusione bug vs gap vs feature** — “Il design system non funziona per me”: distinguere bug, visual discrepancy, gap di pattern, richiesta di feature.
4. **Mancanza di processi per richieste e cambiamenti** — Decision log, RACI, cicli di review; governance conversation‑first.
5. **Implementation challenges** — Politica interna, varianti custom, mancanza di misure di adozione; mancanza di sponsor, mis‑fit con stack, backlog di fix ignorato.

### Severity (cluster Governance)

- Governance debole / drift culturale → **5**; adozione parziale → **4**; processi per richieste → **3–4**.

---

## Cluster 5 — Multi‑product / ecosistemi verticali

### Problemi ricorrenti

1. **Perché creare un DS** — Timori su lock‑in, complessità, governance.
2. **Limitazioni strumenti DS nel prodotto** — Community che chiede un “vero” design system.
3. **Chiarezza stato issue** — Cosa è risolto vs aperto; comunicazione backlog.
4. **White‑label multi‑tenant** — Configurabilità e mantenibilità con molte varianti di brand.

### Severity (cluster Multi‑product)

- White‑label DS sbagliato → **4**; feature gap / stato issue → **2–3**.

---

## Mappatura: problema ricorrente → regole di audit

Per ogni problema ricorrente si indica se è **rilevabile dall’audit sul file di design** (e quali regole) o se è **fuori scope** (governance, processo, tool).

| Problema ricorrente | Regole audit (DS-AUDIT-RULES) | Note |
|---------------------|------------------------------|------|
| Componenti che si rompono dopo update / layout che salta | **1.1** (istanza staccata), **1.5** (troppi override → rischio breakage) | Segnalare istanze con molti override come rischio. |
| Update DS che rompono layout / autolayout | **1.1**, **1.5**, **4.3** (auto‑layout assente) | Override su layout/padding sono spesso causa. |
| Connessioni rotte (library/variabili) | Non determinabile dal solo JSON del file | Dipende da stato account/library; possibile solo hint se variabili mancanti. |
| Organizzazione / struttura DS (file, pagine, naming) | **3.1**, **3.2**, **3.4**, **4.1**–**4.5** | Naming, ghost node, gerarchia. |
| Uso DS da community / nuove feature del tool | Non auditabile dal file | Contesto di processo. |
| Inconsistenza e drift (varianti divergenti, quasi uguali) | **1.3** (duplicati), **1.4** (gruppo vs componente), **3.3**, **5.x**, **7.3** | Duplicati e stili ripetuti sono segnali. |
| Doc mancante / obsoleta | **7.1** (componente senza descrizione) | Proxy: assenza descrizione = doc gap. |
| Gap design–dev / DS solo nel file | Non auditabile dal file | Processo e tooling. |
| Scalabilità / complessità eccessiva | **1.2** (orfani), **1.3**, **4.2** (nesting), **7.3** | Orfani, duplicati, nesting = segnali di complessità. |
| Adozione e buy‑in | Non auditabile dal file | Governance. |
| Accessibilità | **7.4** (contrast e leggibilità) | Segnalazione verifica contrasto/token. |
| Breakage autolayout (es. “3h fixing”) | **1.1**, **1.5**, **4.3**, **4.4** | Override e layout incoerente. |
| Lifecycle / governance / breaking changes | Non auditabile dal file | Processo. |
| Multi‑brand / theme | **2.x** (token), **3.x** (naming) | Coerenza token e naming è verificabile. |
| White‑label / multi‑tenant | Parzialmente **2.x**, **3.x** | Struttura token e naming. |

---

## Uso nelle regole e nel prompt

- **System prompt (agente DS):** includere un breve riassunto delle problematiche ricorrenti (o il link a questo file) per dare priorità: issue che segnalano “rischio breakage” (1.1, 1.5) e “drift” (1.3, 7.3) hanno impatto diretto sulla percezione utente (severity 4–5 in scala community).
- **Severity:** dove l’audit usa HIGH/MED/LOW, considerare HIGH per problemi che in community sono 4–5 (componenti rotti, drift, layout), MED per 3 (struttura, doc), LOW per 1–2.
- **Messaggi di fix:** possono richiamare il contesto community (es. “Molti override su questa istanza: agli update della library rischi breakage di layout come segnalato spesso nei forum di utenti”).
