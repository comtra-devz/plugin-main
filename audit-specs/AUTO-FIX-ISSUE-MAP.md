# Mappatura completa issue → categorie → auto-fix

Documento di riferimento per **allineare UI, crediti e implementazione plugin** su tutti gli audit.  
Aggiornare questo file quando si aggiungono regole, `categoryId` o capacità di fix nel controller.

## Legenda stato auto-fix

| Stato | Significato |
|--------|-------------|
| **implemented** | Il plugin applica una modifica reale al file (o preview + apply come contrasto). |
| **stub** | L’UI consuma crediti / marca fixed ma `apply-fix` nel controller **non** modifica il layer in modo mirato (solo notify / select). |
| **feasible** | Tecnicamente realizzabile con Plugin API (con effort noto). |
| **partial** | Automazione possibile solo per sotto-casi o con assist (es. suggerimento + apply manuale). |
| **manual** | Richiede decisione di design; niente auto-fix automatico affidabile. |
| **n/a** | Issue a livello pagina / advisory senza layer azionabile (`hideLayerActions`). |

## Implementazione oggi (codice)

| Pezzo | Ruolo |
|--------|--------|
| `views/Audit/autoFixConfig.ts` | Crediti default per `categoryId`, override `rule_id`, `ACTION_AUTO_FIX*`. |
| `views/Audit/AuditView.tsx` | `handleFix` → contrast: `get-contrast-fix-preview` + apply; **touch (A11Y)**: `get-touch-fix-preview` + `consumeCredits` + `apply-fix` con `fixPreview`; altri: `apply-fix` con solo `layerId`. |
| `controller.ts` → `apply-fix` | **Contrasto** + `fixPreview`: `applyContrastFix`. **Touch** + `fixPreview`: `applyTouchFix` (padding variabile / hardcoded / resize). **Tutto il resto**: stub generico. |
| `auth-deploy/oauth-server/a11y-audit-engine.mjs` | Emissione issue A11Y con `rule_id` dove indicato. |

---

## 1. Registry categorie (UI)

Le etichette UI sono in `views/Audit/data.ts` (`*_CATEGORIES_CONFIG`).

### Design System (`DS_CATEGORIES_CONFIG`)

| categoryId | Label (UI) |
|------------|------------|
| `adoption` | Adoption Rate |
| `coverage` | Token Coverage |
| `naming` | Naming Accuracy |
| `structure` | Structure |
| `consistency` | Consistency |
| `copy` | Copywriting |
| `optimization` | Optimization |

### Accessibility (`A11Y_CATEGORIES_CONFIG`)

| categoryId | Label (UI) |
|------------|------------|
| `contrast` | Contrast |
| `touch` | Touch target |
| `focus` | Focus state |
| `alt` | Alt text |
| `semantics` | Semantics |
| `color` | Color & OKLCH |

### UX Logic (`UX_LOGIC_CATEGORIES_CONFIG`)

| categoryId | Label (UI) |
|------------|------------|
| `system-feedback` | System Feedback |
| `interaction-safety` | Interaction Safety |
| `form-ux` | Form UX |
| `navigation-ia` | Navigation & IA |
| `content-copy` | Content & Copy |
| `error-handling` | Error & Empty States |
| `data-tables` | Data Tables & Lists |
| `responsive-layout` | Responsive & Layout |
| `cognitive-load` | Cognitive Load |
| `dark-patterns` | Dark Patterns & Ethics |
| `i18n` | Internationalization |

### Prototype (`PROTOTYPE_CATEGORIES_CONFIG`)

| categoryId | Label (UI) |
|------------|------------|
| `flow-integrity` | Flow Integrity |
| `navigation-coverage` | Navigation & Coverage |
| `interaction-quality` | Interaction & Animation |
| `overlay-scroll` | Overlay & Scroll |
| `component-advanced` | Components & Advanced |
| `documentation-coverage` | Documentation & Coverage |

---

## 2. Accessibility (A11Y) — mapping completo engine → categorie → auto-fix

