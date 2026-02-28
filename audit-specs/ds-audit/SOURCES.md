# Fonti autorevoli per le regole di Design System Audit

Le regole in `DS-AUDIT-RULES.md` sono allineate alle best practice e ai criteri raccomandati dalle seguenti fonti. Usare questo elenco per citazioni, approfondimenti e per estendere le regole in modo coerente.

---

## 1. Design Systems 101 (ricerca usabilità)

**Link:** [Risorsa 1 — Design Systems 101](https://www.nngroup.com/articles/design-systems-101/)

**In sintesi:** Definizione di design system come “complete set of standards” con componenti e pattern riutilizzabili. Distinzione tra **style guide** (linee guida visive, branding, tone of voice), **component library** (elementi UI con nome univoco, stati, attributi, descrizione, do’s and don’ts) e **pattern library** (raggruppamenti e layout). Enfasi su linguaggio condiviso, consistenza visiva e manutenzione continua; design system come “functional toolkit” non come portfolio.

**Criteri usati nelle regole:** Nomi univoci e descrittivi per i componenti (→ naming, 3.1, 3.3); descrizione e contesto d’uso (→ 7.1); ridondanza e duplicati (→ adoption 1.2, 1.3); single source of truth (→ 1.1).

---

## 2. Design Systems 102 (eBook/report)

**Link:** [Risorsa 2 — Design Systems 102 (report)](https://www.figma.com/reports/design-systems-102/)

**In sintesi:** Report scaricabile che accompagna il blog: come costruire un design system nell’editor, definire le fondazioni e capire i problemi che il sistema risolve. Contenuto dettagliato disponibile nel report; per i criteri operativi si fa riferimento al post del blog (sotto).

---

## 3. Design system 102: How to build your design system (blog editor design)

**Link:** [Risorsa 3 — Design system 102: How to build (blog)](https://www.figma.com/blog/design-systems-102-how-to-build-your-design-system/)

**In sintesi:** Guida in tre step: (1) **Lay the groundwork** — obiettivi, inventory design/code, organizzazione, champion, principi guida; (2) **Define foundations** — accessibilità (contrast, font size, labels), colore (palette bilanciata, es. 60% neutri, 30% primary, 10% accent), tipografia (type scale, base 16px), elevation, iconografia (griglia, nomi descrittivi), **token** (variabili semantic vs primitive, naming base+modifier, allineamento design–code), **spatial system** (spacing, grid, 8px); (3) **Build nell’editor** — naming semantico (funzione non aspetto, es. `color-warning`, `surface-primary`), component properties, organizzazione library, collegamento design–code.

**Criteri usati nelle regole:** Token/variabili semantiche e scale (→ coverage 2.x, consistency 5.x); naming semantico (→ 3.1, 3.2); type scale e base 16px (→ 2.3, 5.3); spacing/grid 8px (→ 2.4, 5.1, 5.2); accessibilità (→ 7.4); palette bilanciata (→ possibile estensione coverage).

---

## 4. Design System Resources for Designers (portale UX)

**Link:** [Risorsa 4 — Design System Resources for Designers](https://uxplanet.org/design-system-resources-for-designers-in-2024-2b7a4fe3dff6)

**In sintesi:** Definizione comune: design system come set di standard per gestire e scalare il design, con componenti riutilizzabili, principi e linee guida. Lista curata di repository, articoli, libri, sistemi open source e community; utile per allineare il lessico e le aspettative (consistency, efficiency, single source of truth).

**Criteri usati nelle regole:** Coerenza con la definizione “standards + reusable components + guidelines” (→ categorie adoption, coverage, consistency).

---

## 5. The Ultimate Design Systems Resources List (guida design strategy)

**Link:** [Risorsa 5 — The Ultimate Design Systems Resources List](https://designstrategy.guide/the-ultimate-design-systems-resources-list/)

**In sintesi:** Lista estesa di risorse su design system (guide, tool, esempi). Utile per approfondimenti e per confrontare le regole con altre checklist e framework.

---

## 6. Design Systems: A List of Resources (portale design/prototyping)

**Link:** [Risorsa 6 — Design Systems: A List of Resources](https://blog.prototypr.io/design-systems-a-list-of-resources-480ebb767fff)

**In sintesi:** Design system definito come “collection of reusable components, guided by clear standards”; distinzione da pattern library e style guide (sottoset). Enfasi su design system come “living product”, collaborazione design/engineering, efficienza e consistenza. Riferimenti a metodologie atomic design, component checklist, naming e stakeholder buy-in.

**Criteri usati nelle regole:** Componenti riutilizzabili e standard chiari (→ adoption, coverage); naming e struttura (→ naming, structure); “living product” e manutenzione (→ adoption, orfani/duplicati).

---

## Uso nelle regole

- **DS-AUDIT-RULES.md**: dove una regola deriva esplicitamente da una di queste fonti, è indicato in nota (es. “fonti 1–3”).
- Per **nuove regole** o **severity**: verificare coerenza con le fonti su usabilità, variabili, component properties, naming e con le definizioni condivise (component library, token, semantic naming).
- **Problematiche ricorrenti (community/forum):** documentate in **RECURRING-PROBLEMS.md** (100 thread, cluster forum, community, repository, governance, multi‑product). La regola **1.5** (istanza con molti override → rischio breakage) e la mappatura severity 1–5 ↔ HIGH/MED/LOW derivano da questa analisi.
