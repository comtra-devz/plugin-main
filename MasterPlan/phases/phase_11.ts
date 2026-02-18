
import { PlanPhase } from '../types';

export const phase11: PlanPhase = { 
  id: 11, 
  title: "Ops: Legal & Deployment", 
  desc: "T&C, Cookies, Vercel, Figma Community.",
  tools: ["Vercel", "Legal Templates"],
  cost: "DEV: €0 (Hobby) | USER: N/A",
  details: "MANUAL ACTION: Esegui il build di produzione su Vercel. Prepara i documenti legali.",
  prompts: [
    "SYSTEM ROLE: Release Manager & Compliance Officer.",
    "*** CONTEXT & LOGIC RULES (DA IMPLEMENTARE) ***\n1. LEGAL DOCS: Genera pagine per 'Privacy Policy' e 'Terms & Conditions'.\n   - Includi clausola sul caching dei dati di Audit (1 ora di retention).\n   - Includi clausola sui Cookie tecnici necessari al funzionamento.\n2. DOMINIO: Collega il progetto a un dominio custom HTTPS stabile.\n3. COOKIE BANNER: Implementa banner di consenso semplice (Solo tecnici/funzionali).",
    "TASK: Prepara la build di produzione, i documenti legali e gli asset grafici per il listing."
  ],
  section: "INFRASTRUCTURE & OPERATIONS"
};
