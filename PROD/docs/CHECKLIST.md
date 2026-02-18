
# Antigravity Launch Checklist

## 0. Design Standards & Philosophy (FOUNDATION)
*Regole definite in `PROD/docs/design_standards_guide.md`*
- [ ] **Component Contract Validator**: Verificare che l'audit controlli (Variants, Tokens, Responsive, Code Map, A11y) per ogni master component.
- [ ] **Token Governance**: Verificare distinzione tra Token Primitivi e Semantici.
- [ ] **Aggregation Logic (New)**:
    - [ ] Creare 5 rettangoli con lo stesso colore Hex hardcoded.
    - [ ] Lanciare Audit.
    - [ ] Verificare che appaia **UNA sola card** "Hardcoded Hex (x5)".
    - [ ] Verificare che il navigatore "Layer 1 of 5" funzioni e selezioni i rettangoli in sequenza.
    - [ ] Verificare che "Auto-Fix" corregga tutti e 5 i rettangoli in un colpo solo.

## 1. Advanced Audit Engines (Comprehensive Matrix)
- [ ] **Visual & Tokens**:
    - [ ] **Hardcoded Hex**: Rilevamento colori non variabili.
    - [ ] **Unknown Font**: Rilevamento font non di sistema.
    - [ ] **Detached Styles**: Rilevamento stili slegati.
- [ ] **Content & Tone**:
    - [ ] **Inconsistent Tone**: Testare con una frase formale e una slang nella stessa pagina.
    - [ ] **Lorem Ipsum**: Rilevare testo placeholder dimenticato.
    - [ ] **Localization Risk**: Container di testo fissi.
- [ ] **Structure & Naming**:
    - [ ] **Generic Naming**: Rilevare "Frame 1", "Group 2".
    - [ ] **DOM Hygiene**: Nesting eccessivo (>6 livelli).
- [ ] **Heuristic & UX**:
    - [ ] **Broken Links**: Prototype link nulli.
    - [ ] **Error Prevention**: Mancanza conferme su azioni distruttive.

## 2. Core & Logic
- [ ] **Smart Routing**: Verificare che due CTA identiche con destinazioni diverse generino rotte diverse.
- [ ] **Hash Check**: Verificare che una seconda scansione dello stesso nodo non chiami l'API AI (Costo Zero).
- [ ] **Design System Context**: Verificare selezione DS (Material, Custom) e adattamento regole.
- [ ] **Asset Registry Protocol (Soluzione 1)**:
    - [ ] Verificare che nodi `VECTOR` o `IMAGE` non vengano convertiti in SVG inline pesanti.
    - [ ] Output Code atteso: `<Asset name="layer-name" />` o componente segnaposto.
    - [ ] Verificare che il sync successivo NON sovrascriva il file fisico nella repo del dev.
- [ ] **Deep Sync Integrations**:
    - [ ] **GitHub**: Check push su branch dedicato.
    - [ ] **Bitbucket**: Check auth flow e repo listing.

## 3. Auth & User
- [ ] **Figma OAuth**: Login funzionante, token salvato in Supabase `users`.
- [ ] **Sessione**: Il refresh del token funziona senza logout forzato.

## 4. Monetizzazione (Stripe)
- [ ] **Webhook**: Il pagamento di €99 (6 mesi) aggiorna `prompts_limit` a 800.
- [ ] **Blocco**: L'utente con 0 crediti non può generare codice (ma può vedere l'audit base).

## 5. AI & Performance
- [ ] **Discovery**: La modale "Nuovo Componente Trovato" appare su pattern ripetuti.
- [ ] **Latency**: L'audit base impiega < 5 secondi.

## 6. Operations & Legal
- [ ] **Privacy**: Policy aggiornata con dettagli su Data Retention e AI processing.
- [ ] **Cookie**: Banner consenso attivo.
- [ ] **Disclaimer**: Testo chiaro sui limiti di prompt.

## 7. Missing Technical Specs & Backend Implementation
- [ ] **Bitbucket Integration Specs (Missing in Masterplan)**:
    - [ ] Definire architettura OAuth 2.0 per Bitbucket Cloud (Client ID/Secret flow).
    - [ ] Specificare endpoint API per il recupero della struttura repo e dei file source.
    - [ ] Aggiungere Bitbucket al modello dati `users` (colonne token/refresh).
- [ ] **Backend Implementation Details (Edge Functions)**:
    - [ ] **Storybook Connect**: Sviluppare funzione per validazione URL e handshake iniziale.
    - [ ] **Repo Auth**: Implementare endpoint `/auth/github` e `/auth/bitbucket` (scambio token server-side sicuro).
    - [ ] **Diffing Engine**: Creare logica backend per confrontare JSON Figma vs Componenti Remote (Drift Calculation).
    - [ ] **Webhooks**: Gestire eventi di disconnessione o revoca accesso dai provider.
