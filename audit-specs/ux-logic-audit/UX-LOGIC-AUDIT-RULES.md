# UX Logic Audit — Regole e matrice completa

Regole per l’agente **UX Logic Audit** (Kimi). Ogni regola ha ID **UXL-NNN**, severity (HIGH/MED/LOW), descrizione e **Detection Logic** operativa sul **node tree Figma** (design statico: frame, componenti, varianti, testo, auto-layout, constraints).

---

## Confine di scope: UX sì, prototipo no

- **Questo audit valuta la UX** (stati, label, feedback, copy, layout, sicurezza interazione, empty/error, tabelle, responsive, carico cognitivo, dark pattern, i18n). Input: solo ciò che è **disegnato** nel file (struttura e contenuto).
- **Non valuta:** connessioni prototipo, “dove porta un click”, dead-end di flusso, transizioni, trigger. Qualsiasi regola che richieda di analizzare **dove porta un click** appartiene al **Prototype Audit Agent**, non qui. L’agente non deve emettere issue basate su link o connessioni del prototipo.

---

**Fonti:** Nielsen 10 Heuristics, Gerhardt-Powals, Baymard Institute, NNGroup Deceptive Patterns, Material Design 3, IBM Carbon, GOV.UK, Smashing Magazine. Dettaglio in **SOURCES.md**.

---

## Categorie (categoryId)

| categoryId | Nome | Heuristiche |
|------------|------|--------------|
| system-feedback | System Feedback | H1 — Visibility of System Status |
| interaction-safety | Interaction Safety | H3, H5 — User Control & Freedom, Error Prevention |
| form-ux | Form UX | H5, H9 — Error Prevention, Help & Documentation |
| navigation-ia | Navigation & IA | H4 — Consistency & Standards |
| content-copy | Content & Copy | H2, H8 — Match Real World, Aesthetic Minimalism |
| error-handling | Error Handling & Empty States | H9 — Help Users with Errors |
| data-tables | Data Tables & Lists | H6, H7 — Recognition, Flexibility |
| responsive-layout | Responsive & Layout | H4, H7 — Consistency, Flexibility |
| cognitive-load | Cognitive Load | H6, H8 — Recognition, Minimalist Design |
| dark-patterns | Dark Patterns & Ethics | H5, H3 — Error Prevention, User Control |
| i18n | Internationalization Readiness | H4, H7 — Consistency, Flexibility |

---

## C1: System Feedback (system-feedback)

Ogni azione che innesca un processo di sistema deve avere feedback visibile. Assenza = confusione e abbandono.

| ID | Sev. | Rule Name | Description | Detection Logic |
|----|------|-----------|-------------|-----------------|
| UXL-001 | HIGH | No Loading State Variant | Interactive element triggering async action (submit, save, fetch, search) has no loading/spinner/skeleton variant in its component set. | Find COMPONENT_SET nodes with interactive names. Check variants list for loading/pending/spinner state. Flag if absent. |
| UXL-002 | HIGH | No Success/Error Outcome State | Action-triggering component has neither success nor error state variant. User receives zero post-action feedback. | Check COMPONENT_SET variants for success/done/error/fail states. Flag if neither exists. |
| UXL-003 | MED | Missing Progress Indicator | Multi-step process (wizard, checkout, onboarding) lacks progress bar, stepper, or step counter. | Detect sequential frames with step/wizard/checkout/onboarding patterns. Check for progress/stepper/indicator component. Flag if absent. |
| UXL-004 | MED | No Toast/Snackbar Pattern | File contains form submissions but has no toast, snackbar, or inline confirmation component in the component library. | Search entire component library for toast/snackbar/notification/alert components. Flag if zero exist in a file with form patterns. |
| UXL-005 | LOW | Spinner Instead of Skeleton | Loading state uses only a generic spinner rather than skeleton/placeholder. Skeleton reduces perceived wait. | Find loading variants. Check if they contain only spinner vs skeleton/placeholder shapes. Advisory. |
| UXL-006 | LOW | No Optimistic UI Pattern | Rapid actions (like, favorite, toggle) show loading instead of instant optimistic state. | Find toggle/like/favorite components. Check if default-to-active transition requires loading intermediate. Advisory. |

