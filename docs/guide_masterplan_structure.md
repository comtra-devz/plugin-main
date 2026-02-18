# Guida alla Costruzione del Master Plan Checklist

Questa guida spiega come replicare la struttura del "Master Plan" presente nel Launcher (file `MasterPlanView.tsx`). L'obiettivo è creare una checklist interattiva, dettagliata e "Copy-Paste Ready" per lo sviluppo di progetti complessi guidati dall'AI.

---

## 1. Filosofia Strutturale

Il Master Plan non è una semplice lista di cose da fare. È un **Container di Contesto**.
Ogni fase è progettata per contenere tutto ciò che serve a un AI (o a uno sviluppatore umano) per eseguire quel task specifico senza dover cercare altrove.

### I Principi Chiave:
1.  **Context Injection (Il Prompt è Re):** Le istruzioni non stanno nella descrizione UI, ma nel blocco di codice "Prompt" che l'utente copia. Questo trasferisce la "memoria del progetto" all'AI esecutiva.
2.  **No Duplicate**: Non ripetere le regole di business nella descrizione visiva se sono già nel prompt. La descrizione visiva serve all'umano per capire "cosa stiamo facendo", il prompt serve all'AI per capire "come farlo".
3.  **Cost Awareness**: Ogni feature ha un costo associato (tempo o denaro) per educare il cliente/developer sulla sostenibilità.

---

## 2. Struttura Dati (TypeScript)

Ogni fase del piano è un oggetto JSON che segue questa interfaccia rigorosa:

```typescript
interface PlanPhase {
  id: number;          // Sequenziale (0, 1, 2...)
  section?: string;    // Opzionale. Se presente, crea un Header visivo sopra la card (es. "INFRASTRUCTURE")
  title: string;       // Titolo breve della Feature (es. "FEAT: AUDIT SUITE")
  desc: string;        // Sottotitolo visibile a card chiusa (es. "Algoritmi di scansione e report")
  tools: string[];     // Stack tecnologico (es. ["Supabase", "Gemini Pro"])
  cost: string;        // Analisi Costi (es. "DEV: €0.01 | USER: 5 Credits")
  details: string;     // Testo visibile a card aperta. SOLO per azioni manuali o riassunti.
  prompts: string[];   // ARRAY CRUCIALE. Contiene il System Prompt + Regole di Business + Task.
}
```

---

## 3. Logica di Suddivisione in Sezioni

Dividi il progetto in 4 macro-aree logiche per mantenere l'ordine mentale:

### A. PREPARATION & SETUP (Fase 0)
*   **Obiettivo:** Definire le regole del gioco.
*   **Cosa include:** Setup Database, Logica dei Crediti, Costi globali, Analisi del Frontend esistente.
*   **Prompt Chiave:** Regole "Globali" che l'AI deve ricordare per tutto il progetto (es. "Usa sempre Tailwind", "Il Free Tier ha 10 crediti").

### B. CORE FEATURES & LOGIC (Fasi 1-5)
*   **Obiettivo:** Costruire il valore per l'utente.
*   **Cosa include:** Le funzionalità vere e proprie (es. Audit, Generazione, Export).
*   **Regola Prompt:** Ogni prompt deve essere "Self-Contained". Includi il contesto specifico della feature (es. "Regole A11y per l'Audit") direttamente nel prompt di quella fase.

### C. INFRASTRUCTURE & OPERATIONS (Fasi 6-10)
*   **Obiettivo:** Far funzionare il sistema su scala e gestire i soldi.
*   **Cosa include:** Backend (Caching), Auth (Login), Pagamenti (Stripe), Hosting.
*   **Logica Prompt:** Qui i prompt sono molto tecnici (SQL, API Calls, Webhooks).

### D. OPS & MONITORING (Fasi 11-12)
*   **Obiettivo:** Mantenere il sistema vivo.
*   **Cosa include:** Deployment, Review negli Store, Dashboard di monitoraggio margini.
*   **Nota:** Spesso queste fasi hanno `details` con azioni manuali ("Vai su Vercel e clicca Deploy").

---

## 4. Come Scrivere il Contenuto (Best Practices)

### Campo `cost` (Analisi Margini)
Non scrivere solo "Costo API". Scrivi la relazione tra costo e ricavo.
*   **Formato:** `DEV: [Costo Tuo] | USER: [Prezzo Utente]`
*   **Esempio:** `DEV: €0.04 | USER: €2.00` (Fa capire subito se la feature è sostenibile).

### Campo `details` vs `prompts` (Regola Anti-Duplicati)
*   **SBAGLIATO:** Scrivere le regole di validazione sia in `details` che in `prompts`.
*   **GIUSTO:**
    *   `prompts`: "Se il contrasto è < 4.5:1, segna errore." (Istruzione per l'AI).
    *   `details`: "Implementazione algoritmi di accessibilità come da prompt." (Riassunto per l'Umano).
    *   *Eccezione:* Se l'azione è MANUALE (es. "Vai su Stripe Dashboard"), scrivila per esteso in `details`.

### Struttura del Prompt (Il "Context Injection")
Il prompt deve seguire questo schema a 3 parti per essere efficace:
1.  **SYSTEM ROLE:** Chi è l'AI? (es. "Sei un Senior React Engineer").
2.  **CONTEXT & LOGIC RULES:** Il blocco più importante. Copia qui le regole di business, i limiti, i calcoli dei prezzi. L'AI non ha memoria delle fasi precedenti se non gliela dai tu.
3.  **TASK:** L'ordine esecutivo (es. "Scrivi il codice per...").

---

## 5. Esempio Pratico: Creazione della Fase "Stripe"

Vogliamo replicare la Fase 8 (Pagamenti). Ecco come ragionare:

1.  **Titolo:** "Infra: Stripe & Subscription".
2.  **Costo:** Calcolo che il margine medio è alto. Scrivo: `DEV: ~3% Fee | USER: €7 - €250`.
3.  **Tools:** `["Stripe API", "Supabase Edge Functions"]`.
4.  **Prompt Construction (Cruciale):**
    *   Devo dire all'AI *esattamente* quanto costano i piani, altrimenti scriverà codice generico.
    *   *Inserisco nel Prompt:* "1 WEEK: €7 (20 Prompts)... 1 YEAR: €250".
    *   *Inserisco nel Prompt:* "Gestisci il webhook `checkout.session.completed`".
5.  **Details:** Scrivo solo "Integrazione Flusso Pagamenti e Webhook con i nuovi Tier." (Perché i dettagli dei tier sono già nel prompt).

---

## 6. Checklist per Replicare

Quando inizi un nuovo progetto:
1.  Copia il file `MasterPlanView.tsx`.
2.  Svuota l'array `MASTER_PLAN`.
3.  Definisci la Fase 0 (Setup) con le "Regole d'Oro" del nuovo progetto.
4.  Elenca le Feature e assegna un ID progressivo.
5.  Per ogni feature, calcola il costo API stimato e il prezzo utente.
6.  Scrivi il prompt includendo le regole di business specifiche.
7.  Raggruppa le fasi usando la proprietà `section` quando cambia l'ambito (es. da Frontend a Backend).
