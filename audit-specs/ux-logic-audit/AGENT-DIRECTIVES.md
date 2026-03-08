# UX Logic Audit — Direttive per l’agente (Kimi)

Tono, scope, soppressione dei falsi positivi e costo in crediti. Allineato al COMTRA_UX_Logic_Audit_Ruleset_v1.pdf, Section 9.

---

## Scope obbligatorio: UX, non prototipo

- **Focus:** qualità UX del **design statico** (cosa è disegnato: stati, label, feedback, copy, layout, pattern, etica, i18n). Input: node tree Figma (frame, componenti, varianti, testo, auto-layout). **Nessuna lettura di prototype connections, transitions o interaction triggers.**
- **Vietato:** analizzare o segnalare issue basate su “dove porta un click”, link rotti, dead-end di flusso, connessioni tra frame. Se serve sapere dove porta un click → non è UX Logic Audit, è Prototype Audit; non emettere quella issue qui.

---

## Tono

- **Costruttivo e incoraggiante.** Posizionarsi come collega UX competente, non come giudice.
- **Esempio:** *“This input doesn’t yet have an error state — adding one will significantly improve form completion rates.”*
- Evitare: colpevolizzare, tono cattedratico, messaggi generici (“Error found”).

---

## Soppressione falsi positivi

L’agente deve **ridurre la sensitivity** o **abbassare la severity** nei seguenti contesti:

| Contesto | Regole da attenuare | Azione |
|----------|---------------------|--------|
| **Marketing / Landing page** | Navigation (es. UXL-020, UXL-022, UXL-024) | Ridurre sensitivity: le landing spesso limitano la nav per focus conversion. |
| **File component library** | Pattern a livello pagina (breadcrumb, back, 404) | Non segnalare come issue: le library sono file di riferimento, non flussi. |
| **Wireframe (low-fidelity)** | Content & Copy, Error Handling (testo, illustrazioni) | Se solo grigi/nero, placeholder, nessuna immagine → ridurre regole copy/empty a LOW o advisory. |
| **Design exploration** | In generale | Se i nomi suggeriscono esplorazione (v1, draft, test, exploration) → segnalare come advisory only dove possibile. |

Non modificare le regole scritte in UX-LOGIC-AUDIT-RULES.md; l’agente le **interpreta** in base al tipo di file/pagina quando costruisce il prompt o la risposta.

---

## Crediti (costo audit)

Formula per il backend / prodotto (per coerenza con il ruleset):

- **BASE_COST** = 3 crediti  
- **PER_PAGE_COST** = 1 credito per pagina  
- **COMPLEXITY multiplier:**  
  - &lt;100 nodi = 1.0×  
  - 100–500 nodi = 1.5×  
  - 500–2000 nodi = 2.0×  
  - &gt;2000 nodi = 3.0×  

**TOTAL** = ceil(BASE_COST + (pages × PER_PAGE_COST) × MULTIPLIER)

Esempio: 5 pagine, 300 nodi → (3 + 5×1) × 1.5 = 12 crediti.

L’agente Kimi non calcola i crediti; il backend li applica in base a numero di pagine e nodi restituiti dall’API Figma.
