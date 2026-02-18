
import { PlanPhase } from '../types';

export const phase13: PlanPhase = { 
  id: 13, 
  title: "Admin Hub: Backend & Integration", 
  desc: "DB Schemas, Security Logs & Plugin Link.",
  tools: ["Supabase", "Edge Functions", "Postgres"],
  cost: "DEV: €0.05 | USER: N/A",
  details: "Specifiche tecniche definitive per il Backend (Antigravity). Definisce le tabelle, le policy di sicurezza e i protocolli di comunicazione tra il Plugin Figma e la Dashboard Admin appena completata.",
  prompts: [
    "SYSTEM ROLE: Senior Backend Architect & Database Engineer.",
    "*** 1. DATABASE SCHEMA (SUPABASE PUBLIC) ***",
    "Crea le seguenti tabelle per supportare la UI di AdminView.tsx:",
    
    "TABLE public.users (Estende auth.users):",
    "- id: uuid (PK, FK auth.users.id)",
    "- email: text",
    "- name: text",
    "- country: text (ISO code o nome completo)",
    "- status: enum ('ACTIVE', 'BLOCKED') DEFAULT 'ACTIVE'",
    "- subscription_tier: enum ('FREE', 'PRO_MONTHLY', 'PRO_ANNUAL') DEFAULT 'FREE'",
    "- credits_remaining: int DEFAULT 10",
    "- total_spent_eur: decimal DEFAULT 0.00",
    "- joined_at: timestamp DEFAULT now()",
    "- last_active_at: timestamp",

    "TABLE public.user_feedback (Per Tab 'Requests'):",
    "- id: uuid (PK) DEFAULT gen_random_uuid()",
    "- user_id: uuid (FK public.users.id)",
    "- type: enum ('BUG', 'FEATURE', 'GENERAL', 'FALSE_POS', 'BAD_FIX')",
    "- status: enum ('OPEN', 'IN_PROGRESS', 'DONE') DEFAULT 'OPEN'",
    "- message: text",
    "- screenshots: jsonb (Struttura: { 'before': url, 'after': url })",
    "- assigned_to: uuid (FK public.admins.id, nullable)",
    "- assigned_at: timestamp",
    "- completed_by: uuid (FK public.admins.id, nullable)",
    "- completed_at: timestamp",
    "- last_action_note: text (Es. 'Reverted to TODO by Admin')",
    "- created_at: timestamp DEFAULT now()",

    "TABLE public.security_logs (Per Tab 'Security'):",
    "- id: uuid (PK) DEFAULT gen_random_uuid()",
    "- type: enum ('SUCCESS', 'FAILED', 'LOCKED', 'ATTACK', 'WARNING')",
    "- ip_address: inet",
    "- user_id: uuid (FK public.users.id, nullable - per login falliti)",
    "- message: text",
    "- metadata: jsonb (User Agent, Region)",
    "- timestamp: timestamp DEFAULT now()",

    "TABLE public.blocked_ips (Blacklist):",
    "- ip_address: inet (PK)",
    "- reason: text",
    "- blocked_by: uuid (FK public.admins.id)",
    "- blocked_at: timestamp DEFAULT now()",

    "TABLE public.admin_metrics (Per Tab 'Dashboard' Chart):",
    "- date: date (PK)",
    "- conversions: int DEFAULT 0",
    "- purchases: int DEFAULT 0",
    "- earnings_eur: decimal DEFAULT 0.00",
    "- growth_pct: decimal DEFAULT 0.00",

    "TABLE public.admins (Per Tab 'Settings'):",
    "- id: uuid (PK, FK auth.users.id)",
    "- email: text",
    "- role: enum ('SUPER', 'EDITOR')",
    "- added_at: timestamp DEFAULT now()",

    "*** 2. CONNECTION RULES (PLUGIN <-> ADMIN) ***",
    
    "A. USER BLOCKING (Kill Switch):",
    "- Middleware Plugin: Ad ogni avvio (`App.tsx`), il plugin deve interrogare `rpc/get_user_status`.",
    "- Logica: Se `status` == 'BLOCKED', il plugin mostra schermata rossa 'Account Suspended' e impedisce ogni azione.",
    "- Admin Action: Quando l'Admin clicca 'Block User' nella Dashboard, aggiorna `public.users.status`.",

    "B. SECURITY LOGGING (Sentinel):",
    "- Trigger Plugin: Inviare un log a `security_logs` quando:",
    "  1. Login fallito (Type: FAILED).",
    "  2. Rate limit superato > 50 req/min (Type: LOCKED).",
    "  3. Tentativo di injection nel prompt AI (Type: ATTACK).",
    "- Admin View: La tabella 'Security' deve mostrare questi log in tempo reale.",

    "C. FEEDBACK LOOP:",
    "- Plugin Action: Aggiungere nel menu 'Profile' un form 'Report Issue'.",
    "- Flow: Insert su `user_feedback`. Se `type` == 'BAD_FIX', allegare JSON del nodo corrotto.",
    "- Admin View: L'Admin vede la richiesta in 'TODO'. Se clicca 'Revert to In Progress', aggiorna il campo `last_action_note`.",

    "*** 3. RLS POLICIES (ROW LEVEL SECURITY) ***",
    "- `users`: SELECT (Own) per Authenticated. ALL per Admin.",
    "- `user_feedback`: INSERT (Own) per Authenticated. ALL per Admin.",
    "- `security_logs`: INSERT (Anon/Auth). SELECT (Admin Only).",
    "- `blocked_ips`: READ (Anon - per check middleware). WRITE (Admin Only).",
    "- `admin_metrics`: READ (Admin Only).",

    "TASK: Esegui le migrazioni SQL su Supabase e crea le Edge Functions per i trigger di sicurezza."
  ],
  section: "FUTURE DEVELOPMENT"
};