---

## C2: Interaction Safety (interaction-safety)

L’utente deve sentirsi in controllo. Azioni distruttive con safety net, modal con via di fuga.

| ID | Sev. | Rule Name | Description | Detection Logic |
|----|------|-----------|-------------|-----------------|
| UXL-007 | HIGH | Modal Without Close/Cancel | Modal, dialog, or overlay has no close (X), cancel, or dismiss mechanism visible. | Scan FRAME nodes named modal/dialog/overlay/popup/sheet/drawer. Check children for close/x/cancel/dismiss/back. Flag if none. |
| UXL-008 | HIGH | Destructive Action Without Confirmation | Delete, remove, or irreversible action exists without confirmation dialog variant in same set or page. | Find elements named delete/remove/discard/clear/reset. Check same page or library for confirmation/are-you-sure dialog. Flag if absent. |
| UXL-009 | MED | No Undo/Restore Pattern | File has destructive actions but no undo (toast with undo, restore, trash/archive). | Search file for undo/restore/trash/archive patterns. Flag if destructive actions exist but no recovery mechanism. |
| UXL-010 | MED | Danger Zone Without Visual Distinction | Destructive actions look like standard actions: no red, warning icon, or spatial separation. | Find destructive action elements. Compare fill/style to standard actions. Flag if indistinguishable. |
| UXL-011 | LOW | No Disabled State Explanation | Interactive element has disabled variant but no tooltip/helper explaining why or what to do. | Find disabled-state variants. Check for tooltip, helper text, or explanatory text near element. Advisory. |

---

## C3: Form UX (form-ux)

Baymard: inline validation, label persistenti e messaggi di errore actionable sono i pattern a maggior impatto. Carbon: ogni input deve avere label visibile, helper per campi complessi, required/optional chiari.

| ID | Sev. | Rule Name | Description | Detection Logic |
|----|------|-----------|-------------|-----------------|
| UXL-012 | HIGH | Input Missing Visible Label | Text input, select, or textarea has no persistent visible label. Placeholder-only fails a11y. | Find input/textfield/select/textarea nodes. Check for sibling/parent TEXT as label (above or left). Flag if only placeholder or no label. |
| UXL-013 | HIGH | No Error State Designed for Form | Form has submit but zero input components have error/invalid variant. | Find frames with form fields + submit. Check COMPONENT_SETs for error/invalid/warning variant on inputs. Flag if zero. |
| UXL-014 | MED | Missing Required Field Indicator | Required fields have no marker (asterisk, “required” label). | Find form fields. Check label text for asterisk or required/optional. Flag if no distinction. |
| UXL-015 | MED | Error Message Not Proximate to Field | Errors only in top/bottom summary, not inline near field. Inline reduces correction time. | Check error state variants. Distance between error text and input. Flag if >40px or summary-only. |
| UXL-016 | MED | Non-Actionable Error Copy | Error states problem but not solution (e.g. “Invalid input” vs “Enter a valid email (e.g. name@example.com)”). | Parse error text for solution patterns (please, try, example, must be, e.g.). Flag generic messages. |
| UXL-017 | MED | Submit Button Always Disabled | Submit permanently disabled with no visible path to enable. High abandonment. | Find disabled submit buttons. Check if enabled variant exists and conditions communicated. Flag perpetually disabled. |
| UXL-018 | LOW | No Helper Text on Complex Fields | Date, phone, password, URL have no helper showing expected format. | Identify format-sensitive fields. Check for helper/hint text. Advisory if absent. |
| UXL-019 | LOW | Form Exceeds 7 Fields Without Grouping | Single-view form has >7 fields with no sections, dividers, or step division. | Count visible inputs per frame. Flag if >7 without dividers or step indicators. |

---

## C4: Navigation & IA (navigation-ia)

Utente deve sapere dove è, dove può andare, come tornare. Wayfinding riduce carico cognitivo.

