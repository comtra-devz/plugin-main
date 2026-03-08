# UX Logic Audit — Matrice stati varianti componenti

Per ogni tipo di componente identificato nel file, l’agente verifica quali **stati varianti** esistono e li confronta con questa matrice. Stati mancanti rispetto a Minimum o Expected possono generare issue (es. UXL-001, UXL-002, UXL-013).

Fonte: COMTRA_UX_Logic_Audit_Ruleset_v1.pdf, Section 6.

---

## Matrice

| Component Type | Minimum States | Expected States | Ideal States |
|----------------|----------------|-----------------|--------------|
| **Button** | Default, Hover | Default, Hover, Disabled, Loading | Default, Hover, Active, Focus, Disabled, Loading |
| **Text Input** | Default, Filled | Default, Filled, Error, Disabled | Default, Filled, Focus, Error, Success, Disabled, Read-only |
| **Checkbox / Radio** | Unselected, Selected | Unselected, Selected, Disabled | Unselected, Selected, Indeterminate, Disabled, Error |
| **Toggle / Switch** | On, Off | On, Off, Disabled | On, Off, Disabled, Loading |
| **Card / List Item** | Default | Default, Hover, Selected | Default, Hover, Active, Selected, Loading, Empty |
| **Modal / Dialog** | Open | Open, Loading | Open, Loading, Error, Success |
| **Navigation Item** | Default, Active | Default, Active, Hover | Default, Active, Hover, Focus, Disabled |
| **Table Row** | Default | Default, Hover, Selected | Default, Hover, Selected, Expanded, Disabled |
| **Toast / Alert** | Info | Info, Success, Warning, Error | Info, Success, Warning, Error + dismissible variants |
| **Dropdown / Select** | Closed, Open | Closed, Open, Disabled | Closed, Open, Disabled, Error, Loading |

---

## Uso nella detection

- **Phase 2 (Component Variant Audit):** per ogni COMPONENT_SET, enumerare le varianti (nomi o property values) e confrontare con Minimum/Expected.
- Se manca uno stato **Minimum** → candidato per issue HIGH (es. button senza loading quando l’azione è async).
- Se manca uno stato **Expected** → candidato per MED o LOW a seconda della regola (UXL-001, UXL-002, UXL-013, ecc.).
- Ideal è informativo per suggerimenti di miglioramento, non obbligatorio per non penalizzare design minimali legittimi.

Naming: l’agente deve riconoscere equivalenti (es. "loading" / "pending" / "spinner"; "error" / "invalid" / "fail") per evitare falsi positivi.
