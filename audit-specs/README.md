# Audit specs — Specifiche per gli agenti Comtra

Cartella che raccoglie **regole, schema di output e materiali** per ogni agente di audit/integrazione Comtra (Kimi).  
Usata per costruire i prompt, validare le risposte e mantenere uno standard di qualità alto.

## Struttura

```
audit-specs/
├── README.md                 (questo file)
├── AUTO-FIX-ISSUE-MAP.md     Mappatura completa: categorie, rule_id, stato auto-fix vs implementazione plugin
├── MAINTAINING-RULES.md      Guida: come modificare le regole e handoff ad altre persone
├── ds-audit/                 Design System Audit
│   ├── README.md
│   ├── DS-AUDIT-RULES.md      Regole complete, mappatura JSON del file, severity, fix
│   ├── OUTPUT-SCHEMA.md      Formato JSON di risposta dell'agente
│   ├── SOURCES.md            Fonti autorevoli e mappatura alle regole
│   └── RECURRING-PROBLEMS.md Problematiche ricorrenti (community), severity, mappatura
├── a11y-audit/               Accessibility Audit (Kimi + API gratuite)
│   ├── README.md
│   ├── A11Y-AUDIT-RULES.md   Regole: contrast, touch, focus, alt, semantics, color
│   └── OUTPUT-SCHEMA.md      Formato JSON di risposta (stesso schema AuditIssue)
└── ux-logic-audit/           UX Logic Audit (Kimi)
    ├── README.md
    ├── UX-LOGIC-AUDIT-RULES.md  60 regole, 11 categorie, detection logic
    ├── OUTPUT-SCHEMA.md         Schema JSON (issues + summary + escalations)
    ├── SEVERITY-AND-SCORE.md    Severity, UX Health Score, badge
    ├── ESCALATION-RULES.md      Combinazioni che aggravano / flag (ESC-001…006)
    ├── STATE-MATRIX.md          Matrice stati varianti componenti
    ├── DETECTION-PIPELINE.md   Pipeline a 5 fasi
    ├── SOURCES.md               Fonti (Nielsen, Baymard, NNGroup, Carbon, …)
    └── AGENT-DIRECTIVES.md      Tono, falsi positivi, costo crediti
├── prototype-audit/          Prototype Audit (in-plugin deterministico, no Kimi)
    ├── README.md               Scope, AI vs deterministico, tabella regole, scope UI per flussi
    ├── PROTOTYPE-AUTO-FIX-ROADMAP.md  Piano auto-fix prototype (fasi A–C, before go live D–E)
    ├── SCOPE-AND-UI.md         Multi-select flussi (flowStartingPoints); no All Pages
    ├── PROTOTYPE-AUDIT-RULES.md  20 regole P-01–P-20 (flow, nav, interaction, overlay, variables, docs)
    ├── OUTPUT-SCHEMA.md         Schema JSON (findings, summary, health score)
    ├── SEVERITY-AND-SCORE.md    Punti per severity, advisory levels (Healthy / Needs Attention / …)
    ├── TYPES-AND-CATEGORIES.md  categoryId per UI (6 categorie)
    ├── EFFORT-VS-FIDELITY.md    Consigli effort vs fedeltà, quando usare proto avanzato (ricerca utente)
    ├── COST-PROSPECT.md         Crediti proporzionali a numero flussi (1–4), bassi
    └── AGENT-DIRECTIVES.md      Direttive per eventuali tips AI opzionali
```

In futuro, stessa struttura per altri agenti:

- `code-gen/` — Code generation (CODE-GEN-RULES.md: React, Storybook, Liquid, CSS, Vue, Svelte, Angular)
- `generate/` — Wireframe/variant generation

## Uso

- **Auto-fix (roadmap + mapping issue/categoria):** vedi **AUTO-FIX-ISSUE-MAP.md** (allineamento con `controller.ts`, engine A11Y, `autoFixConfig.ts`).
- **Backend:** legge regole e schema dalla cartella corrispondente per costruire il system prompt e validare l’output.
- **Documentazione:** i file `.md` servono come riferimento per estendere le regole e per il QA.
- **Manutenzione regole e handoff:** vedi **MAINTAINING-RULES.md**. **Test Kimi (senza backend):** vedi `docs/KIMI-FOR-DUMMIES.md`.
- **Piano d’azione:** vedi `docs/ACTION-PLAN-KIMI-AGENTS.md` per i passi di integrazione.

Non spostare questa cartella fuori dalla repo: è parte del codice e della definizione del prodotto.
