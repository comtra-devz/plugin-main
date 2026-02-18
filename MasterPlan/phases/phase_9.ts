
import { PlanPhase } from '../types';

export const phase9: PlanPhase = { 
  id: 9, 
  title: "Ops: Plugin Hosting", 
  desc: "Manifest, Controller Sandbox, Iframe React.",
  tools: ["Figma Desktop", "VS Code"],
  cost: "DEV: €0 | USER: N/A",
  details: "MANUAL ACTION: Configura il file manifest.json locale per includere l'URL di produzione in `allowedDomains` e imposta il `ui.html` come entry point.",
  prompts: [
    "SYSTEM ROLE: Figma Plugin Developer.",
    "*** CONTEXT & LOGIC RULES (DA IMPLEMENTARE) ***\nmanifest.json: Inserisci l'URL di Antigravity nei allowedDomains. ui.html: Iframe che punta alla dashboard su Antigravity.",
    "*** SAFETY LAYERS (OPERATIONAL ROBUSTNESS) ***\n1. SANDBOX VALIDATION (Anti-Crash Layer)\n- Problema: L'AI può allucinare font (es. 'Helvetica Neue Pro') o variabili ID inesistenti. `figma.loadFontAsync` su font inesistenti crasha il plugin.\n- Regola: Prima di eseguire QUALSIASI modifica, il Controller DEVE validare l'output contro la realtà fisica.\n  • Font: Check `figma.listAvailableFontsAsync()`. Se non esiste -> Fallback 'Inter'/'Arial'.\n  • Variabili: Check ID esistenza. Se non esiste -> Fallback HEX grezzo + Warning 'Token Detached'.\n\n2. KILL SIGNAL (Abort Controller)\n- Problema: Utente chiude plugin mentre l'AI genera (costo alto). Il backend continua a pagare.\n- Regola: Implementare `AbortController` bidirezionale.\n  • Frontend: `onClose` o 'Cancel' -> Invia segnale `abort`.\n  • Backend: Interrompere immediatamente lo stream LLM.",
    "TASK: Configura il file manifest.json e l'architettura di hosting con i nuovi safety layers."
  ],
  section: "INFRASTRUCTURE & OPERATIONS"
};
