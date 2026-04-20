# Generation Engine — Ruleset

Ruleset per il **Comtra Generation Engine**: generazione di wireframe/layout in Figma governata dal design system. Estratta da *COMTRA_Generation_Engine_Ruleset_v1* (March 2026). Uso: (1) implementazione backend (modello primario/fallback), (2) esecuzione plugin (Figma API), (3) UI/crediti e (4) validazione action plan.

**Principio:** “Refine, Don’t Redraw.” Comtra non inventa, assembla. Ogni elemento generato risale a componenti/token del DS del designer o a un design system open selezionato.

---

## 1. Garantie trasversali

| ID | Regola | Severity |
|----|--------|----------|
| **Cross-function** | Ogni output MUST essere nodi Figma standard, interpretabili da Dev Mode, Code, Audit, Stats e da qualsiasi plugin terzo. Niente formati proprietari o layer bloccati. | Fondamentale |
| **Accessibility** | Il motore eredita i problemi di accessibilità del DS. NON è suo compito correggerli. Workflow consigliato: Audit → fix DS → poi Generate. Se il DS ha issue a11y, mostrare warning non bloccante: *“Your design system has [N] accessibility issues that will carry over to generated output. Run an Audit to review.”* | Disclaimer |

---

## 2. Architettura e performance

### 2.1 Flusso dati (9 step)

1. Designer: prompt in AI Terminal (+ opzionale screenshot/link).
2. Plugin: legge contesto (Figma Plugin API): componenti, token, variabili, stili, slot, doc, selection.
3. Plugin: comprime e invia al backend (context JSON + prompt + DS + preferenze).
4. Backend: instrada a Kimi K2.5 con regole di generazione.
5. LLM: restituisce action plan (JSON).
6. Backend: valida azioni (riferimenti nel DS).
7. Plugin: esegue azioni (Figma API).
8. Plugin: (opzionale) screenshot di verifica.
9. Plugin: mostra risultato e detrae crediti.

### 2.2 LLM e fallback

- **Primario:** Kimi K2.5 (multimodale, agentico, costo favorevole). Output MUST essere JSON-only con `max_tokens` limitati.
- **Fallback:** se il modello primario fallisce (JSON malformato, componenti allucinati, timeout > 8 s): retry fino a 2 volte (totale 3 tentativi). Nessun fallback premium nella v1 (costi superiori); vedi `docs/GENERATION-ENGINE-FEASIBILITY.md`.

### 2.3 Performance (non negoziabili)

| Complessità | Target | Max | Misura |
|-------------|--------|-----|--------|
| Simple (1–5 componenti) | 3–5 s | 8 s | Invio prompt → render su canvas |
| Medium (6–15) | 5–8 s | 12 s | idem |
| Complex (16+) | 8–15 s | 20 s | idem |
| Screenshot→DS | 8–12 s | 20 s | Upload immagine → canvas |
| LLM (solo backend) | 2–4 s | 6 s | Chiamata API → JSON ricevuto |
| Plugin (solo client) | 1–3 s | 5 s | JSON ricevuto → nodi creati |

**Ottimizzazioni:** cache DS al launch (refresh su file change); streaming JSON; semantic hashing (stesso DS = cache hit); sanitizer (solo dati strutturali); Agent Swarm per sottotask paralleli; component reference index compatto in prompt (<4K token/DS).

---

## 3. Contesto: cosa legge il motore

### 3.1 Context layers obbligatori

| Layer | API Figma | Priorità |
|-------|-----------|----------|
| Components | `findAll(COMPONENT / COMPONENT_SET)` | Critical |
| Variables | `getLocalVariablesAsync()` | Critical |
| Variable Collections | `getLocalVariableCollectionsAsync()` | Critical |
| Component Properties | `componentPropertyDefinitions` (variant, slot) | Critical |
| Slots | Props `type === SLOT` | Critical |
| Selection | `currentPage.selection` | Critical (Mode 2) |
| Styles | Paint/Text/Effect styles | High |
| Component Descriptions | `component.description` | High |
| Page Structure | `figma.root.children` | Medium |
| Published Libraries | teamLibrary | Medium |

### 3.2 Documentazione come contesto (G-DOC-1)

