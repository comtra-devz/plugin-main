
# Comtra Design Standards & Logic Guide (The Antigravity Bible)

Questa guida definisce le regole "Hard" e "Soft" che Comtra utilizza per valutare, generare e sincronizzare le interfacce. L'AI deve fare riferimento a questo documento per ogni decisione di Audit o Generazione.

---

## 0. THE KILLER FEATURE: Component Contract Validator

Ogni componente analizzato o generato deve superare questo "Contratto di Qualità". Se manca uno di questi punti, Comtra segnala: **"Component not production-ready"**.

1.  **Variants Completeness**: Esistono tutti gli stati? (Default, Hover, Active, Focus, Disabled, Loading, Error, Read-only).
2.  **Token-Only Styling**: 100% delle proprietà visive sono mappate a variabili semantiche. 0 Hex, 0 Pixel raw.
3.  **Responsive Rules**: Constraints definiti per Mobile, Tablet e Desktop.
4.  **Code Mapping**: Il nome e le varianti corrispondono 1:1 alle Props del componente React/Vue.
5.  **A11y Metadata**: `aria-label` e ruoli definiti.

---

## 1. Heuristic Audit (Nielsen + Modern)
Verifica l'usabilità psicologica dell'interfaccia.
*   **Visibility of system status**: Loader, skeleton, feedback dopo azioni (salvataggio, errore, sync).
*   **Match between system and real world**: Naming coerente con dominio (“Clienti” vs “Utenti”, “Fatture” vs “Documenti”).
*   **User control and freedom**: Undo, annulla, back, escape, close.
*   **Error prevention**: Conferme solo dove serve, disabilitare CTA se invalid, hint pre-submit.
*   **Recognition rather than recall**: Evitare UI che richiede memoria (placeholder non basta).
*   **Flexibility and efficiency of use**: Shortcut, quick actions, bulk selection, search.
*   **Aesthetic and minimalist design**: Segnala ridondanze (2 CTA primarie, troppe info above the fold).
*   **Help users recover from errors**: Error copy con suggerimento azione, non solo “errore generico”.
*   **Help and documentation**: Tooltip, helper text, link “learn more”.

## 2. Content Design & Tone of Voice
*   **CTA verbs**: Sempre verbi attivi (“Salva”, non “Ok”).
*   **Consistency linguistica**: Tu/lei/voi, formalità, punteggiatura coerente.
*   **Error messages structure**: Cosa è successo + perché + come risolvere.
*   **Empty state structure**: Cosa manca + perché + next action.
*   **No dark patterns**: No copy manipolativa, no colpevolizzazione (“hai sbagliato”).
*   **Numeri e formati**: Date/valute/unità sempre locali (it-IT, en-US).
*   **Troncamenti**: Se testo va in ellipsis, deve esserci tooltip o layout alternativo.

## 3. Internationalization & Localization Engineering
*   **Plural rules**: Segnala copy non pluralizzabile (0, 1, many).
*   **String concatenation ban**: “Ciao ” + name -> genera errori in traduzione.
*   **RTL readiness**: Layout mirror, icone direzionali, allineamenti.
*   **Text expansion**: Container pronti per DE, RU, FI (+30% width).
*   **Line breaks**: Evitare `\n` hardcoded nei componenti UI.

## 4. Interaction States Completeness
Per ogni componente interattivo deve esistere una Variant mappabile a codice per:
*   Default, Hover, Active/Pressed, Focus.
*   Disabled, Loading, Error (input), Success, Read-only.

## 5. Form UX Rules
*   **Labels**: Sempre visibili (placeholder non è label).
*   **Helper vs Error**: Non devono collassare il layout (shift).
*   **Required**: Indicatore standard (asterisco/testo).
*   **Validation**: Inline + Submit.
*   **Pattern**: Password show/hide, keyboard type (mobile), autocomplete hints.

## 6. Data & Table Rules
*   **Alignment**: Colonne allineate (numeri a destra).
*   **Features**: Header sticky, sort indicators, pagination vs infinite scroll.
*   **States**: Empty state / Loading skeleton.
*   **Actions**: Row selection e bulk actions.
*   **Density**: Varianti comfortable/compact.

## 7. Design Token Governance
*   **Semantic Priority**: Vietato usare token raw (es. blue.500) in UI finali.
*   **Token Layering**: Primitive → Semantic → Component tokens.
*   **Naming**: Rules (es. `color.text.primary`).
*   **Deprecation**: Token vecchi usati in nuove UI.
*   **Dynamic Tokens**: Elevation, blur, motion, radius.

## 8. Motion & Animation Rules
*   **Duration**: Standard (150/200/300ms).
*   **Curve**: Easing standard.
*   **A11y**: Reduce motion (prefers-reduced-motion).
*   **Feedback**: Skeleton preferito a spinner. No "fun animations" su azioni critiche.

