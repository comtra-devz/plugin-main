# Prototype Audit — Regole P-01–P-20

Tabella master e logica di detection per ogni regola. Severity: Critical / High / Medium / Low come da PDF. Le severity Critical nel ruleset sono mappate a **HIGH** nel payload per il plugin (il tipo `AuditIssue` usa HIGH | MED | LOW); le regole Critical restano a impatto massimo nel calcolo dello score (vedi SEVERITY-AND-SCORE.md).

---

## Tabella master

| ID | Nome | Severity (PDF) | categoryId |
|----|------|----------------|------------|
| P-01 | Dead-End Detection | Critical | flow-integrity |
| P-02 | Orphan Frame Detection | Critical | flow-integrity |
| P-03 | Flow Starting Point Validation | Critical | flow-integrity |
| P-04 | Broken Destination Reference | Critical | flow-integrity |
| P-05 | Missing Back Navigation | High | navigation-coverage |
| P-06 | Unreachable Frame Detection | High | navigation-coverage |
| P-07 | Circular Loop Detection | High | navigation-coverage |
| P-08 | Duplicate trigger on same layer | High | interaction-quality |
| P-09 | Smart Animate Layer Matching | High | interaction-quality |
| P-10 | Animation Duration Boundaries | Medium | interaction-quality |
| P-11 | Easing Consistency | Medium | interaction-quality |
| P-12 | Overlay Configuration Completeness | Medium | overlay-scroll |
| P-13 | Scroll Overflow Validation | Medium | overlay-scroll |
| P-14 | Interactive Component Completeness | High | component-advanced |
| P-15 | Variable Usage Validation | Medium | component-advanced |
| P-16 | Conditional Logic Integrity | Medium | component-advanced |
| P-17 | Multiple Actions Order Validation | Medium | component-advanced |
| P-18 | Flow Naming & Description | Low | documentation-coverage |
| P-19 | Hotspot Coverage Analysis | Medium | documentation-coverage |
| P-20 | Prototype Presentation Settings | Low | documentation-coverage |

---

## Flow Integrity (P-01 – P-04)

### P-01: Dead-End Detection [CRITICAL → HIGH in payload]

- **Definizione:** Un frame top-level che fa parte di un flusso (ha connessioni in ingresso) ma ha zero connessioni in uscita e nessuna azione Back su nessun figlio. L’utente arriva e resta bloccato.
- **Detection:** Per ogni frame raggiungibile dal starting point, verificare se almeno un nodo figlio ha una reaction con azione in uscita (Navigate to, Back, Open link, Open/Swap/Close overlay, Scroll to). Se l’unica uscita è Close overlay e non c’è modo di uscire dal frame sottostante → dead-end. Eccezione: frame finale di un flusso lineare esplicitamente terminale (es. conferma) se marcato in descrizione.
- **Suggested fix:** "Add a Back action or Navigate to action so the user can leave this screen."

### P-02: Orphan Frame Detection [CRITICAL → HIGH]

- **Definizione:** Frame top-level sulla pagina con zero connessioni in ingresso e che non è flow starting point. Completamente disconnesso.
- **Detection:** Insieme di tutti i frame top-level; sottrarre (a) flow starting points e (b) frame referenziati come destinationId in qualche reaction. I rimanenti sono orfani. I frame usati solo come destinazione overlay non sono orfani.
- **Skip heuristic (noise reduction):** Non segnalare come orfani i frame che con alta probabilità sono label, titoli di sezione o blocchi doc (non schermate del prototipo). Criteri: nome con keyword (label, section, header, title, doc, note, indicator, legend, caption, placeholder, divider, spacer, "rules with", tiers); proporzioni da “banner” (aspect ratio >5 o <1/5, oppure altezza <120px e larghezza >300px); oppure un solo figlio di tipo TEXT. Vedi `isLikelyNonPrototypeFrame` in controller.
- **Severity modulation:** Se gli orfani sono >30% dei frame della pagina → avviso a livello flusso (prototipo incompleto).
- **Suggested fix:** "Connect this frame to a flow (add a Navigate to or Open overlay from another frame) or remove it if unused."

### P-03: Flow Starting Point Validation [CRITICAL → HIGH]

- **Definizione:** Ogni pagina deve avere almeno un flow starting point; ogni starting point deve avere almeno una connessione in uscita.
- **Check:** Zero flow starting point → Critical. Starting point con zero uscite → Critical. Nome flow default ("Flow 1", "Flow 2") → Low advisory. Più flussi con stesso starting frame → High (entry point ambiguo).
- **Suggested fix (no start):** "Set at least one frame as flow starting point so the prototype can be previewed." (no outgoing): "Add at least one interaction from this starting frame to another frame."

### P-04: Broken Destination Reference [CRITICAL → HIGH]

- **Definizione:** Una reaction riferisce un destinationId che non esiste nella pagina (frame cancellato, spostato, ID corrotto).
- **Detection:** Per ogni reaction con action.type === 'NODE', estrarre action.destinationId e verificare con figma.getNodeById(); se null → broken.
- **Suggested fix:** "Reconnect this interaction to an existing frame or remove the broken link. The target frame may have been deleted or moved."

