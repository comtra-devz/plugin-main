# PROGETTO: DESIGN SYSTEM AI OS (Comtra/Antigravity)

Introduzione: Questo plugin trasforma Figma in un motore di produzione automatizzato. Non controlla solo i pixel, ma "capisce" la logica del design, genera schermate coerenti al design system esistente ed esporta codice, eliminando il lavoro manuale.

---

## FASE 0: ANALISI FRONTEND & SETUP
**Tool: Google AI Studio**
- Analisi completa del frontend generato per comprendere features e caratteristiche.
- **Regola Aurea**: Segui esattamente le classi CSS della piattaforma esistente. Non introdurre nuove convenzioni se non strettamente necessario.

---

## 🏗️ FASE 1: DOCUMENTAZIONE & PROMPTING
**Tool: Antigravity.ai**

### Sviluppo Prompt di Sistema (System Instructions)
Creare documentazione per istruire Claude 3.5 Sonnet / Gemini:
1.  **Ruolo**: Senior Design Engineer & UX Auditor.
2.  **HTML Semantico**: Uso rigoroso di `<nav>`, `<main>`, `<header>`.
3.  **Accessibilità**: Implementazione obbligatoria di `:focus-visible`.
4.  **Smart Routing**: Analisi dei `transitionNodeID` di Figma. Se due bottoni hanno lo stesso testo ma destinazioni diverse -> generare rotte diverse.
5.  **Naming Convention**: Schema `ds-[categoria]-[elemento]-[stato]`.
6.  **Discovery**: Segnalazione proattiva di pattern non censiti nel DS.

---

## 🔗 FASE 2: SVILUPPO BACKEND E LOGICA OPERATIVA
**Tool: Antigravity.ai (Supabase Edge Functions)**

### 2.1 Integrazione Health Score
*   **Token Coverage**: `(Nodi con Variabili / Nodi Totali) * 100`. Penalità per HEX/Pixel fissi.
*   **Accessibility**: Analisi Vision (contrasto < 4.5:1, testo < 16px).
*   **Structural Integrity**: Verifica coerenza Tag vs Ruolo (es. Button vs Rectangle).
*   **UX Logic**: Analisi link orfani o CTA senza destinazione.

### 2.2 Gestione Documentazione
Importazione della documentazione di progetto nel contesto (RAG) per istruire il sistema su regole specifiche del brand.

---

## 🎨 FASE 3: DESIGN-TO-CODE & COMPONENT DISCOVERY
**Tool: Google AI Studio & Antigravity.ai**

### 3.1 Prompt Generazione Schermate
"Agisci come Senior React Developer. Trasforma il JSON di Figma in React + Tailwind. Se il nodo ha un destinationId, implementa il routing appropriato. Se il pattern è nuovo, segnalalo."

### 3.2 Component Discovery & CTA Dinamica
*   **Azione**: Se l'AI rileva un nuovo pattern ripetuto, Antigravity propone: "Vuoi renderlo un componente?".
*   **CTA**: All'approvazione, Antigravity crea il Master Component su Figma. Il plugin zooma sull'elemento creato.

---

## 🛠️ FASE 4: SOSTENIBILITÀ E RISPARMIO COSTI
**Tool: Antigravity.ai**

### 4.1 Scanning Differenziale (Hash Check)
*   **Logica**: Prima di chiamare l'AI, confronta l'ID del componente e l'Hash dei dati con l'ultimo scan.
*   **Risultato**: Se invariato, recupera il report dal database. **Costo API: Zero.**

### 4.2 Orchestrazione Modelli
*   **Claude 3.5 Haiku / Gemini Flash**: Per Naming Audit, SEO e controlli testuali (Economico).
*   **Claude 3.5 Sonnet / Gemini Pro**: Solo per Vision, Generazione Codice complesso e Deep Sync.

### 4.3 Prompt Caching
Mantenere il manuale del DS nella cache per ridurre i token di input ripetitivi.

---

## 🔑 FASE 5: AUTENTICAZIONE E ACCESSO
**Tool: Figma Developer Portal & Supabase**

*   **OAuth2 Setup**: Registrazione app su Figma (Client ID/Secret).
*   **Flusso**: Click "Accedi con Figma" -> Redirect Browser -> Scambio Codice/Token -> Ritorno al Plugin.
*   **Permessi**: Lettura file (`file_read`) necessaria per Deep Sync.

---

## 💰 FASE 6: MONETIZZAZIONE (QUOTA-BASED)
**Tool: Stripe & Antigravity DB**

### Configurazione Piani
*   **1 WEEK**: €7 (20 Prompts) - *Trial*
*   **1 MONTH**: €25 (100 Prompts/mo) - *Freelance*
*   **6 MONTHS**: €99 (800 Prompts) - *Recommended / Pro*
*   **1 YEAR**: €250 (Unlimited) - *Agency*

### Logica Operativa
*   Ogni azione AI scala il `prompt_balance` nel DB `users`.
*   Implementare "Top-up" (Ricarica singola) se il limite è raggiunto.

---

## 🛠️ FASE 7: CREAZIONE E HOSTING PLUGIN
**Tool: Figma Desktop & VS Code**

*   **manifest.json**: Whitelist dominio Antigravity (`allowedDomains`).
*   **ui.html**: Iframe che punta alla dashboard React ospitata.
*   **controller.ts**: Gestione sandbox Figma, invio selezione via `postMessage`.

---

## 🚀 FASE 8: FEATURE "PROTOTYPE-TO-CODE"
**Tool: Antigravity.ai + GitHub API**

*   **Smart Routing**: Risoluzione conflitti di navigazione basata su ID nodi Figma.
*   **Push**: Antigravity riceve il codice -> Crea Branch/PR su GitHub con `.tsx`, `.css` e router aggiornato.

---

## 🛡️ FASE 9: GOVERNANCE E TRAINING CONTINUO
**Tool: Database & Fine-tuning**

### 9.1 Pattern Approval Memory
*   **Azione**: Designer accetta un suggerimento o marca un errore come "Ignora".
*   **Logica**: Salvare l'eccezione nel DB. Inserirla come esempio "Few-Shot" nei prompt futuri.
*   **Risultato**: L'AI smette di segnalare falsi positivi.

### 9.2 Versionamento Token
*   Tracciamento versioni `design-tokens.json`. Se cambiano, l'AI suggerisce un refactor del codice esistente.

---

## 🚀 FASE 10: DEPLOYMENT E PUBBLICAZIONE
**Tool: Figma Community & Vercel**

### 10.1 Hosting Dashboard
*   Deploy su Vercel/Netlify (HTTPS obbligatorio).
*   Sync URL produzione nel `manifest.json`.

### 10.2 Review Figma Community
*   Asset grafici: Icona (128x128), Cover (1920x960).
*   **Disclaimer**: Specificare chiaramente i limiti di prompt nella descrizione per trasparenza.

---

## 📈 FASE 11: MONITORAGGIO COSTI (OPERATIONS)
**Tool: Stripe Analytics & Dashboard Interna**

*   **Analisi Margine**: Monitorare rapporto Costo API / Ricavi Stripe.
*   **Ottimizzazione**: Se il margine scende, spostare più task su modelli "Haiku/Flash".
*   **Alert**: Notifica email all'utente all'80% della quota prompt consumata.