- **Component descriptions:** rispettare sempre (es. “Primary per CTA, Secondary per azioni secondarie”).
- **Nodi annotazione:** testo con prefisso `_doc/` o `_annotation/` associato al componente parent.
- **Pagine:** “Documentation” / “Guidelines” = guida globale.
- **README DS:** frame “README” o “DS Overview” a root = documentazione master.
- **Code Connect:** se presente, allineare output ai pattern di implementazione.

**G-DOC-1:** In caso di conflitto tra documentazione del DS e pattern UX generici, vince sempre la documentazione.

---

## 4. Design system sources

- **Custom (Current):** legge il file corrente; default per produzione.
- **Open DS:** Material Design 3, iOS HIG, Ant Design, Carbon, Bootstrap 5, Salesforce Lightning, Uber Base Web. Manifest pre-indicizzati lato server; plugin li scarica e li mette in cache a sessione.
- **Ibrido:** se Custom ha <10 componenti, si MAY suggerire (non forzare) un open DS come punto di partenza.

---

## 5. I quattro modi di generazione

### 5.1 Mode 1 — No selection (Create from scratch)

| ID | Regola | Severity |
|----|--------|----------|
| G-M1-01 | Creare sempre un top-level frame con auto-layout. | Mandatory |
| G-M1-02 | Nome frame da semantica del prompt (es. “Login / Desktop”). | Mandatory |
| G-M1-03 | Posizionare a destra dell’ultimo frame, gap 100px; pagina vuota → (0,0). | Mandatory |
| G-M1-04 | Viewport default: Desktop 1440×900, Tablet 768×1024, Mobile 375×812. | Default |
| G-M1-05 | Solo componenti del DS selezionato; se manca (es. carousel), informare: “No carousel component found in your design system. I’ll use [closest alternative] instead.” | Mandatory |

### 5.2 Mode 2 — Selection active (Modify a copy)

| ID | Regola | Severity |
|----|--------|----------|
| G-M2-01 | **Sempre** clonare la selection prima di modificare; originali MAI toccati. | Critical |
| G-M2-02 | Nome copia: appendere “ — Generated”. | Mandatory |
| G-M2-03 | Copia a destra dell’originale, gap 100px. | Mandatory |
| G-M2-04 | Mantenere auto-layout, gerarchia, binding ai componenti. | Mandatory |
| G-M2-05 | Modificare solo ciò che il prompt richiede. | Mandatory |

### 5.3 Mode 3 — Upload screenshot (Pixel-to-DS)

| ID | Regola | Severity |
|----|--------|----------|
| G-M3-01 | Analisi vision Kimi: layout, elementi UI, spacing, colori, typography. | Mandatory |
| G-M3-02 | Ogni elemento mappato a un componente del DS; niente forme grezze per “mimare”. | Mandatory |
| G-M3-03 | Output = interpretazione governata, non copia pixel-perfect. | Mandatory |
| G-M3-04 | Elementi senza match: elencare e indicare alternative usate. | Mandatory |
| G-M3-05 | Accettare screenshot da qualsiasi piattaforma. | Mandatory |

### 5.4 Mode 4 — Paste link (Figma reference)

| ID | Regola | Severity |
|----|--------|----------|
| G-M4-01 | Risolvere link a nodo Figma via REST API. | Mandatory |
| G-M4-02 | Link = riferimento di struttura; ricostruire con DS **corrente**. | Mandatory |
| G-M4-03 | Supportare link cross-file. | Mandatory |
| G-M4-04 | Verificare almeno view access; se negato: “Can’t access the linked file. Make sure you have view permissions.” | Mandatory |
| G-M4-05 | Prompt può arricchire: “Recreate this [link] but mobile-first with bottom nav.” | Mandatory |

---

## 6. Governance

### 6.1 Componenti

| ID | Regola | Severity |
|----|--------|----------|
| G-GOV-01 | Nessun componente inventato: solo istanze del DS o elementi nativi giustificati (frame auto-layout, divider). | Critical |
| G-GOV-02 | Variante contestualmente corretta (documentazione + prompt + UX). | Mandatory |
| G-GOV-03 | Slot popolati con contenuto appropriato; vuoti solo se doc lo prevede. | Mandatory |
| G-GOV-04 | Tutte le istanze connesse al main component; mai detach. | Critical |
| G-GOV-05 | Rispettare linee guida in `component.description`. | Mandatory |

### 6.2 Token

