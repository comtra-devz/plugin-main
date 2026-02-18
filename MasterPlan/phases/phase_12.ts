
import { PlanPhase } from '../types';

export const phase12: PlanPhase = { 
  id: 12, 
  title: "Ops: Monitoraggio", 
  desc: "Monitoraggio Margini, Alert Quote.",
  tools: ["Stripe Analytics"],
  cost: "DEV: Time | USER: N/A",
  details: "MANUAL ACTION: Configura le dashboard su Stripe per monitorare il margine e imposta gli alert email per le quote API.",
  prompts: [
    "SYSTEM ROLE: Operations Manager.",
    "*** CONTEXT & LOGIC RULES (DA IMPLEMENTARE) ***\nMonitora il rapporto tra il costo delle API Anthropic e i ricavi di Stripe. Alert di Quota: Notifica email quando l'utente raggiunge l'80% dei prompt.",
    "TASK: Configura dashboard di monitoraggio e alert email."
  ],
  section: "INFRASTRUCTURE & OPERATIONS"
};
