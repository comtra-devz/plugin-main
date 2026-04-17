# Design Intelligence Input Pack — Specifica per altra IA (Comtra / Figma)

**Versione:** 1.1 (allineata al pack v2)  
**Scopo:** Questo documento è pensato per essere dato **in pasto a un’altra IA** che deve produrre un **pack di input** per il motore Comtra Generate. Non si assume conoscenza del repository né di Figma Plugin API.

**Riferimento completo v2 (testi, famiglie, inference, wizard, learning loop, gerarchia, test):** [`docs/DESIGN-INTELLIGENCE-PACK-v2.md`](./DESIGN-INTELLIGENCE-PACK-v2.md) — copia canonica nel repo del *Design Intelligence Pack* 2.0.

---

## 1) Contesto prodotto (cos’è Comtra Generate)

- **Comtra** è un plugin Figma con tab **Generate**.
- L’utente descrive uno schermo (prompt); il sistema produce un **piano strutturato** (JSON “action plan”) che il plugin applica sulla **pagina corrente** di Figma creando frame, testi, rettangoli e **istanze di componenti** del Design System.
- Per **Design System “Custom (Current)”** il sistema usa un **indice** costruito dal file Figma (`ds_context_index`): componenti (nome, id, chiave pubblicata quando c’è), variabili, stili, pagina di provenienza, ecc.
- Il backend (es. deploy Vercel) chiama un LLM (es. Kimi) con prompt di sistema + contesto; il **thread main** del plugin esegue il piano con **Figma Plugin API**.

**Non è:** export automatico di tutto il file Figma in immagine da ridisegnare a mano libera.  
**È:** generazione vincolata a componenti/token/regole note o inferibili.

---

## 2) Architettura a due mondi (obbligatorio da capire)

| Luogo | Cosa gira | Cosa può fare |
|--------|-----------|----------------|
| **UI del plugin** (webview) | React | Chiede contesto file, invia `POST` al backend, riceve JSON, manda messaggi al `main` |
| **Main thread Figma** (`code.js` / controller) | JavaScript sandbox Figma | `createFrame`, `createText`, `createInstance`, `setProperties`, variabili, auto-layout, lettura nodi |
| **Backend** | Node / serverless | LLM, validazioni, ranking, merge con `ds_context_index` |

**Regola:** l’altra IA che prepara il pack **non** esegue codice in Figma; produce **dati** (JSON / markdown strutturato) che noi incorporeremo o mapperemo nel pipeline.

---

## 3) Concetti Figma che il pack deve riflettere (senza ambiguità)

### 3.1 Pagine e ordine

- In Figma, i **Page** sono figli di `Document` nell’ordine del pannello Pagine.
- I componenti vivono **dentro** una pagina (o in sottogruppi). Il pack può referenziare regole tipo: “componenti il cui nome contiene `Button` e la **pagina** contiene `Buttons` hanno priorità su pagine `Selection Cards`”.

### 3.2 Componenti vs varianti

- **COMPONENT**: singolo master.
- **COMPONENT_SET**: famiglia di varianti; le varianti sono figli `COMPONENT` nel set.
- L’indice Comtra oggi privilegia set + componenti standalone; per varianti specifiche il piano può usare `variantProperties` / `componentProperties` coerenti con le definizioni Figma.

### 3.3 Istanze e proprietà

- **Instance** = istanza di un componente.
- **Component property definitions** (Figma): tipi comuni `BOOLEAN`, `TEXT`, `INSTANCE_SWAP`, varianti enum, ecc.
- Il plugin può chiamare `instance.setProperties({ ... })` con chiavi **esattamente** come nel file (spesso con suffissi `#123:456` in Figma; il pack deve usare i nomi logici che mapperemo o elenco esplicito chiave→significato).

### 3.4 Auto layout

- **Frame** con `layoutMode` `VERTICAL` / `HORIZONTAL`: `itemSpacing`, `padding*`, `layoutSizingHorizontal` / `layoutSizingVertical` (`FIXED`, `HUG`, `FILL`).
- “Gap banale” = stesso `itemSpacing` ovunque; il pack deve definire **spacing per segmento** (es. dopo titolo 8, tra campi 12, prima CTA 24).

### 3.5 Token / variabili

- Variabili locali o da librerie collegate: il piano può referenziarle per nome o binding se il DS lo espone.
- Se il pack chiede token che non esistono nel file, la validazione può fallire o degradare: va indicato cosa è **obbligatorio** vs **fallback numerico**.

