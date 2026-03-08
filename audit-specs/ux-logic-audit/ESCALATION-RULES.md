# UX Logic Audit — Regole di escalation

Determinate combinazioni di issue aggravano la situazione o indicano problemi sistemici. L’agente applica queste regole **dopo** la scansione iniziale e può restituire voci in `escalations[]` e/o innalzare severity/flag.

---

## Tabella escalation

| Esc. ID | Condizione | Escalation | Rationale |
|---------|------------|------------|-----------|
| **ESC-001** | UXL-012 (Missing Label) + UXL-013 (No Error State) sullo stesso form | **CRITICAL FORM** | Form senza label e senza stati errore è di fatto inutilizzabile. |
| **ESC-002** | UXL-001 (No Loading) + UXL-002 (No Success/Error) sullo stesso componente | **Compound HIGH** | Azione senza loading e senza feedback di esito è completamente opaca. |
| **ESC-003** | 3+ issue MED nella stessa categoria sulla stessa pagina | **SYSTEMATIC ISSUE** | Pattern indica problema sistemico, non singola dimenticanza. |
| **ESC-004** | UXL-044 (Single Breakpoint) + UXL-045 (No Auto-Layout) | Entrambe → **HIGH** | Nessun responsive e nessun auto-layout = esperienza mobile compromessa. |
| **ESC-005** | UXL-054 (Asymmetric Action) + UXL-055 (Pre-Selected Opt-In) sulla stessa pagina | **DARK PATTERN ALERT** | Più pattern ingannevoli sulla stessa pagina indicano rischio di manipolazione deliberata. |
| **ESC-006** | UXL-059 (No Expansion Buffer) + UXL-060 (Fixed Buttons) su >50% delle pagine | **I18N BLOCKER** | La maggior parte dell’UI si romperà in localizzazione; da affrontare prima della traduzione. |

---

## Output

- Ogni escalation può essere restituita in `summary.escalations` (conteggio) e in `escalations[]` con almeno: `id` (ESC-001 … ESC-006), `label`, `description`, opzionalmente `ruleIds` o `nodeIds` coinvolti.
- Il frontend può mostrare un banner o sezione “Escalations” quando `escalations.length > 0`, con link alle issue correlate.

L’agente non è tenuto a ricalcolare lo UX Health Score per le escalation; il punteggio resta basato su HIGH/MED/LOW. Le escalation sono **segnali aggiuntivi** per il designer.
