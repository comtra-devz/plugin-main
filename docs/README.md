# Documentazione Comtra

Indice della documentazione del progetto (file `.md`) per orientarsi rapidamente.

---

## Panoramica e setup

| File | Contenuto |
|------|-----------|
| **README.md** (root) | Descrizione del plugin, flusso UI, tab Audit/Generate/Code/Stats, gamification. |
| **auth-deploy/SETUP.md** | Setup backend (Vercel, DB, env, deploy). |
| **docs/OAUTH-FIGMA.md** | OAuth Figma: flusso, redirect, scope, sviluppo locale. |

---

## Agenti Kimi e pipeline

| File | Contenuto |
|------|-----------|
| **docs/ACTION-PLAN-KIMI-AGENTS.md** | Piano d’azione completo: Fase 0 (setup), Fasi 1–6 per DS Audit, A11Y, UX, Prototype, Code, Generate. |
| **docs/AUDIT-PIPELINE-AND-KNOWLEDGE.md** | Export JSON vs analisi reale; dove gestire la knowledge (prompts, audit-specs). |
| **docs/KIMI-FOR-DUMMIES.md** | Guida pratica: account, API key, test prompt su kimi.com, replicare per altri agenti. |
| **docs/DS-AUDIT-WHO-DOES-WHAT.md** | Chi fa cosa per l’agente DS Audit (tu vs assistente), in ordine. |
| **docs/DS-AUDIT-FIRST-TEST.md** | Primo test DS Audit: come ottenere il JSON (export/Network), incollare su kimi.com, verificare output. |
| **docs/A11Y-AUDIT-PLAN.md** | Piano agente Accessibilità: Kimi + API gratuite, regole WCAG-like su design, categorie. |
| **docs/FEASIBILITY-KIMI-SWARM.md** | Studio di fattibilità multi-agente (Kimi K2.5, Swarm, MCP, axe-core, pipeline dati). |

---

## Specifiche audit (regole e output)

| Cartella / file | Contenuto |
|-----------------|-----------|
| **audit-specs/README.md** | Struttura cartelle (ds-audit, a11y-audit, …), uso per backend e QA. |
| **audit-specs/MAINTAINING-RULES.md** | Come modificare le regole, handoff, aggiungere categorie. |
| **audit-specs/ds-audit/** | Design System Audit: regole, OUTPUT-SCHEMA, fonti, problematiche ricorrenti. |
| **audit-specs/a11y-audit/** | Accessibility Audit: regole, OUTPUT-SCHEMA, Kimi + API gratuite. |

I **prompt** (system prompt per Kimi) stanno in **auth-deploy/prompts/** (vedi `auth-deploy/prompts/README.md`).

---

## Backend e integrazioni

| File | Contenuto |
|------|-----------|
| **auth-deploy/prompts/README.md** | Prompts per gli agenti (ds-audit-system.md, a11y-audit-system.md, …); dove gestire la knowledge. |
| **auth-deploy/parked-endpoints/README.md** | Endpoint “parcheggiati” o non ancora attivi. |
| **docs/TESTING-INTEGRATIONS.md** | Test e integrazioni (affiliate, referral, simulazioni). |
| **docs/AFFILIATE.md** | Sistema affiliati e API. |
| **docs/GAMIFICATION.md** | XP, livelli, trofei, formula. |
| **docs/COST-ESTIMATE-DS-AUDIT.md** | Stima costi e crediti DS Audit (Kimi, piani, cassa); include riferimento Generate. |
| **docs/COST-ESTIMATE-A11Y.md** | Matrice crediti A11Y Audit v1.0 (senza Kimi, bande complessità). |

---

## Generate (wireframe/layout da Design System)

| File | Contenuto |
|------|-----------|
| **docs/GENERATION-ENGINE-RULESET.md** | Regole complete: modi, governance, schema action plan, crediti, validazione. |
| **docs/GENERATION-ENGINE-FEASIBILITY.md** | Fattibilità tecnica (Kimi only, senza Claude), costi, fallimenti. |
| **docs/GENERATE-TAB-SPEC.md** | Spec UI tab Generate (props, stato, copy, data-attribute). |
| **auth-deploy/prompts/generate-system.md** | System prompt Kimi per generazione (action plan JSON). |

Endpoint: **POST /api/agents/generate** (file_key, prompt, mode, ds_source). Crediti: 3 (standard); vedi backend `estimateCreditsByAction('generate')`.

---

## Altri riferimenti

- **oauth-server/README.md** — Server OAuth (se presente).
- **audit-specs/ds-audit/SOURCES.md**, **RECURRING-PROBLEMS.md** — Fonti e problemi ricorrenti per DS Audit.