---

## 4) Cosa esiste già nel repo (per l’altra IA: non reinventare)

Riferimenti utili (percorsi relativi alla root del repo `plugin-main-1`):

| Cosa | Dove |
|------|------|
| Indice DS da Figma (`pageName`, `pageOrder`, componenti, …) | `ds-context-index.ts` |
| Esecuzione piano su canvas | `action-plan-executor.ts` |
| Chiamata generate dal plugin | `App.tsx` → `fetchGenerate` |
| UI Generate | `views/Generate.tsx` |
| Wizard import DS + tabella warning | `views/GenerateDsImport.tsx` |
| Endpoint generate + ranking slot | `auth-deploy/oauth-server/app.mjs` |
| Prompt sistema LLM | `auth-deploy/prompts/generate-system.md` |
| Piano conversazionale + trace implementato | `docs/GENERATE-CONVERSATIONAL-UX-IMPLEMENTATION-PLAN.md` |
| Policy gate | `docs/GENERATE-GATES-POLICY-MATRIX.md` |

Override utente (già supportato lato API, da UI futura):

- `POST /api/agents/generate` body: `component_assignment_overrides`  
  Formato: `{ "<slot_id>": { "component_key": "...", "component_node_id": "123:456" } }`

---

## 5) Cosa deve produrre l’altra IA (deliverable chiaro)

L’altra IA deve produrre **un unico artefatto** (scelta A o B):

### Opzione A — `design_intelligence_pack.json` (consigliato)

Un JSON **valido** con le sezioni sotto. Tutte le chiavi in `snake_case`. Nessun commento dentro il JSON.

### Opzione B — `design_intelligence_pack.md` + blocchi `json`

