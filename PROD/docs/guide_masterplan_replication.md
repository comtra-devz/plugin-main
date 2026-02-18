# Guida alla Creazione del "Master Plan Checklist"

Questa guida spiega come replicare l'architettura della checklist "Master Plan" (presente in `MasterPlanView.tsx`) per gestire progetti complessi guidati dall'AI.

Il Master Plan non è una semplice To-Do list, ma un **Sistema di Iniezione di Contesto**. Serve a trasferire la memoria del progetto e le regole di business all'AI esecutiva.

---

## 1. Struttura Dati (Il Cuore del Sistema)

Ogni fase del progetto è un oggetto JSON rigoroso. Copia questa interfaccia TypeScript nel tuo progetto:

```typescript
interface PlanPhase {
  id: number;          // Ordine sequenziale (0, 1, 2...)
  section?: string;    // (Opzionale) Crea un Header visivo (es. "INFRASTRUCTURE")
  title: string;       // Titolo breve della Feature (es. "FEAT: AUDIT SUITE")
  desc: string;        // Sottotitolo visibile a card chiusa
  tools: string[];     // Stack tecnologico (es. ["Supabase", "Gemini Pro"])
  cost: string;        // Analisi Margini (Cruciale per la sostenibilità)
  details: string;     // Testo per l'UMANO (Spiegazione funzionale)
  prompts: string[];   // Testo per l'AI (System Prompt + Regole)
}
```

---

## 2. Definizione dei Costi (Economy Design)

Per ogni feature, devi calcolare il rapporto Costo/Ricavo. Questo educa il team e il cliente.

*   **Formato**: `DEV: [Costo API Stimato] | USER: [Prezzo/Crediti]`
*   **Esempio Fix Singolo**: `DEV: €0.002 | USER: 2 Credits` (Alto Margine)
*   **Esempio Fix All**: `DEV: €0.05 | USER: 2 Credits * N Issues` (Scalabile)

---

## 3. Ingegneria del Prompt (Context Injection)

Il campo `prompts` è il più importante. Non scrivere "Fai l'audit". Scrivi le regole esatte che l'AI deve applicare.

Struttura il prompt in 3 blocchi:

### A. SYSTEM ROLE
Definisci chi è l'AI.
> "SYSTEM ROLE: Senior UX Designer & Prototype Specialist."

### B. CONTEXT & LOGIC RULES (Il Business)
Qui inserisci la logica applicativa.
*   **Esempio Flusso Prototype:** "Se siamo nel tab 'PROTOTYPE' e l'issue è 'Missing Wireframe', il bottone di azione NON deve fixare in loco, ma deve reindirizzare alla vista GENERATE."
*   **Esempio Costi:** "Ogni azione 'Auto-Fix' deve mostrare visivamente l'etichetta '-2 Credits' nel bottone."
*   **Esempio Prompt Pre-fill:** "Il redirect deve iniettare il prompt: 'Create a confirmation wireframe...'."

### C. TASK
Il comando finale.
> "TASK: Genera il codice React per la vista Audit implementando queste regole di redirect e calcolo costi."

---

## 4. Categorizzazione delle Fasi

Dividi il piano in 4 sezioni logiche per chiarezza mentale:

1.  **PREPARATION & SETUP**: Database, Auth, Regole Globali (es. "Usa sempre Tailwind").
2.  **CORE FEATURES**: Le funzionalità prodotto (Audit, Generate, Code).
3.  **INFRASTRUCTURE**: Pagamenti (Stripe), Backend, Sicurezza.
4.  **OPERATIONS**: Deployment, Monitoraggio, Listing sugli Store.

---

## 5. Esempio Pratico: Replicare la feature "Audit Fix"

Ecco come scriveresti l'oggetto JSON per la richiesta odierna:

```json
{
  "id": 3,
  "section": "CORE LOGIC",
  "title": "FEAT: PRO AUDIT ACTIONS",
  "desc": "Auto-Fix All & Cross-View Redirects.",
  "tools": ["React State", "Navigation Handler"],
  "cost": "DEV: €0 | USER: 2 Credits/Fix",
  "details": "Implementazione del bottone 'Fix All' e del redirect da Prototype a Generate.",
  "prompts": [
    "SYSTEM ROLE: Senior Frontend Engineer.",
    "*** BUSINESS RULES ***",
    "1. FIX ALL: Solo per utenti PRO. Itera su tutte le issue visibili. Costo totale = Issue Count * 2. Esegui fix in batch.",
    "2. VISUAL FEEDBACK: Ogni bottone di azione deve mostrare il costo (es. '-2 Credits').",
    "3. SPECIAL REDIRECT: L'issue 'Missing Wireframe' (ID p2) cambia il testo del bottone in 'Create Wireframe'. Al click, porta l'utente a 'Generate' con un prompt pre-compilato.",
    "TASK: Aggiorna Audit.tsx e App.tsx per supportare la navigazione con passaggio di parametri."
  ]
}
```

## 6. Checklist Finale per la Replica

1.  Crea il file `MasterPlanView.tsx`.
2.  Copia lo stile `BRUTAL` e i colori.
3.  Definisci l'array `MASTER_PLAN`.
4.  Compila le fasi usando la logica **System -> Context -> Task**.
5.  Usa questo file come "Single Source of Truth" per lo sviluppo. Se una regola cambia, aggiornala qui prima di scrivere codice.