**Fonte codice issue:** `auth-deploy/oauth-server/a11y-audit-engine.mjs` (`collectContrastIssues`, `collectTouchIssues`, `collectFocusIssues`, `collectAltIssues`, `collectSemanticsIssues`, `collectColorIssues`, `collectOKLCHIssues`).  
**Categorie UI:** `views/Audit/data.ts` → `A11Y_CATEGORIES_CONFIG`.  
**Crediti:** `views/Audit/autoFixConfig.ts` (`CREDITS_BY_CATEGORY`, `CREDITS_BY_RULE`).

### 2.1 Tabella unica: `rule_id` × emissione × auto-fix

| rule_id | categoryId | wcag_sc | wcag_level | Severità tipica | `passes` (engine) | Cosa rileva (sintesi) | Auto-fix | Implementazione plugin / note |
|---------|------------|---------|------------|-----------------|-------------------|------------------------|----------|-------------------------------|
| `CTR-001` | `contrast` | 1.4.3 | AA | HIGH/MED | `false` | Testo **normale** &lt; 4.5:1 vs sfondo | **implemented** | `get-contrast-fix-preview` + `applyContrastFix` su `layerId` (TEXT); variabili → stili → hex (stessa tonalità). Target minimo **AA 4.5:1**. **Istanza + main remoto** → preview `external_library`, modale informativa **senza crediti**; **istanza locale** → nota in preview + banner A11Y DS in modale (come touch). |
| `CTR-002` | `contrast` | 1.4.3 | AA | HIGH/MED | `false` | Testo **large** &lt; 3:1 vs sfondo | **implemented** | Come `CTR-001`; target **AA large 3:1**. |
| `CTR-003` | `contrast` | 1.4.6 | AAA | LOW | `false` | AA ok ma normale &lt; 7:1 | **implemented** | Stesso pipeline contrasto; target **AAA 7:1** (preview deve annunciare AAA). |
| `CTR-004` | `contrast` | 1.4.6 | AAA | LOW | `false` | AA ok ma large &lt; 4.5:1 | **implemented** | Come sopra; target **AAA large 4.5:1**. |
| `TGT-001` | `touch` | 2.5.8 | AA | HIGH | `false` | Interattivo &lt; 24×24 **e** altri piccoli a &lt;24px distanza &lt;24px (no eccezione spaziatura) | **implemented** (v1) | `get-touch-fix-preview` / `applyTouchFix`: FLOAT spacing da collection con nome **spacing/layout/…** (priorità) oppure nome variabile euristico; esclusi nomi tipo radius/opacity/blur/…. Istanza → main **locale**; library **remota** → solo messaggio. |
| — | `touch` | — | — | LOW | **`true`** | Stesso undersize AA ma **passa eccezione spaziatura** (cerchi 24px non si sovrappongono) | **manual** | Nessun “errore” WCAG AA da correggere automaticamente; messaggio è advisory (“consider 44×44”). Opzionale: suggerimento UI senza apply. |
| `TGT-003` | `touch` | 2.5.5 | AAA | LOW | `false` | ≥24×24 ma &lt; 44×44 (comfort AAA) | **implemented** (v1) | Stesso flusso con `targetMin: 44` (UI in base a `rule_id`). |
| `CTR-009`* | `focus` | 2.4.13 | AAA | MED | `false` | `COMPONENT` / `COMPONENT_SET` con nome interattivo, **nessun** figlio con nome focus/focused/keyboard | **partial** | Duplicare variante (es. Default → Focus) con stroke/ring; o creare nuova variante + naming `Focus`. Richiede convenzione e idempotenza. *Nota: id regola nel codice è `CTR-009` (legacy); in roadmap si può rinominare in `FCS-001`.* |
| —** | `alt` | — | — | MED/LOW | `false` | Layer non-TEXT con nome generico (`icon`, `image`, `rect`, …) | **partial** | `node.rename` con stringa da template o LLM (rischio falsi positivi). **Raccomandato:** aggiungere in engine `rule_id: ALT-001` e registrarlo in `CREDITS_BY_RULE`. |
| —** | `semantics` | — | — | LOW | `false` | Pagina con &gt;2 text, max font size senza nome heading-like | **manual** | Layer puntato è euristico (`main` text); auto-fix = rename + eventuale gerarchia: meglio guida / checklist. **Raccomandato:** `rule_id: SEM-001`. |
| `CVD-001` | `color` | — | — | MED | `false` | `COMPONENT_SET` con ≥2 figli solo-fill, nome suggerisce stati (error/success/…) | **manual** | Aggiungere icona/label/pattern: decisione di design, non algoritmo sicuro. |
| `CLR-002` | `color` | — | — | LOW | `false` | Advisory **file-level** (≥1 fill solido nel file) | **n/a** | `layerId` = primo child documento o root: non ha senso apply su un layer. UI: nascondere Auto-Fix o `hideLayerActions: true` se backend lo espone. |

