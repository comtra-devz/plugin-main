# Documentazione Comtra

Indice principale della documentazione del progetto.

## Struttura consigliata

- **Panoramica prodotto**: `README.md` (root)
- **Plugin (funzioni e sezioni)**: `docs/plugin/README.md`
- **Admin Dashboard**: `docs/admin/README.md`
- **Operatività / troubleshooting**: `docs/ops/README.md`
- **Archivio storico/proposte**: `docs/archive/README.md`
- **Spec audit (fonte di verità regole)**: `audit-specs/README.md`
- **Backend auth setup**: `auth-deploy/SETUP.md`

## Regola di sicurezza (importante)

Prima di rinominare/spostare `.md`, verificare path letti da codice:

- `admin-dashboard/lib/plugin-doc-snapshot.mjs` usa path fissi in `DEFAULT_DOC_RELATIVE_PATHS`
- script CI/ops: `scripts/notify-discord.mjs` e script admin vari
- riferimenti inter-doc in `docs/**/*.md`, `audit-specs/**/*.md`, `admin-dashboard/**/*.md`

Per questo motivo questa ottimizzazione è **non distruttiva**: introduciamo indici per area, senza rompere i percorsi esistenti.

## Accesso rapido (legacy ma attuale)

### Core plugin

- OAuth: `docs/OAUTH-FIGMA.md`
- Generate: `docs/GENERATE-TAB-SPEC.md`
- Generate design intelligence playbook: `docs/GENERATE-DESIGN-INTELLIGENCE-PLAYBOOK.md`
- Generate conversational UX implementation plan: `docs/GENERATE-CONVERSATIONAL-UX-IMPLEMENTATION-PLAN.md`
- **Generation Engine roadmap (Problem 1 + Swarm):** `docs/GENERATION-ENGINE-ROADMAP.md`
- Sync: `docs/SYNC-INVESTIGATION.md`
- Gamification: `docs/GAMIFICATION.md`
- Trophies: `docs/TROPHIES.md`
- Support tickets: `docs/SUPPORT-TICKETS-VERIFICATION.md`

### Costi e crediti

- Overview DS: `docs/COST-ESTIMATE-DS-AUDIT.md`
- A11Y: `docs/COST-ESTIMATE-A11Y.md`
- UX: `docs/COST-ESTIMATE-UX-AUDIT.md`
- Prototype: `docs/COST-ESTIMATE-PROTOTYPE-AUDIT.md`
- Crediti troubleshooting: `docs/TROUBLESHOOTING-CREDITS.md`

### Audit specs

- Hub: `audit-specs/README.md`
- DS: `audit-specs/ds-audit/README.md`
- A11Y: `audit-specs/a11y-audit/README.md`
- UX: `audit-specs/ux-logic-audit/README.md`
- Prototype: `audit-specs/prototype-audit/README.md`

### Admin dashboard

- Admin app overview: `admin-dashboard/README.md`
- Auth setup: `admin-dashboard/docs/ADMIN-AUTH-SETUP.md`
- Product sources (pipeline): `admin-dashboard/docs/NOTION-PRODUCT-SOURCES.md`

### Backend auth

- Deploy/setup: `auth-deploy/SETUP.md`
- Prompts: `auth-deploy/prompts/README.md`
- Parked endpoints: `auth-deploy/parked-endpoints/README.md`