| ID | Sev. | Rule Name | Description | Detection Logic |
|----|------|-----------|-------------|-----------------|
| UXL-020 | HIGH | No Back Navigation on Detail Pages | Detail/sub-page frame has no back button, breadcrumb, or parent link. | Identify detail pages (detail, settings/*, profile/edit, item/*). Check for back/arrow-left/breadcrumb/parent-link. Flag if absent. |
| UXL-021 | MED | Missing Active State on Navigation | Nav (tabs, sidebar, menu) has no visual distinction between active and inactive. | Find nav/menu/tab/sidebar. Check for active/selected/current variant. Flag if all items identical. |
| UXL-022 | MED | No Breadcrumbs in Deep Hierarchy | 3+ levels of hierarchy but no breadcrumb trail. | Analyze page hierarchy from frame names. Check for breadcrumb on deep-level pages. Flag if absent. |
| UXL-023 | MED | Inconsistent Navigation Across Pages | Nav position, order, or structure changes between pages. Violates H4. | Compare nav across page frames (position, size, child count). Flag significant deviations. |
| UXL-024 | LOW | No Search in Content-Heavy Interface | 20+ distinct content items with no search/filter. | Estimate content volume from frame count and list/card density. Check for search/filter at top level. Advisory. |
| UXL-025 | LOW | No Visible Skip Navigation | Long scrollable page has no anchor links, TOC, or jump-to-section. | Check long pages (>3 screen heights) for anchor/jump/toc. Advisory. |

---

## C5: Content & Copy (content-copy)

Microcopy è design. Pulsanti e messaggi devono descrivere l’azione; H2: linguaggio dell’utente, non del sistema.

| ID | Sev. | Rule Name | Description | Detection Logic |
|----|------|-----------|-------------|-----------------|
| UXL-026 | MED | Vague CTA Label | Primary action uses generic text: Submit, Click here, OK, Go. | Find primary action buttons. Parse text for generic pattern list. Flag matches. |
| UXL-027 | MED | Technical Jargon in UI | User-facing copy uses null, exception, query, parse, payload, instance, timeout, 404, NaN. | Scan TEXT nodes for technical jargon dictionary. Flag with plain-language alternatives. |
| UXL-028 | MED | Truncated Text Without Full Access | Text truncated (ellipsis/clipped) with no tooltip, expand, or detail view. | Detect TEXT with overflow hidden, ellipsis, or exceeding bounds. Check for tooltip/expand. Flag if inaccessible. |
| UXL-029 | MED | Inconsistent Terminology | Same concept with different terms (Cart vs Basket, Account vs Profile). | Build term frequency map. Detect synonyms for same concept. Flag inconsistencies. |
| UXL-030 | LOW | Passive Voice on Actions | Action copy passive (“Your account will be deleted” vs “Delete your account”). | Parse button/heading for passive patterns. Advisory with active suggestions. |
| UXL-031 | LOW | No Microcopy on Isolated Actions | Standalone action button with no surrounding explanatory text. | Check isolated action buttons not in obvious form/card context. Advisory if no context. |

---

## C6: Error Handling & Empty States (error-handling)

Ogni errore deve comunicare: cosa è successo, perché, come risolvere. Empty state = momento di onboarding, non spazio vuoto.

| ID | Sev. | Rule Name | Description | Detection Logic |
|----|------|-----------|-------------|-----------------|
| UXL-032 | HIGH | No Empty State Designed | List, table, grid, or feed has no designed empty state. | Find list/grid/table/feed. Check variants for empty/no-data/no-results. Flag if absent. |
| UXL-033 | HIGH | Error State Without Recovery Action | Error variant has no retry, back, or resolution action. | Find error/fail variants. Check for retry, back, help link. Flag if no interactive elements. |
| UXL-034 | MED | Generic Error Message | “Something went wrong”, “Error”, “Failed” without context. | Parse error text for generic patterns. Flag if no contextual information. |
| UXL-035 | MED | No 404/Not Found Page | App with page-based navigation has no not-found/missing page. | Check for frames named 404/not-found/missing/error-page. Advisory if absent. |
| UXL-036 | LOW | Empty State Missing Illustration | Error/empty is text-only. Visuals humanize and reduce frustration. | Check error/empty frames for IMAGE/VECTOR children. Advisory if text-only. |
| UXL-037 | LOW | No Edge Case for Extreme Data | No consideration for long names, huge numbers, special chars, mixed language. | Check text containers for max-width/overflow. Advisory for variable-length content. |

---

## C7: Data Tables & Lists (data-tables)

Testo allineato a sinistra, numeri a destra; sorting sempre; sticky header e empty/loading per tabelle lunghe.

| ID | Sev. | Rule Name | Description | Detection Logic |
|----|------|-----------|-------------|-----------------|
| UXL-038 | MED | Numbers Not Right-Aligned | Numeric columns left or center-aligned. | Find table-like structures. Identify numeric columns. Check alignment. Flag if not right-aligned. |
| UXL-039 | MED | No Sort Affordance | Table with multiple rows has no sort indicators on column headers. | Find table header rows. Check for sort icon/chevron. Flag if absent on table with >5 rows. |
| UXL-040 | MED | Table Missing Loading/Empty State | Table has no loading skeleton and no empty state. | Check table COMPONENT_SET for loading/skeleton/empty variants. Flag if neither. |
| UXL-041 | MED | No Sticky Header on Long Table | Table with scroll region has no sticky/fixed header. | Check table height vs content; if scroll, check header position. Flag if absent. |
| UXL-042 | LOW | No Filter/Search on Large Dataset | Table with >20 rows has no filter or search. | Estimate row count. Check for filter/search near table. Advisory. |
| UXL-043 | LOW | No Row Hover/Selection State | Table rows have no hover or selection feedback. | Check row components for hover/selected variants. Advisory if absent. |

---

## C8: Responsive & Layout (responsive-layout)

Almeno 2–3 breakpoint. Auto-layout in Figma = analogo Flexbox/Grid; assenza crea ambiguità per dev.

| ID | Sev. | Rule Name | Description | Detection Logic |
|----|------|-----------|-------------|-----------------|
| UXL-044 | MED | Single Breakpoint Only | Design at only one viewport width. No mobile/tablet variant. | Analyze frame widths (320–480, 768–834, 1024–1440). Flag if single width range. |
| UXL-045 | MED | No Auto-Layout on Content Containers | Content containers use fixed positioning instead of auto-layout. | Check container frames for auto-layout. Flag containers with multiple children using absolute positioning. |
| UXL-046 | MED | Inconsistent Spacing Values | Spacing random vs consistent scale (e.g. 4, 8, 12, 16, 24, 32, 48, 64). | Collect gap/padding in auto-layout. Check against standard scale. Flag non-conforming. |
| UXL-047 | LOW | Fixed Width Text Containers | Text in fixed width that won’t adapt. Risk of overflow or excess whitespace. | Find TEXT in fixed-width containers. Check fill mode. Advisory. |
| UXL-048 | LOW | No Min/Max Width Constraints | Variable-content components (cards, modals) have no min/max constraints. | Check variable-content components for constraints. Advisory if unconstrained. |

---

## C9: Cognitive Load (cognitive-load)

Ridurre sforzo mentale. Gerhardt-Powals: automatizzare carico non voluto, ridurre incertezza, presentare info in framework familiari.

| ID | Sev. | Rule Name | Description | Detection Logic |
|----|------|-----------|-------------|-----------------|
| UXL-049 | MED | Information Overload | Single view has >12 distinct interactive/informational elements without grouping. | Count distinct elements at top hierarchy. Flag if >12 without section dividers or cards. |
| UXL-050 | MED | No Visual Hierarchy | Page elements visually uniform: same text size/weight/spacing. | Analyze TEXT sizes/weights in page. Flag if <3 distinct size/weight combinations. |
| UXL-051 | MED | Options Without Default Selection | Dropdown, radio, or toggle set has no pre-selected default. | Find selection components. Check for default/selected state. Flag if all unselected. |
| UXL-052 | LOW | No Progressive Disclosure | Complex settings shown all at once; accordion/tabs would help. | Check high-density frames for collapsible/accordion/tab. Advisory. |
| UXL-053 | LOW | Related Items Not Grouped | Related fields (name+surname, email+phone) scattered. | Analyze proximity and naming. Flag when related elements separated by unrelated content. |

---

## C10: Dark Patterns & Ethics (dark-patterns)

Pattern ingannevoli sono oggetto di norme (EU DSA, CPRA, FTC). L’audit segnala **potenziali** dark pattern per review del designer, non determinazioni legali.

| ID | Sev. | Rule Name | Description | Detection Logic |
|----|------|-----------|-------------|-----------------|
| UXL-054 | HIGH | Asymmetric Action Prominence | Destructive/negative action (unsubscribe, cancel, decline) much smaller or less visible than business-preferred action. | Compare size, contrast, position of paired actions (Subscribe vs Cancel, Accept vs Decline). Flag if secondary <60% visual weight of primary. |
| UXL-055 | HIGH | Pre-Selected Opt-In | Checkbox/toggle for newsletter, marketing, or data sharing pre-selected ON. EU DSA: opt-in must be active. | Find checkbox/toggle in form with marketing/newsletter/data/consent names. Check default state. Flag if pre-checked. |
| UXL-056 | MED | Confirmshaming | Decline option uses shame-inducing language (“No, I don’t want to save money”). | Parse decline/dismiss/cancel text in promotional contexts. Flag negative self-referential patterns. |
| UXL-057 | MED | Hidden Cost/Charge Reveal | Price/fee appears only late in flow (e.g. final checkout step) not upfront. | Check pricing TEXT across flow frames. Flag if price first appears only in final steps. |
| UXL-058 | MED | False Urgency/Scarcity | Timer, “Only X left”, “Limited time” as static design; may create artificial pressure. | Find TEXT with urgency patterns (only N left, limited, hurry, expires, countdown). Flag for review. |

---

## C11: Internationalization Readiness (i18n)

Testo tedesco ~20–35% più lungo dell’inglese; RTL per arabo/ebraico; date/valute per locale. i18n va progettata da subito.

| ID | Sev. | Rule Name | Description | Detection Logic |
|----|------|-----------|-------------|-----------------|
| UXL-059 | MED | No Text Expansion Buffer | Text containers tightly sized with no room for expansion (+30%+). | Find TEXT where text fills >90% of container width with no auto-resize. Flag if cannot accommodate +30%. |
| UXL-060 | MED | Fixed-Width Buttons with Text | Buttons have fixed width rather than hug contents. Breaks with longer translations. | Find button components with fixed width. Flag if text already >70% of button width. |
| UXL-061 | MED | Hardcoded Date/Time/Currency Format | Text contains MM/DD/YYYY, currency symbols, number formats as static values. | Scan TEXT for date/time/currency format patterns. Flag static formatted values. |
| UXL-062 | LOW | No RTL Layout Consideration | No RTL variant or mirrored layout. | Check for RTL/arabic/hebrew-named frames or mirrored variants. Advisory if absent. |
| UXL-063 | LOW | String Concatenation in UI | UI text from concatenated fragments (“You have” + [number] + “items”). Breaks word order and plural rules. | Detect TEXT that are sentence fragments (short, in sequence, forming sentence). Advisory. |
| UXL-064 | LOW | Icons With Embedded Text | Icons/illustrations contain embedded text that cannot be translated. | Find VECTOR/SVG with embedded TEXT children (user-facing). Advisory. |

---

## Riepilogo ID → categoryId

- UXL-001 … UXL-006 → system-feedback  
- UXL-007 … UXL-011 → interaction-safety  
- UXL-012 … UXL-019 → form-ux  
- UXL-020 … UXL-025 → navigation-ia  
- UXL-026 … UXL-031 → content-copy  
- UXL-032 … UXL-037 → error-handling  
- UXL-038 … UXL-043 → data-tables  
- UXL-044 … UXL-048 → responsive-layout  
- UXL-049 … UXL-053 → cognitive-load  
- UXL-054 … UXL-058 → dark-patterns  
- UXL-059 … UXL-064 → i18n  

Per escalation tra regole vedi **ESCALATION-RULES.md**. Per pipeline di detection vedi **DETECTION-PIPELINE.md**.