| ID | Regola | Severity |
|----|--------|----------|
| G-GOV-06 | Nessun valore hardcoded: colori, spacing, radius, font size MUST riferire variabili Figma. | Critical |
| G-GOV-07 | Preferenza token semantici rispetto a primitivi (es. `color/surface/primary` non `color/blue/500`). | Mandatory |
| G-GOV-08 | Output corretto in tutti i mode delle variabili (light/dark, brand). | Mandatory |
| G-GOV-09 | Spacing solo dalla scala del DS (es. 8px grid: 8, 16, 24…). | Mandatory |

### 6.3 Layout

| ID | Regola | Severity |
|----|--------|----------|
| G-GOV-10 | Auto-layout su ogni frame; positioning assoluto solo per overlay (modal, tooltip, toast). | Critical |
| G-GOV-11 | Intento responsive con fill/hug, min/max width, wrap. | Mandatory |
| G-GOV-12 | Max 6 livelli di nesting. | Mandatory |
| G-GOV-13 | Nomi layer semantici (mai “Frame 43”). Convenzione DS o default Section/Function. | Mandatory |
| G-GOV-14 | Usare slot nativi per container composabili. | Recommended |

---

## 7. Variabilità

- **G-VAR-01:** Per lo stesso tipo di prompt, ruotare tra almeno 3 layout diversi (es. login: card centrata, split screen, form minimo). | Mandatory  
- **G-VAR-02:** Variare scelta componente quando più componenti vanno bene. | Recommended  
- **G-VAR-03:** Contenuto contestuale, mai lorem ipsum (es. “Email address”, “Password”). | Mandatory  
- **G-VAR-04:** Variare densità spacing entro la scala DS. | Recommended  
- **G-VAR-05:** Variare composizione (grid vs stack vs sidebar). | Recommended  

**Seed:** ogni richiesta include `variability_seed` (0–9999) per layout/spacing/composizione. L’utente può chiedere stesso seed (“generate again with same layout”) o nuova variante (“try a different approach”).

---

## 8. Output standards

| ID | Regola | Severity |
|----|--------|----------|
| G-OUT-01 | Auto-layout ovunque. | Critical |
| G-OUT-02 | Tutti i valori visivi legati a variabili Figma. | Critical |
| G-OUT-03 | Elementi UI come istanze di componente. | Critical |
| G-OUT-04 | Slot popolati correttamente. | Mandatory |
| G-OUT-05 | Nomi layer semantici. | Mandatory |
| G-OUT-06 | Ordine layer logico = ordine visivo. | Mandatory |
| G-OUT-07 | Nessun nodo orfano/nascosto/off-canvas. | Mandatory |
| G-OUT-08 | Testo contestuale in tutti i nodi testo. | Mandatory |

**Dev Mode:** variabili e nomi componenti visibili; proprietà auto-layout e slot ispezionabili. **Code export:** pronto per Comtra Code (token CSS/JSON, markup semantico, ARIA ove documentato).

---

## 9. Crediti

### 9.1 Tier per complessità

| Tier | Componenti | Crediti |
|------|------------|---------|
| Micro | 1–3 | 1 |
| Simple | 4–8 | 2 |
| Standard | 9–15 | 3 |
| Complex | 16–25 | 5 |
| Advanced | 26+ | 8 |
| Screenshot conversion | — | +2 sul tier |

Il tier è determinato **prima** della generazione; il plugin stima i componenti dal prompt e mostra il costo in una ScanReceiptModal; i crediti si detraggono solo dopo **canvas render riuscito**.

### 9.2 Ottimizzazioni

- **Cache hit:** contesto DS invariato (stesso hash) → input contesto a costo cache (Kimi cache hit).
- **Fallimento:** nessun addebito se generazione fallisce.
- **Iteration discount:** “try again” / “different approach” entro 60 s dalla precedente → −1 credito (min 1).

---

## 10. Action Plan Schema (contratto backend ↔ plugin)

### 10.1 Struttura top-level

```json
{
  "version": "1.0",
  "metadata": {
    "prompt": "original prompt",
    "mode": "create|modify|screenshot|reference",
    "complexity_tier": "micro|simple|standard|complex|advanced",
    "variability_seed": 1234,
    "ds_source": "custom|material3|ios_hig|...",
    "estimated_components": 12,
    "estimated_credits": 3
  },
  "frame": {
    "name": "Login / Desktop",
    "width": 1440,
    "height": 900,
    "layoutMode": "VERTICAL",
    "paddingTop": "spacing/xl",
    "paddingRight": "spacing/xl",
    "paddingBottom": "spacing/xl",
    "paddingLeft": "spacing/xl",
    "itemSpacing": "spacing/lg",
    "fills": [{ "type": "SOLID", "variable": "color/surface/default" }]
  },
  "actions": [ ... ]
}
```

