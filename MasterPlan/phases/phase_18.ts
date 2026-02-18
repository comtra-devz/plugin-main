
import { PlanPhase } from '../types';

export const phase18: PlanPhase = {
  id: 18,
  title: "Admin Mode & Security Protocols",
  desc: "IP Blocking, Advanced Filters, User Mgmt.",
  tools: ["React State", "Supabase Edge Functions"],
  cost: "DEV: €0.05 | USER: N/A",
  details: "Implementazione logica di blocco IP dopo 3 tentativi falliti e gestione avanzata utenti.",
  prompts: [
    "SYSTEM ROLE: Security Architect & Frontend Lead.",
    "*** ADMIN SECURITY RULES ***\n1. IP BLOCKING STRATEGY:\n- Counter locale/sessione per tentativi di login falliti.\n- Al 3° tentativo errato -> Stato 'LOCKED'.\n- L'IP viene bannato (simulazione UI: mostra messaggio blocco e disabilita input).\n- Sblocco: Solo un Super Admin può sbloccare l'IP dalla tab 'SECURITY'.\n\n2. USER MANAGEMENT SECURITY:\n- Delete Data Action: Richiede conferma esplicita tramite digitazione parola chiave 'delete'.\n- Remove Admin: Popup di conferma obbligatorio.\n\n3. DATA VISIBILITY & FILTERING:\n- Tabelle Admin: Testi rigorosamente neri (#000) per leggibilità.\n- Security Tab: Filtri per range di date (Dal/Al) con selettore mese/anno.\n- Request Tab: Suddivisione per Status (To Do, In Progress, Completed). Completed mostra timestamp e autore.\n- Overview: Dropdown per filtrare KPI per Nazione.",
    "TASK: Aggiornare AdminView.tsx con i nuovi protocolli di sicurezza e miglioramenti UI."
  ],
  section: "INFRASTRUCTURE & OPERATIONS"
};