## 9. Responsive Behavior Audit
*   **Breakpoints**: Mapping mobile/tablet/desktop.
*   **Reflow**: Cosa collassa, cosa va sotto.
*   **Max-width**: Contenuti leggibili (es. 1200px).
*   **Wrapping**: Text wrapping rules.
*   **SafeArea**: iOS notch handling.

## 10. Navigation & IA
*   **Naming**: Menu coerente.
*   **Breadcrumbs**: Per gerarchie profonde.
*   **Active State**: Indicatore "Current Location".
*   **Back Nav**: Regole chiare (Modal vs Page).

## 11. Error Handling & Edge Cases
*   **Content**: Nomi lunghissimi, indirizzi su 3 righe.
*   **Numbers**: 1.000.000 (overflow).
*   **Data**: No data / Partial data / Offline.
*   **Network**: Errori 403/404/500, Retry pattern.

## 12. Security & Privacy UI (GDPR)
*   **Masking**: Password display rules, dati sensibili (IBAN).
*   **Confirmation**: Destructive actions (Delete).
*   **Danger Zone**: Audit visuale per aree critiche.
*   **Consent**: Checkbox privacy non pre-flaggate.

## 13. Component API Design Rules
*   **Props**: Standard (variant, size, state).
*   **Boolean**: Naming (hasIcon, isOpen).
*   **Explosion**: Max 8-10 props principali.
*   **Composition**: Slot-based (iconLeft).
*   **A11y Props**: `aria-label`, `aria-describedby`.

## 14. Layout Semantics & HTML Mapping
*   **Structure**: Card list -> `<ul><li>`, Navigation -> `<nav>`.
*   **Modal**: Dialog semantics + focus trap.
*   **Headings**: Mappati a H1-H6.
*   **Actions**: Link (`<a>`) vs Button (`<button>`).
*   **Forms**: `<fieldset><legend>`.

## 15. Performance UI Rules
*   **Nesting**: Limitare frame dentro frame (>6 livelli).
*   **Effects**: Evitare blur pesanti e shadow multiple.
*   **Images**: Dimensioni definite.
*   **Icons**: SVG Clean (appiattite).

## 16. QA Visual Regression Rules
*   **Snapshot**: Baseline per componenti principali.
*   **Tolerance**: Threshold 1-2px.
*   **Typography**: Drift detection (line-height).
*   **Fallback**: Font mismatch.

## 17. Governance Design System
*   **Strategy**: Quando creare nuovo componente vs variante.
*   **Versioning**: DS v1/v2.
*   **Changelog**: Regola di deprecazione.

## 18. Design Ethics & Inclusivity
*   **Language**: Inclusivo, gender neutral.
*   **Assets**: Evitare stereotipi nelle immagini.
*   **Color**: Attenzione al daltonismo (non usare solo rosso/verde).

## 19. AI Generation Safety (Anti-Hallucination)
*   **Reuse**: Non inventare componenti se esiste equivalente.
*   **No Guessing**: Non inventare token; fallback su semantici.
*   **Ask**: Se manca info, chiedere.

## 20. Output Report Standard
Ogni issue deve seguire questo schema JSON:
```json
{
  "id": "uuid",
  "category": "String",
  "severity": "HIGH|MED|LOW",
  "nodeId": "ref",
  "description": "Text",
  "suggestedFix": "Text",
  "autoFixAvailable": true,
  "fixConfidence": 0.9,
  "references": ["Heuristic #1", "WCAG 1.4"]
}
```

## 21. Conflict Resolution & Priority Matrix
Quando due o più regole entrano in conflitto, l'Audit Engine deve seguire questa gerarchia decisionale rigorosa:

### A. The Golden Priority Stack (Enforcement Order)
1.  **Accessibility (A11y) & Legal**: (WCAG AA/AAA, GDPR). *Non negoziabile.* Se un testo è "bello" ma illeggibile, vince la leggibilità.
2.  **Security & Data Integrity**: (Privacy, Error Prevention). *Critico.* Se una CTA è minimalista ma manca di conferma distruttiva, vince la conferma.
3.  **Design System Consistency**: (Tokens, Components). *Alto.* Se un layout è ottimizzato ma usa hex hardcoded, vince il Token System.
4.  **UX Patterns & Heuristics**: (Usability, Flow). *Medio.* Regole di usabilità standard.
5.  **Visual Polish & Density**: (Aesthetics, Spacing). *Basso.* Preferenze soggettive o ottimizzazioni visuali.

### B. Common Conflict Scenarios
*   **Density vs Readability**: Vince Readability. (Es. Non comprimere una tabella per mostrare più righe se il font scende sotto 12px o il touch target sotto 32px).
*   **Skeleton vs Performance**: Vince Performance. (Es. Non caricare skeleton complessi con gradienti animati se rallentano il Time To Interactive; preferire loader semplici o background neutri).
*   **Consistency vs Context**: Vince Context (Raramente). (Es. Se il componente standard "Card" non supporta legal text obbligatorio, è permesso il "detach" e refactor locale, ma va segnalato come "Authorized Deviation").