---

## Navigation & Coverage (P-05 – P-07)

### P-05: Missing Back Navigation [HIGH]

- **Definizione:** Frame non di partenza raggiungibile via Navigate to senza modo di tornare indietro (nessun Back né Navigate to verso il frame sorgente).
- **Detection:** Per ogni frame raggiunto da NAVIGATE, controllare se un figlio ha action BACK o Navigate to verso il frame da cui si arriva. Eccezioni: overlay (Close overlay basta); flussi tipo browser con Open link.
- **Severity:** HIGH per schermata mid-flow; MEDIUM per detail/modal.
- **Suggested fix:** "Add a Back action or a button that navigates to the previous screen so users can go back."

### P-06: Unreachable Frame Detection [HIGH]

- **Definizione:** Frame che ha connessioni in ingresso ma non è raggiungibile dallo starting point (grafo disconnesso).
- **Detection:** Da ogni flow starting point, traversale in profondità seguendo destinationId; costruire set di frame raggiungibili. Frame con incoming ma non in tale set = unreachable.
- **Suggested fix:** "This frame has incoming connections but is not reachable from any flow start. Reconnect the flow or add a path from a starting frame."

### P-07: Circular Loop Detection [HIGH]

- **Definizione:** Ciclo infinito di sole transizioni automatiche (After delay) senza uscita controllata dall’utente.
- **Detection:** Cycle detection nel grafo (visited + stack). Segnalare solo cicli dove tutte le transizioni sono After delay. Eccezione: loop di 2 frame (loading) → INFO only.
- **Suggested fix:** "This automatic loop has no user exit. Add an On click path out of the loop or reduce to a single loading frame."

---

## Interaction Quality (P-08 – P-11)

### P-08: Duplicate trigger on same layer [HIGH]

- **Definizione:** Due o più interazioni con lo **stesso** tipo di trigger (es. due On click, due While hovering) sullo **stesso** layer — stesso caso che Figma segnala in editor.
- **Detection:** Per ogni `nodeId`, contare le reaction per `trigger.type`; se count > 1 per un tipo → flag. **Non** raggruppare per parent: componenti fratelli (es. “Documentation” vs “Tips”) possono avere trigger diversi (Hover + Key, ecc.) senza essere “incoerenti”.
- **Suggested fix:** "Merge into one interaction or use different layers. Figma warns when two identical triggers compete on the same hotspot."

### P-09: Smart Animate Layer Matching [HIGH]

- **Definizione:** Con Smart Animate, Figma abbina layer per nome e gerarchia. Nomi/hierarchy diversi → fallback a dissolve.
- **Detection:** Per ogni reaction con transition.type === 'SMART_ANIMATE', confrontare figli diretti source vs destination per nome; segnalare layer presenti in uno ma non nell’altro, nomi uguali ma profondità diversa, nomi default ("Rectangle 1", "Frame 42").
- **Suggested fix:** "Match layer names and hierarchy between source and destination frames so Smart Animate can interpolate correctly. Avoid default layer names."

### P-10: Animation Duration Boundaries [MEDIUM]

- **Definizione:** Durate entro range UX: troppo brevi invisibili, troppo lunghe pesanti. (PDF: Navigation 200–500ms, Overlay 150–400ms, ecc.; Warning/Error thresholds per contesto.)
- **Detection:** Per ogni transition, confrontare duration con soglie per tipo (Navigate, Overlay, Change to, Smart Animate, Scroll to). Figma in secondi; convertire in ms per report.
- **Suggested fix:** "Set duration within recommended range (e.g. 200–500ms for navigation) so the transition feels clear but not sluggish."

### P-11: Easing Consistency [MEDIUM]

- **Definizione:** Stesso tipo di transizione nello stesso flusso dovrebbe usare easing coerente.
- **Detection:** Raggruppare per tipo azione (NAVIGATE, OVERLAY, CHANGE_TO, SCROLL_TO); se più di 2 easing diversi → flag. Eccezione: contrasto intenzionale enter (Ease Out) / exit (Ease In) accettato. CUSTOM_BEZIER: flag se differisce >0.1 da preset.
- **Suggested fix:** "Use a consistent easing (e.g. Ease Out for entrances) across this flow for a coherent motion language."

---

## Overlay & Scroll (P-12 – P-13)

### P-12: Overlay Configuration Completeness [MEDIUM]

- **Definizione:** Frame usati come overlay devono avere configurazione esplicita: position type, close when clicking outside, background, e almeno un modo per chiudere (Close overlay o Swap).
- **Detection:** Per frame usati come destinazione Open overlay: verificare position type, "close when clicking outside" (abilitato per modali dismissibili, disabilitato per blocking), overlay background per modali (opacità 30–60%). Overlay senza nessun Close overlay e senza "close when clicking outside" → utente intrappolato.
- **Suggested fix:** "Set overlay position, background, and close behavior. Ensure at least one Close overlay or 'Close when clicking outside' so users can dismiss."

