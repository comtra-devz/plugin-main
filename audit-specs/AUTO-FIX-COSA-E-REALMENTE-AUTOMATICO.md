# Auto-fix: cosa è automatico e cosa no (guida leggibile)

Questa pagina risponde in modo diretto a: **su cosa il plugin modifica davvero il file Figma** quando premi un pulsante di fix, e cosa invece è solo guida testuale.

Per il dettaglio tecnico (ogni `rule_id`, crediti, roadmap): **[AUTO-FIX-ISSUE-MAP.md](./AUTO-FIX-ISSUE-MAP.md)**.

---

## In una tabella

| Audit nel plugin | Fix davvero automatico sul canvas? | In pratica |
|------------------|-------------------------------------|------------|
| **Accessibility (A11Y)** | **Sì, solo per due famiglie di problemi** | **Contrasto** (testo vs sfondo): il plugin può aggiornare colori / variabili / stili come da preview. **Touch target** (dimensioni / padding): il plugin può aumentare padding o ridimensionare il layer come da preview. |
| **Design System (DS)** | **No** (oggi) | Il pulsante guida con **“How to fix”**: messaggio e passi suggeriti dall’audit, **nessuna modifica automatica** salvo sviluppi futuri nel controller. |
| **UX Logic** | **No** (oggi) | Come sopra: suggerimenti, non apply cieco sul canvas. |
| **Prototype** | **No** (oggi) | Come sopra. |

---

## Accessibility — cosa è automatizzato (preciso)

| Tipo di problema | Regole tipiche (`rule_id`) | Comportamento reale |
|-------------------|---------------------------|---------------------|
| **Contrasto** insufficiente | `CTR-001` … `CTR-004` | Dopo la preview, il plugin può applicare il fix (variabile colore, paint style, o colore calcolato sul testo). |
| **Touch target** troppo piccolo / comfort | `TGT-001`, `TGT-003` | Dopo la preview, il plugin può applicare padding variabile, padding numerico o resize come previsto. |

Tutto il resto nell’audit **Accessibility** (focus senza variante dedicata, alt text, semantica, alcuni problemi colore, ecc.) — anche se compare nella lista issue — **non** ha oggi un percorso che modifica il layer in modo mirato: è **manuale / guida**.

---

## Cosa significa “How to fix”

Per issue **non** coperte dai casi sopra, il plugin mostra i **passi suggeriti** (testo dall’audit). **Non partono crediti** per un’automazione che non esiste: è trasparenza rispetto al comportamento reale.

---

## Dove sta il codice che applica i fix veri

- **Preview + apply contrasto / touch:** messaggi dal iframe verso il plugin (`get-contrast-fix-preview`, `get-touch-fix-preview`, poi `apply-fix` con i dati della preview).
- **Implementazione Figma:** `controller.ts` (`applyContrastFix`, `applyTouchFix`).

---

## Versione

Allineato allo stato del codice nel repo; quando si aggiunge un nuovo fix programmatico, aggiornare questa pagina e la mappa tecnica collegata.