Markdown con sezioni e un blocco ```json per ogni sezione; noi lo assembleremo in parser.

---

## 6) Schema sezioni del pack (obbligatorie e opzionali)

### 6.1 `meta` (obbligatorio)

```json
{
  "meta": {
    "pack_version": "1.0",
    "target_product": "comtra_generate",
    "language": "it",
    "notes_for_engineers": "stringa libera breve"
  }
}
```

### 6.2 `spacing_rhythm` (obbligatorio per qualità gap)

Definisce **scala** e **regole per relazione tra segmenti**, non un solo numero.

```json
{
  "spacing_rhythm": {
    "scale": [4, 8, 12, 16, 24, 32],
    "rules": [
      {
        "id": "title_to_description",
        "when": { "archetypes": ["login", "auth"] },
        "gap_px": 8
      },
      {
        "id": "description_to_form",
        "when": { "archetypes": ["login"] },
        "gap_px": 24
      },
      {
        "id": "field_to_field",
        "when": { "archetypes": ["login", "form"] },
        "gap_px": 12
      },
      {
        "id": "form_to_primary_cta",
        "when": { "archetypes": ["login"] },
        "gap_px": 24
      }
    ],
    "frame_horizontal_padding_mobile_px": 16
  }
}
```

**Cosa genera l’IA da sola:** valori numerici coerenti con la scala e con best practice (non inventare nomi token se non servono).  
**Cosa deve leggere/conoscere l’IA:** se il DS ha token spacing, può opzionalmente mappare `gap_px` → nome token in `token_bindings` (sezione opzionale).

### 6.3 `layout_patterns` (obbligatorio per “centinaia di pattern”)

Lista di pattern **nome + struttura ordinata di segmenti**. Ogni segmento è un blocco logico.

```json
{
  "layout_patterns": [
    {
      "id": "login_mobile_minimal",
      "archetypes": ["login", "auth"],
      "viewport": "mobile",
      "segments": [
        { "slot": "brand_logo", "optional": true },
        { "slot": "title_block", "optional": false },
        { "slot": "description_block", "optional": true },
        { "slot": "email_input", "optional": false },
        { "slot": "password_input", "optional": false },
        { "slot": "primary_cta", "optional": false },
        { "slot": "secondary_action", "optional": true }
      ],
      "anti_patterns": [
        "Do not use card containers for primary CTA on login",
        "Do not use progress/step components for login fields"
      ]
    }
  ]
}
```

**Cosa genera l’IA da sola:** nuovi `id` pattern, segmenti, anti-pattern testuali.  
**Cosa deve conoscere:** naming degli slot deve essere **stabile** rispetto a quello che il motore Comtra già usa (`email_input`, `password_input`, `primary_cta`, …) oppure fornire una tabella `slot_aliases`.

### 6.4 `slot_definitions` (obbligatorio se si usano slot custom)

Per ogni `slot` usato nei pattern:

```json
{
  "slot_definitions": {
    "primary_cta": {
      "intent": "single primary action for the screen",
      "page_name_hints": ["button", "action", "cta"],
      "name_regex_hints": ["(?i)button", "(?i)cta"],
      "forbidden_name_regex": ["(?i)card(?!.*button)"]
    }
  }
}
```

**Cosa genera l’IA:** regex e hint pagina.  
**Cosa legge l’IA dal DS (se gli passi export):** elenco pagine e nomi componenti; altrimenti resta generico e noi applicheremo dopo.

### 6.5 `content_defaults` (obbligatorio per anti-placeholder)

Testi di fallback quando il prompt utente è povero, **per archetype + pattern**.

```json
{
  "content_defaults": {
    "login_mobile_minimal": {
      "title": "Accedi",
      "description": "Inserisci le tue credenziali per continuare.",
      "email_placeholder": "Email",
      "password_placeholder": "Password",
      "primary_cta": "Accedi",
      "secondary_action": "Password dimenticata?"
    }
  }
}
```

**Cosa genera l’IA da sola:** copy in lingua prodotto.  
**Cosa fa il motore:** mappa questi testi su `CREATE_TEXT` o su `TEXT` properties delle istanze quando i nomi proprietà sono noti (vedi 6.6).

### 6.6 `component_property_playbook` (fortemente consigliato)

Per componenti “chiave” del DS (per nome o per slot), indicare proprietà Figma e valori consigliati.

```json
{
  "component_property_playbook": [
    {
      "match": { "slot": "title_block", "component_name_regex": "(?i)title" },
      "properties": [
        {
          "property_name_regex": "(?i)show.*description|description.*visible",
          "type": "BOOLEAN",
          "when_prompt_missing": "icon_or_logo",
          "value": false
        },
        {
          "property_name_regex": "(?i)title|heading",
          "type": "TEXT",
          "value_from": "content_defaults.title"
        }
      ]
    }
  ]
}
```

**Cosa genera l’IA:** regex sui nomi proprietà (perché Figma spesso suffissa gli id).  
**Cosa deve ricevere l’IA (ideale):** export da Figma di `componentPropertyDefinitions` per i componenti Title/Button (anche screenshot tabella proprietà va bene come allegato umano, ma per automazione serve lista chiavi).

### 6.7 `token_bindings` (opzionale)

Se vuoi gap/padding legati a token:

```json
{
  "token_bindings": {
    "field_to_field": { "variable": "spacing/md" }
  }
}
```

**Cosa deve conoscere l’IA:** nomi variabili reali nel file o convenzione del DS.

### 6.8 `test_prompts` (obbligatorio per validazione)

Il pack v2 richiede **20** prompt (5 poveri / 5 medi / 5 ricchi / 5 edge) con attesi strutturati (`expected_archetype`, `expected_pattern`, `expected_slots`, `must_not_contain`, `quality_notes`). Il documento v2 in `docs/DESIGN-INTELLIGENCE-PACK-v2.md` è la fonte piena.

**Runtime generate:** i `test_prompts` **non** vengono iniettati nel prompt LLM (solo QA offline). Il motore lo dichiara esplicitamente nel blocco pack v2.

---

## 6bis) Inventario sezioni pack v2 (obbligatorio se `pack_version` ≥ 2.0)

Oltre alle sezioni della §6, il pack v2 include (ordine di dipendenza come nel documento v2):

| Sezione | Ruolo |
|--------|--------|
| `meta` | `pack_version`, `schema_compatibility`, conteggi opzionali, `notes_for_engineers` |
| `archetype_registry` | Famiglie, slot richiesti/opzionali, pattern default mobile/desktop, `never_use_components_matching`, `inference_confidence_boost`, `wizard_override_fields` |
| `archetype_inference_rules` | `keywords_strong`, `keywords_context`, `keywords_negative`, priorità, domande disambiguazione |
| `disambiguation_protocol` | Template `[CONV_UX]` per conflitti noti e bassa confidenza |
| `spacing_rhythm` | Scala px, alias, gap frame, gap tra segmenti, gap intra-componente, section break |
| `viewport_rules` | Dimensioni frame default, differenze strutturali mobile/desktop |
| `layout_patterns` | `segments`, `anti_patterns`, viewport, archetypes |
| `slot_definitions` | Intent, hint pagina, regex nome, divieti |
| `component_property_playbook` | Gerarchia fallback + match per slot/regex nome componente |
| `content_defaults` | Copy per archetype; `kimi_enrichable_fields` e protocollo arricchimento (§9.1 v2) |
| `wizard_integration` | Campi raccolti dal wizard, regole di override, segnali `[CONV_UX]` |
| `learning_loop` | Segnali qualità, schema telemetria, trigger miglioramento (roadmap prodotto) |
| `correction_vocabulary` | In v2: **array** di `{ user_term, ambiguities, resolution }` (diverso dalla mappa 7.1) |
| `hierarchy_rules` | Regole H-001… con `enforcement` hard/soft |
| `test_prompts` | Set di validazione (vedi §6.8) |

Convenzioni v2 documentate nel pack: **`[WIZARD_OVERRIDE]`** (il wizard vince sul default pack), **`[CONV_UX]`** (consumo da UI conversazionale / disambiguazione).

---

## 7) Cosa l’altra IA NON deve assumere

- Non assumere che il pack venga eseguito direttamente da Figma.
- Non assumere nomi esatti di proprietà senza regex o senza export.
- Non assumere che tutti i DS espongano testo editabile come `TEXT` property (alcuni testi sono solo layer interni non esposti).
- Non mescolare “regole prodotto” con “regole legali”: qui solo design/engine.

---

## 8) Come useremo il pack in Comtra (dopo che lo riceviamo)

1. Validazione schema pack (versione); vedi `auth-deploy/design-intelligence/patterns.schema.json` (7.1 + chiavi v2 opzionali).
2. File JSON: `auth-deploy/design-intelligence/patterns.default.json` oppure override `COMTRA_PATTERNS_JSON_PATH`.
3. **Inferenza:** se il JSON contiene `archetype_inference_rules`, il backend usa la logica a due fasi del v2 (strong → context, rispetto `keywords_negative`); altrimenti resta l’euristica legacy `inferFocusedScreenType`. L’archetype v2 viene mappato sulle 8 checklist 7.1 per slot/checklist; vedi `mapPackV2ArchetypeToLegacyScreenKey` in `auth-deploy/oauth-server/design-intelligence.mjs`.
4. **Prompt generate:** `formatDesignIntelligenceForPrompt` concatena blocco **7.1** (se presente) e blocco **pack v2** (se shape v2), con sottoinsiemi per token (pattern/slot/contenuti pertinenti all’archetype inferito).
5. **Metadata piano:** `inferred_pack_v2_archetype` oltre a `inferred_screen_archetype` in `auth-deploy/oauth-server/app.mjs`.
6. **Guardrail auth:** stesso avviso anti step/progress/wizard per archetype v2 auth (`login`, `register`, `forgot_password`, …).
7. **Implementato (plugin + server):** wizard salva `wizard_signals` nello snapshot (`tone_of_voice`, `brand_voice_keywords`); Generate inietta `[WIZARD_SIGNALS]` nel context; se il pack JSON ha `content_defaults` per l’archetype v2 inferito e ci sono segnali wizard, **una chiamata Kimi** produce `[KIMI_CONTENT_ENRICHMENT]`; `metadata.kimi_content_enrichment_used` sul piano; `generate_ab_requests` esteso con `learning_snapshot`, `kimi_enrichment_used`, archetypes, `figma_file_key`; tabella `generation_plugin_events` + `POST /api/generation/plugin-event` (rewrite Vercel → `credits-trophies`); evento `generation_applied` dopo apply su canvas; thumbs duplicati come `user_thumbs_feedback` sugli eventi (best-effort).
9. **Roadmap executor:** spacing per segmento dal pack, `component_property_playbook` strutturato in `action-plan-executor`, merge token spacing da indice variabili, dashboard admin sulle query `generation_plugin_events` / snapshot.

---

## 10) Checklist per chi riceve il pack dall’altra IA

- [ ] `meta.pack_version` presente (1.x o 2.x)
- [ ] Pack 1.x: `spacing_rhythm` con scala + almeno 3 `rules` (se usate)
- [ ] Pack v2: registry + inference rules coerenti; `spacing_rhythm` a livelli (base / frame / segmenti / intra-component) come da v2
- [ ] almeno 3 `layout_patterns` se il target non è solo login
- [ ] `content_defaults` copre gli archetype principali
- [ ] `component_property_playbook` copre Title + Button + Input dove applicabile
- [ ] `test_prompts`: **15** (spec 1.x) o **20** (v2) voci complete per validazione offline

Fine documento.
