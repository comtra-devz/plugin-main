
import { PlanPhase } from '../types';

export const phase7: PlanPhase = { 
  id: 7, 
  title: "Infra: Auth & Accesso", 
  desc: "Figma OAuth2, RLS Policies.",
  tools: ["Figma Dev Portal", "Supabase"],
  cost: "DEV: €0 | USER: FREE",
  details: "Configurazione Provider OAuth e Sicurezza DB.",
  prompts: [
    "SYSTEM ROLE: Security Engineer.",
    "*** CONTEXT & LOGIC RULES (DA IMPLEMENTARE) ***\nRegistra l'app su Figma per ottenere Client ID/Secret. Flusso: L'utente clicca 'Accedi con Figma' -> Antigravity scambia il codice con l'access_token.",
    "TASK: Configura Supabase Auth e le Row Level Security (RLS) policies."
  ],
  section: "INFRASTRUCTURE & OPERATIONS"
};
