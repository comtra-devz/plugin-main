# Prompts per gli agenti Kimi

Contiene i **system prompt** usati dal backend quando chiama l’API Moonshot (Kimi). Ogni file `*-system.md` è letto e inviato come messaggio di sistema nella richiesta `POST .../v1/chat/completions`.

- **ds-audit-system.md** — Agente Design System Audit (regole da `audit-specs/ds-audit/`).
- Per altri agenti: creare `a11y-audit-system.md`, `ux-audit-system.md`, ecc.

Dove gestire la knowledge per Moonshot/Kimi: **docs/AUDIT-PIPELINE-AND-KNOWLEDGE.md**.

Per testare il prompt senza backend: copia il contenuto (dalla prima riga utile, es. "You are a design system auditor...") e incollalo come primo messaggio su kimi.com; come secondo messaggio invia il JSON del file. Vedi **docs/KIMI-FOR-DUMMIES.md**.
