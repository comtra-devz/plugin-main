# Audit specs — Specifiche per gli agenti Comtra

Cartella che raccoglie **regole, schema di output e materiali** per ogni agente di audit/integrazione Comtra (Kimi).  
Usata per costruire i prompt, validare le risposte e mantenere uno standard di qualità alto.

## Struttura

```
audit-specs/
├── README.md                 (questo file)
└── ds-audit/                 Design System Audit
    ├── README.md
    ├── DS-AUDIT-RULES.md      Regole complete, mappatura JSON del file, severity, fix
    └── OUTPUT-SCHEMA.md      Formato JSON di risposta dell’agente
```

In futuro, stessa struttura per altri agenti:

- `a11y-audit/` — Accessibility audit
- `ux-audit/` — UX audit
- `proto-audit/` — Prototype audit
- `code-gen/` — Code generation
- `generate/` — Wireframe/variant generation

## Uso

- **Backend:** legge regole e schema dalla cartella corrispondente per costruire il system prompt e validare l’output.
- **Documentazione:** i file `.md` servono come riferimento per estendere le regole e per il QA.
- **Piano d’azione:** vedi `docs/ACTION-PLAN-KIMI-AGENTS.md` per i passi di integrazione.

Non spostare questa cartella fuori dalla repo: è parte del codice e della definizione del prodotto.
