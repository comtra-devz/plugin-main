
import { PlanPhase } from '../types';

export const phase4: PlanPhase = { 
  id: 4, 
  title: "FEAT: DEEP SYNC & BACKEND SPECS", 
  desc: "Integrazione API (GitHub/Bitbucket/Storybook) e specifiche Backend.",
  tools: ["GitHub API", "Bitbucket API", "Storybook API", "Edge Functions"],
  cost: "DEV: €0.06 | USER: 2 Credits (~€0.50)",
  details: "Strategia di polling, integrazione API esterne e implementazione specifiche tecniche mancanti (Checklist Item 7).",
  prompts: [
    "SYSTEM ROLE: DevOps & Integration Specialist.",
    "*** CONTEXT & LOGIC RULES (DA IMPLEMENTARE) ***\n1. POLLING STRATEGY: Backend controlla le API di Storybook ogni 15 min per cambiamenti.\n2. MANUAL SYNC (Cooldown): L'utente può forzare il sync ogni 2 min (Timer in UI). Costo -2 crediti se Pro annuale non attivo.\n3. GITHUB/BITBUCKET PUSH: Genera PR con il codice React aggiornato. Richiede 'repo_scope' nel token OAuth.",
    "*** BITBUCKET INTEGRATION SPECS (FROM CHECKLIST) ***\n1. ARCHITETTURA OAUTH 2.0: Implementare flow Client ID/Secret per Bitbucket Cloud.\n2. API ENDPOINTS: Creare endpoint per recupero struttura repository e lettura source file.\n3. DATA MODEL: Aggiornare tabella `users` con colonne `bitbucket_token`, `bitbucket_refresh_token`.",
    "*** BACKEND IMPLEMENTATION DETAILS (EDGE FUNCTIONS) ***\n1. STORYBOOK CONNECT: Sviluppare funzione per validazione URL e handshake iniziale.\n2. REPO AUTH: Implementare endpoint `/auth/github` e `/auth/bitbucket` (scambio token server-side sicuro).\n3. DIFFING ENGINE: Creare logica backend per confrontare JSON Figma vs Componenti Remote (Drift Calculation).\n4. WEBHOOKS: Gestire eventi di disconnessione o revoca accesso dai provider.",
    "*** STARK INTELLIGENCE INTEGRATION (A11y Code Scanning) ***\n1. ANALISI COMPETITOR: Studiare la logica di 'Source Code Scanning' di Stark (getstark.co). Loro scansionano le repo per trovare violazioni ARIA.\n2. INTEGRAZIONE COMTRA: Quando Comtra esegue il 'Push to GitHub', non deve solo scrivere codice, ma auto-commentare la PR con un report di accessibilità pre-calcolato dall'AI (es. 'Ho aggiunto aria-label su questo bottone icona').\n3. GOAL: Rendere Comtra l'unico tool che *genera* codice già compliant, invece di correggerlo dopo.",
    "TASK: Implementa la logica di confronto (Diffing) tra il JSON locale e la risposta API remota, integrando le specifiche backend mancanti e il modulo di A11y scanning.",
    "*** CONNESSIONI E AUTENTICAZIONI (4. Connessioni) ***\n\n4.1 Storybook\n- Inserire URL Storybook + Token API\n- Selezionare se generare automaticamente stories per token e componenti\n- Scegliere cartella di destinazione (es. /src/stories/components/)\n\n4.2 GitHub / Bitbucket\n- Login OAuth o Personal Access Token\n- Selezionare repository e branch\n- Abilitare commit automatici o push manuali\n- Possibilità di scegliere cartelle target per codice generato\n\n*** SINCRONIZZAZIONE (6. Sincronizzazione) ***\n- Possibilità di sincronizzare in tempo reale con Storybook, GitHub e Bitbucket\n- Aggiornamenti incrementali\n- Mapping automatico tra token Figma e componenti code-ready\n- Logging per ogni sincronizzazione\n\n*** AUTOMAZIONE STORIES (7. Generazione automatica di Stories) ***\n- Stories generate per ogni tipo di token:\n  - Palette colori\n  - Tipografia\n  - Spacing\n  - Border-radius\n  - Themes\n- Notes su accessibilità integrate\n- Responsive design incluso\n- Possibilità di collegamento automatico tra componenti (AI Kimi K2.5)\n- Struttura file ordinata per una navigazione semplice"
  ],
  section: "CORE FEATURES & LOGIC"
};