### P-13: Scroll Overflow Validation [MEDIUM]

- **Definizione:** Frame con contenuto oltre i bounds devono avere overflow scroll appropriato; frame senza overflow non devono avere scroll abilitato.
- **Detection:** Contenuto oltre bounds e overflowDirection NONE → HIGH. Scroll su asse sbagliato → MEDIUM. Scroll senza overflow → LOW. preserveScrollPosition: true dove serve continuità (es. nav bar), false per schermate nuove.
- **Suggested fix:** "Enable scroll (Vertical/Horizontal) for this frame so content beyond bounds is accessible; or disable scroll if content fits."

---

## Component & Advanced (P-14 – P-17)

### P-14: Interactive Component Completeness [HIGH]

- **Definizione:** Component set usati con Change to devono coprire stati attesi (Button: Default, Hover, Pressed, Disabled; Toggle: Off/On; Checkbox: Unchecked/Checked; ecc.) e Disabled senza reactions.
- **Detection:** Per component con Change to: verificare copertura varianti minime e direzioni (es. Hover → Default su Mouse leave). Disabled con reactions → flag.
- **Suggested fix:** "Edit the main component: add missing state variants (Default, Hover, Pressed, Disabled) and wire interactions (e.g. Hover → Default on Mouse leave). Remove interactions from Disabled variant. States are defined on the main component, not on the instance."

### P-15: Variable Usage Validation [MEDIUM]

- **Definizione:** Variabili usate in Set variable devono esistere nella collection; variabili SET ma mai READ (o READ mai SET) e type mismatch vanno segnalate.
- **Detection:** Set variable → variabile in collection? No → HIGH. Variabile SET mai READ → MEDIUM. Variabile READ mai SET → MEDIUM. Tipo valore assegnato ≠ tipo variabile → HIGH.
- **Suggested fix:** "Create the variable in a collection, or bind it to a property/conditional. Ensure set and read usage match and types are correct."

### P-16: Conditional Logic Integrity [MEDIUM]

- **Definizione:** Conditionals devono riferire variabili esistenti, tipi compatibili, entrambi i branch con almeno un’azione (o ELSE vuoto solo se IF auto-recovery), no tautologie, nested >3 livelli → advisory.
- **Detection:** Variabili in condizione esistono e tipo compatibile; IF e ELSE con azioni; condizioni sempre true/false per default → MEDIUM; nesting >3 → LOW.
- **Suggested fix:** "Fix condition expression (variable name and type) and ensure both branches have the intended actions."

### P-17: Multiple Actions Order Validation [MEDIUM]

- **Definizione:** L’ordine delle azioni su un trigger conta. Set variable prima di Navigate; Conditional dopo Set variable che usa quella variabile; multipli Navigate to → solo l’ultimo; Open overlay + Navigate to spesso non intenzionale.
- **Detection:** Navigate to prima di Set variable → "Set variable should precede Navigate to for the change to apply on the destination." Conditional dopo Set variable che la referenzia → possibile logica inattesa. Più Navigate to stesso trigger → HIGH. Open overlay + Navigate to → MEDIUM.
- **Suggested fix:** "Reorder actions: set variables and run conditionals before navigation so the destination frame sees the updated state."

---

## Documentation & Coverage (P-18 – P-20)

### P-18: Flow Naming & Description [LOW]

- **Definizione:** Nomi flow descrittivi (no "Flow 1", "Flow 2"); >5 flussi su una pagina → advisory; descrizione ricca → good practice.
- **Detection:** Nome default → LOW. Più di 5 flussi → LOW advisory.
- **Suggested fix:** "Rename the flow (e.g. 'Onboarding', 'Checkout') and add a short description for handoff."

### P-19: Hotspot Coverage Analysis [MEDIUM]

- **Definizione:** Elementi che sembrano interattivi (bottoni, link, icone con naming "btn-*", "cta-*") dovrebbero avere almeno una reaction.
- **Detection:** Euristiche su nome componente, stile (underline, colore link), naming; nodi senza reactions → MEDIUM. Istanze di componenti interattivi: controllare reactions sul main component.
- **Skip (container):** Non segnalare **GROUP** né **FRAME/COMPONENT** con **più di un figlio diretto** — sono contenitori (es. sezione con più righe “Documentation” / “Tips”); l’interazione va sui singoli figli, non sul blocco raggruppato.
- **Suggested fix:** "Add a prototype interaction (e.g. On click → Navigate to or Open overlay) so this element is clickable in the prototype."
- **Nota:** Possibili falsi positivi; in UI etichettare come "Suggested interactions".

### P-20: Flow Density & Testability [LOW]

- **Definizione:** Troppi starting point (flussi) sulla stessa pagina rendono più difficile navigare, pianificare i test e mantenere il prototipo nel tempo.
- **Detection:** Se la pagina ha più di 5 `flowStartingPoints` → LOW advisory.
- **Suggested fix:** "Consider splitting this prototype into smaller sections/pages (<= 5 flows each) or rename flows clearly so each flow can be tested independently. Many flows on one page makes navigation and test planning harder."