\* Nel file engine la costante focus è `CTR-009` (non confondere con contrasto).  
\** Oggi senza `rule_id`; il costo usa solo `CREDITS_BY_CATEGORY.alt` / `semantics`.

### 2.2 Riepilogo categorie A11Y → quante regole / fix

| categoryId (UI) | Regole distinte in engine | Con auto-fix reale oggi | Roadmap prioritaria |
|-----------------|---------------------------|---------------------------|---------------------|
| `contrast` | 4 (`CTR-001` … `CTR-004`) | Sì (tutte e 4) | Estendere a bound variables in preview; master component in library. |
| `touch` | 2 + 1 advisory senza `rule_id` | Sì (`TGT-001`, `TGT-003`) | Affinare euristiche variabili; wrapper hit-area se serve. |
| `focus` | 1 (`CTR-009`) | No | Variante Focus programmatica su `COMPONENT_SET`. |
| `alt` | 1 tipo (senza `rule_id`) | No | `rename` + `ALT-001`. |
| `semantics` | 1 tipo (senza `rule_id`) | No | Solo guida o rename assistito + `SEM-001`. |
| `color` | 2 (`CVD-001`, `CLR-002`) | No | `CVD-001` manuale; `CLR-002` n/a a layer. |

### 2.3 Ordine suggerito di implementazione auto-fix (solo A11Y)

1. **Già fatto:** contrasto (`CTR-001`–`CTR-004`).  
2. **Già fatto (v1):** touch `TGT-001` / `TGT-003` (`get-touch-fix-preview`, `applyTouchFix`, crediti `audit_auto_fix`).  
3. **Focus** `CTR-009`: clone variante + stile focus.  
4. **Alt**: `ALT-001` + rename sicuro (opt-in o preview testuale).  
5. **Semantics / Color / OKLCH**: documentazione + disabilitare pulsante fix dove `n/a` o **manual**.

**Azione schema issue:** aggiungere `rule_id` espliciti `ALT-001` e `SEM-001` in `a11y-audit-engine.mjs` e voci in `CREDITS_BY_RULE` + `hideLayerActions` per `CLR-002` quando il payload sarà arricchito dal backend.

---

## 3. Design System — regole DS-AUDIT-RULES → categoryId → auto-fix

Fonte: `audit-specs/ds-audit/DS-AUDIT-RULES.md`.  
Codice stabile proposto: **`DS-X.Y`** = sezione nel doc (es. `DS-2.1`). Oggi **non** è ancora in `rule_id` sul payload; conviene aggiungerlo quando l’audit DS è deterministico nel plugin.

