
import { PlanPhase } from '../types';

export const phase17: PlanPhase = {
  id: 17,
  title: "Security: Hardening & Protection",
  desc: "Rate Limiting, SQL Injection, CSP.",
  tools: ["Supabase", "Cloudflare"],
  cost: "DEV: €0.02 | USER: N/A",
  details: "Implementazione di layer di sicurezza avanzati per proteggere l'infrastruttura e i dati utente. Integrazione con Admin Security Hub.",
  prompts: [
    "SYSTEM ROLE: Security Engineer & DevOps.",
    "*** SECURITY PROTOCOLS (DA IMPLEMENTARE) ***\n1. RATE LIMITING:\n- Configurare un limite di richieste sulle Edge Functions per prevenire attacchi DDoS (es. 60 req/min per IP).\n- Utilizzare middleware Supabase o Cloudflare se disponibile.\n\n2. SQL INJECTION PREVENTION:\n- Utilizzare SEMPRE query parametrizzate o l'ORM di Supabase (postgrest-js).\n- Mai concatenare stringhe SQL grezze.\n- Validare rigorosamente tutti gli input utente lato server.\n\n3. CONTENT SECURITY POLICY (CSP):\n- Definire header CSP rigorosi per l'app Vercel.\n- Consentire solo domini fidati (api.figma.com, api.stripe.com, etc.).\n- Bloccare script inline non necessari.\n\n4. PENETRATION TESTING:\n- Eseguire test periodici sulle vulnerabilità comuni (OWASP Top 10).\n- Verificare la sicurezza dei token di autenticazione e delle sessioni.\n\n5. DATA SANITIZATION:\n- Assicurarsi che tutti i dati in uscita verso il client siano puliti da informazioni sensibili o tecniche inutili.\n- Implementare strict validation sugli input JSON provenienti dal plugin Figma.\n\n6. ADMIN SECURITY INTEGRATION:\n- Collegare tutti i log di sicurezza (tentativi falliti, IP bloccati, attacchi SQL) alla tabella `security_logs`.\n- Questi dati devono essere visualizzabili in tempo reale nella tab 'SECURITY' della Admin View (vedi Fase 13).",
    "TASK: Implementare le misure di hardening e configurare i controlli di sicurezza."
  ],
  section: "INFRASTRUCTURE & OPERATIONS"
};