### 10.2 Tipi di azione

| Tipo | Descrizione | Campi richiesti |
|------|-------------|------------------|
| CREATE_FRAME | Frame con auto-layout | name, layoutMode, padding*, itemSpacing, fills |
| INSTANCE_COMPONENT | Istanzia componente DS | componentKey, variantProperties, overrides |
| POPULATE_SLOT | Contenuto in uno slot | targetSlotName, content (nested actions) |
| SET_TEXT | Testo su override | targetProperty, value |
| SET_VARIABLE | Binding variabile | targetProperty, variableId |
| SET_LAYOUT | Auto-layout | direction, gap, padding, alignment, wrap |
| NEST | Inserisce figlio in parent | parentRef, childRef, position |

### 10.3 Regole di validazione (backend)

| ID | Regola | Severity |
|----|--------|----------|
| V-GEN-01 | Ogni `componentKey` in INSTANCE_COMPONENT MUST esistere nell’indice DS. | Critical |
| V-GEN-02 | Ogni `variableId` in SET_VARIABLE MUST esistere nell’indice variabili. | Critical |
| V-GEN-03 | Ogni `variantProperties` MUST essere combinazione valida per quel componente. | Critical |
| V-GEN-04 | POPULATE_SLOT: slot name esistente e content di tipo accettato. | Critical |
| V-GEN-05 | Conteggio azioni proporzionale al complexity tier (es. “micro” con 50 azioni → re-request). | Warning |
| V-GEN-06 | Nessuna azione con valore raw (hex, px, font size); solo riferimenti a variabili. | Critical |

---

## 11. Registry completo (riferimento)

| ID | Categoria | Descrizione | Severity |
|----|-----------|-------------|----------|
| G-M1-01 … G-M1-05 | Mode 1 | Create from scratch | Mandatory/Default |
| G-M2-01 … G-M2-05 | Mode 2 | Modify a copy | Critical/Mandatory |
| G-M3-01 … G-M3-05 | Mode 3 | Screenshot-to-DS | Mandatory |
| G-M4-01 … G-M4-05 | Mode 4 | Figma link reference | Mandatory |
| G-DOC-1 | Documentation | DS doc overrides generic UX | Mandatory |
| G-GOV-01 … G-GOV-14 | Governance | Componenti, token, layout | Critical/Mandatory/Recommended |
| G-VAR-01 … G-VAR-05 | Variability | Layout, component, content, spacing, composition | Mandatory/Recommended |
| G-OUT-01 … G-OUT-08 | Output | Auto-layout, variables, instances, slot, naming, order, no orphans, text | Critical/Mandatory |
| V-GEN-01 … V-GEN-06 | Validation | componentKey, variableId, variant, slot, action count, no raw values | Critical/Warning |

---

## 12. Note implementative (team interno)

- **Open DS:** manifest JSON pre-indicizzati (component inventory, token map, doc, reference index <4K token); caricati lato server al cambio DS; plugin scarica e mette in cache a sessione.
- **Prompt Kimi:** (1) system prompt con regole da questo ruleset, (2) DS component reference index, (3) DS documentation context, (4) variability_seed, (5) prompt designer, (6) contesto mode (selection, screenshot base64, o struttura da link).
- **Esecuzione plugin:** `figma.createFrame()`, `figma.getNodeById()`, `component.createInstance()`, `instance.setProperties()`, `node.setBoundVariable()`, slot APIs; tutto in un unico `figma.commitUndo()` (un solo Cmd+Z per annullare).
- **Error handling:** timeout LLM 8 s → retry Kimi (fino a 2 retry); validazione fallita → re-request a Kimi con prompt più stretto; errore a metà esecuzione → rollback completo (undo nodi) + messaggio; crediti detratti SOLO dopo canvas render riuscito.

---

*Fonte: COMTRA_Generation_Engine_Ruleset_v1.docx — March 2026. COMTRA by Ben & Cordiska.*