| Riferimento | categoryId | Auto-fix | Note |
|-------------|------------|----------|------|
| DS-1.1 Detached / deviation | `adoption` | **partial** | Reset override selezionati, o swap `componentId` se esiste variante; spesso serve scelta utente |
| DS-1.2 Orfano | `adoption` | **manual** | Archivia/rimuovi componente |
| DS-1.3 Duplicato | `adoption` | **manual** | Merge varianti |
| DS-1.4 Group → component | `adoption` | **feasible** | `figma.group` inverso: creare component da frame + replace |
| DS-1.5 Molti override | `adoption` | **manual** | Segnale rischio |
| DS-2.1 Fill hardcoded | `coverage` | **feasible** | Bind nearest variable / apply paint style (come contrasto) |
| DS-2.2 Stroke hardcoded | `coverage` | **feasible** | Bind variable / style |
| DS-2.3 Typography hardcoded | `coverage` | **feasible** | Applicare `textStyleId` noto |
| DS-2.4 Spacing non scale | `coverage` | **feasible** | Snap padding/gap al valore scale più vicino |
| DS-2.5 Radius non token | `coverage` | **feasible** | Snap `cornerRadius` |
| DS-2.6 Effects hardcoded | `coverage` | **partial** | Applicare effect style se match |
| DS-2.7 Opacity hardcoded | `coverage` | **feasible** | Variabile opacity dove supportato |
| DS-3.1–3.4 Naming | `naming` | **partial** | Rename layer da suggerimento + conferma |
| DS-4.1–4.5 Structure / auto-layout | `structure` | **partial** | `layoutMode`, `primaryAxisAlignItems`, rimuovi ghost empty |
| DS-5.1–5.4 Consistency | `consistency` | **feasible** | Snap posizione/spacing/font a griglia e type scale |
| DS-6.1–6.3 Copy | `copy` | **manual** | Testo: LLM suggestion, non auto-apply cieco |
| DS-7.1–7.4 (library hygiene) | misto (`adoption` / `coverage`) | **manual** / **partial** | Vedi sezioni 7.x |
| DS-OPT-1 Famiglie ridondanti | `optimization` | **manual** | Merge componenti; wizard Phase 2 |
| DS-OPT-2 Slot mancanti | `optimization` | **feasible** | Aggiungere slot via componentPropertyDefinitions |
| DS-OPT-3 Token da estrarre | `optimization` | **feasible** | Create variable + bind (come DS-2.1) |
| DS-OPT-4 Varianti da introdurre | `optimization` | **partial** | Consolidare in component set; richiede wizard |

Oggi in UI queste issue sono per lo più **stub** se l’utente preme Auto-Fix (stesso comportamento generico `apply-fix`).

---

## 4. UX Logic — UXL-001…064 → categoryId → auto-fix

Fonte regole: `audit-specs/ux-logic-audit/UX-LOGIC-AUDIT-RULES.md`.  
Output atteso: `rule_id: UXL-NNN`, `categoryId` come da tabella riepilogo nel doc.

| ID | categoryId | Auto-fix | Note |
|----|------------|----------|------|
| UXL-001–006 | `system-feedback` | **partial** | Spesso = aggiungere varianti (loading/success/error): creazione varianti programmatica possibile ma fragile |
| UXL-007–011 | `interaction-safety` | **manual** | Close su modal, conferme: richiede layout |
| UXL-012–019 | `form-ux` | **partial** | Label: aggiungere TEXT sibling; error variant: duplicare component set |
| UXL-020–025 | `navigation-ia` | **manual** | Wayfinding |
| UXL-026–031 | `content-copy` | **manual** | Riscrittura testo |
| UXL-032–037 | `error-handling` | **partial** | Empty frame template |
| UXL-038–043 | `data-tables` | **partial** | Allineamento testo, component properties |
| UXL-044–048 | `responsive-layout` | **partial** | Auto-layout, constraint, duplicare breakpoint |
| UXL-049–053 | `cognitive-load` | **manual** | Riorganizzazione IA |
| UXL-054–058 | `dark-patterns` | **manual** | Review etico, no auto-apply |
| UXL-059–064 | `i18n` | **partial** | Resize container, min width su button; date format manual |

Il campo `AuditIssue.autoFixAvailable` (in `types.ts`) può essere impostato **per issue** quando il backend/agente sa che esiste un percorso `feasible`/`partial` implementato nel plugin.

---

## 5. Prototype — P-01…P-20 → categoryId → auto-fix

Fonte: `audit-specs/prototype-audit/PROTOTYPE-AUDIT-RULES.md`, implementazione: `controller.ts` (`runProtoAudit`).

**Piano implementazione, spiegazioni P-12/P-13/P-17/P-08, motion DS, fasi A–C vs Before go live:**  
→ **`audit-specs/prototype-audit/PROTOTYPE-AUTO-FIX-ROADMAP.md`**

