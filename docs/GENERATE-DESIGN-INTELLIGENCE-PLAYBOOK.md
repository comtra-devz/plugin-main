# Generate Design Intelligence Playbook

COMTRA by Ben & Cordiska — Aprile 2026

---

## 1. Obiettivo

Questo playbook traduce il workflow "token-first + audit loop" in regole operative per il nostro stack Generate.

Scopo:

- Ridurre output deboli o incoerenti.
- Ridurre i 422 in validazione (`VISIBLE_CONTENT_REQUIRED`, `FILE_DS_INDEX_VIOLATION`, ecc.).
- Aumentare coerenza tra prompt utente, DS context index e action plan finale.

Non sostituisce il motore runtime. E una guida di allineamento per prompt, quality gates e review.

---

## 2. Principi non negoziabili

1. Foundations before components
- Nessuna generazione "component-heavy" senza DS/tokens definiti.

2. Semantic over primitive
- Preferire intento semantico (es. "primary/hover") a valori raw.

3. Single source of truth
- Per `Custom (Current)` la source of truth e il `ds_context_index` verificato lato server.

4. Audit-first iteration
- Ogni output importante passa da check esplicito prima di considerarlo "done".

5. No hardcoded drift
- Evitare istruzioni che spingono il modello a inventare valori non presenti nel DS.

---

## 3. Struttura standard del prompt Generate

Quando utile, mantenere questa struttura logica:

1) Goal
- Cosa deve produrre (una sola schermata coerente, varianti, ecc.).

2) Context
- Tipo target (create/modify/screenshot), vincoli viewport, priorita contenuto.

3) DS constraints
- "Usa solo componenti/tokens presenti nel DS context index".

4) Accessibility baseline
- Focus visibile, contrasto, stati disabled/error dove rilevanti.

5) Output contract
- Action plan valido schema + contenuto visibile a root + no primitive inventate.

---

## 4. Prompt templates (copia/adatta)

### 4.1 Context-setting rapido

Usare all'inizio di una sessione lunga:

```text
System context:
- Brand tone: <professional|playful|minimal|...>
- Platform target: <web|mobile|both>
- Accessibility baseline: WCAG AA
- Input mode: <create|modify|screenshot>

Before generating, summarize back:
1) visual priorities
2) interaction priorities
3) DS constraints you must respect
```

### 4.2 Generation prompt robusto (create)

```text
Create one coherent screen for: <goal>.

Constraints:
- Use only DS components and token refs available in context.
- No hardcoded visual values.
- Keep hierarchy clear: title -> core content -> primary action.
- Include visible, meaningful content in root (not only empty frame shells).
- Respect accessibility basics (focus visibility, readable contrast, disabled states where needed).

Output:
- Return only the action plan JSON object following schema.
```

### 4.3 Audit prompt (post-generation)

```text
Audit this output for:
1) DS coverage: any value not bound/mapped to DS?
2) Visible content: does root contain real user-visible primitives?
3) Naming consistency for refs and blocks.
4) State coverage (default/hover/focus/error when applicable).
5) Accessibility baseline.

Return: score + critical issues first + concrete fixes.
```

---

## 5. Quality gates (mappati ai nostri errori)

Prima di considerare un risultato accettabile, verificare:

Gate A - Schema valid
- Allineato a `validateActionPlanSchema`.

Gate B - DS package valid
- Allineato a `validateActionPlanAgainstDs`.

Gate C - Visible root content
- Allineato a `validateActionPlanVisiblePrimitives`.
- Se fallisce: tipicamente `VISIBLE_CONTENT_REQUIRED`.

Gate D - Public DS instance rule
- Allineato a `validateActionPlanNoInstanceForPublicDs`.

Gate E - File DS index compliance
- Allineato a `validateActionPlanAgainstFileDsIndex`.
- Se fallisce: tipicamente `FILE_DS_INDEX_VIOLATION`.

Regola pratica: se un gate fallisce, non "patchare a mano" con workaround visivi casuali; correggere prompt/intent e rigenerare.

---

## 6. Anti-pattern da evitare

- Saltare foundations e chiedere subito componenti complessi.
- Prompt vaghi ("rendilo bello") senza vincoli di DS e output.
- Richieste multi-obiettivo in un singolo passaggio.
- Accettare output senza audit minimo.
- Introdurre valori hardcoded "temporanei".

---

## 7. Token budget e session strategy

Per limitare sprechi:

- Preferire prompt specifici e compatti.
- Spezzare il lavoro in blocchi (fondazioni, poi component class).
- Fare checkpoint sintetici tra i blocchi.
- Evitare iterazioni lunghe in un singolo thread senza recap.

Template recap sessione:

```text
Session recap:
- What was finalized
- What remains blocked
- Risks to watch
- Next exact prompt to run
```

---

## 8. Storybook handoff checklist (pragmatica)

Quando una famiglia componenti e pronta:

- Token map chiara (semantic -> primitive alias).
- Props/variants allineate ai nomi DS.
- States documentati (default/hover/focus/disabled/error).
- Esempi React/Storybook senza valori hardcoded.
- Dark mode/tema verificato su semantic tokens.

---

## 9. Come usarlo in COMTRA (subito)

1) Usa i template di sezione 4 per i test di prompt in Generate.
2) Valuta i fallimenti rispetto ai gate di sezione 5.
3) Registra nei report solo issue che violano gate o anti-pattern.
4) Aggiorna questo file quando emerge un nuovo pattern ricorrente.

Owner consigliato: team Generate/DS import.