| rule_id | categoryId | hideLayerActions (UI) | Auto-fix | Note |
|---------|------------|------------------------|----------|------|
| P-01 | `flow-integrity` | no | **partial** | Non si può “indovinare” la destinazione; possibile: aprire prototipo sul frame + suggerimento |
| P-02 | `flow-integrity` | no | **manual** | Connettere a flusso |
| P-03 | `flow-integrity` | **sì** (nessun flow start su pagina) | **n/a** | Pagina-level |
| P-03 | `flow-integrity` | no (start senza uscite) | **partial** | Potenziale: placeholder interaction (risky) |
| P-04 | `flow-integrity` | no | **feasible** | Rimuovere reaction con `destinationId` invalido o aprire pannello prototipo |
| P-05 | `navigation-coverage` | no | **partial** | Aggiungere azione Back verso sorgente se nota nel grafo |
| P-06 | `navigation-coverage` | no | **manual** | Ricollegare grafo |
| P-07 | `navigation-coverage` | no | **partial** | Evidenziare ciclo; uscita richiede design |
| P-08 | `interaction-quality` | no | **feasible** | Rimuovere la reaction **segnalata come inadatta** (duplicato stesso trigger); payload con reaction index da eliminare |
| P-09 | `interaction-quality` | no | **manual** | Rinominare layer per Smart Animate |
| P-10 | `interaction-quality` | no | **feasible** | `transition.duration` entro range; ideale: allineare a **motion tokens / doc DS** se presenti nel file |
| P-11 | `interaction-quality` | no | **feasible** | Easing coerente per tipo azione; ideale: stesso riferimento **motion DS** |
| P-12 | `overlay-scroll` | no | **feasible** | Impostare overlay settings (position, dismiss) dove API lo consente |
| P-13 | `overlay-scroll` | no | **feasible** | Impostare `overflowDirection` sul frame |
| P-14 | `component-advanced` | no | **manual** | Varianti componente |
| P-15 | `component-advanced` | no | **partial** | Creare variabile mancante; bind type mismatch manual |
| P-16 | `component-advanced` | no | **manual** | Espressioni condizionali |
| P-17 | `component-advanced` | no | **feasible** | Riordinare `actions` array sul trigger |
| P-18 | `documentation-coverage` | no | **feasible** | Rinominare flow starting point (se esposto da API) |
| P-19 | `documentation-coverage` | no | **partial** | Aggiungere reaction vuota / Navigate to placeholder (sconsigliato senza conferma) |
| P-20 | `documentation-coverage` | **sì** | **n/a** | Advisory pagina (>5 flow) |

---

## 6. Crediti e prossimi passi

1. **A11Y:** `CREDITS_BY_RULE` in `autoFixConfig.ts` copre già tutti i `rule_id` numerici dell’engine (`CTR-*`, `TGT-*`, `CVD-001`, `CLR-002`). Quando si introducono `ALT-001` / `SEM-001` (o si rinominano regole), aggiornare la mappa e i crediti.  
2. Per ogni regola con stato **feasible** / **partial**, task dedicato: handler in `controller.ts` (es. `apply-touch-fix`, `apply-focus-variant`, `apply-proto-fix` con `rule_id` + payload) invece dello stub generico `apply-fix`.  
3. Impostare `hideLayerActions` e/o `autoFixAvailable` sul payload issue per evitare promesse false in UI (priorità: `CLR-002`, issue touch con `passes: true`, semantics).

---

## Riferimenti incrociati

| Argomento | File |
|-----------|------|
| Crediti | `audit-specs/a11y-audit/AUTO-FIX-CREDITS-MAPPING.md`, `views/Audit/autoFixConfig.ts` |
| A11Y regole testuali | `audit-specs/a11y-audit/ISSUE-TYPES.md`, `A11Y-AUDIT-RULES.md` |
| DS regole | `audit-specs/ds-audit/DS-AUDIT-RULES.md` |
| UX regole | `audit-specs/ux-logic-audit/UX-LOGIC-AUDIT-RULES.md` |
| Prototype regole | `audit-specs/prototype-audit/PROTOTYPE-AUDIT-RULES.md` |
| Schema issue | `audit-specs/*/OUTPUT-SCHEMA.md`, `types.ts` → `AuditIssue` |
