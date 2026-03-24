# Code Generation — Regole e best practice per formato

Regole per la generazione di codice da nodo Figma selezionato. Ogni formato output (React, Storybook, Liquid, CSS, Vue, Svelte, Angular) ha regole specifiche. L'agente riceve il JSON del nodo e il formato richiesto; produce codice conforme alle convenzioni del framework.

**Principio:** "Design to Code." Il codice generato deve essere production-ready, rispettare i design token, e seguire le best practice di ciascun framework.

**Riferimenti:** GENERATION-ENGINE-RULESET.md (governance token), DS-AUDIT-RULES.md (coverage, naming), fonti community (Storybook, Vue, Svelte, Angular, Liquid, CSS).

---

## 1. Regole trasversali (tutti i formati)

| ID | Regola | Severity |
|----|--------|----------|
| CG-X-01 | Nessun valore hardcoded: colori, spacing, radius, font-size MUST riferire design token o variabili. | Critical |
| CG-X-02 | Mappare variabili Figma a token semantici (es. `color/surface/primary` non `color/blue/500`). | Mandatory |
| CG-X-03 | Markup semantico: `<button>`, `<nav>`, `<main>`, `<header>`, ecc. No div generici per elementi interattivi. | Mandatory |
| CG-X-04 | Accessibilità: `aria-*` dove serve (label, expanded, hidden, role). Focus states per elementi interattivi. | Mandatory |
| CG-X-05 | Struttura Figma → gerarchia codice: auto-layout → flex/grid; componenti → componenti framework. | Mandatory |
| CG-X-06 | Nomi componenti PascalCase; classi CSS BEM o utility. | Mandatory |
| CG-X-07 | **Budget output, non riduzione del target:** max ~12K token per risposta; se il root è grande, scomporre in **sottocomponenti nel codice** (es. `SidebarNav`, `SidebarSection`) mantenendo il **root** allineato al frame selezionato. Non collassare layout complessi in un singolo atomo generico (es. solo `Button`) per risparmiare token. Escludere solo **pagine intere** non richieste (marketing, multi-sezione non selezionata). | Mandatory |

### 1.1 Scope del nodo target (interezza componente / frame)

L’agente riceve un **`node_id`** che corrisponde alla **selezione corrente** in Figma. Il codice deve rappresentare **quel** nodo e la sua gerarchia, indipendentemente da Storybook.

| ID | Regola | Severity |
|----|--------|----------|
| CG-X-08 | **Root = selezione:** il componente (o frame) esportato nel codice MUST avere come radice logica il nodo `node_id` inviato. È **vietato** sostituire il root con un figlio arbitrario, con la prima istanza di un componente UI noto, o con un placeholder pattern (es. “button di esempio”) quando il nodo è `FRAME`, `COMPONENT`, `INSTANCE`, o `GROUP` che contiene layout strutturato (nav, lista, sidebar, card complessa). | Critical |
| CG-X-09 | **Gerarchia fedele:** testi, ordine verticale/orizzontale, annidamento auto-layout e gruppi MUST essere riflessi nel markup (liste → `<ul>`/`<li>` o equivalente; navigazione → `<nav>`; sezioni con heading). Se un ramo supera i limiti di contesto, **troncare con commento esplicito** (`{/* … altre voci … */}`) invece di omettere l’intero layout e restituire un atomo non rappresentativo. | Mandatory |
| CG-X-10 | **Storybook on/off stesso scope:** presenza o assenza di sync Storybook (`comp_sync`) **non cambia** lo scope: non si genera “solo la story del Button” se l’utente ha selezionato l’intera sidebar. Eventuali metadati Storybook (nome story, args) possono **arricchire** props o titoli, non restringere il target al sotto-componente collegato. | Mandatory |
| CG-X-11 | **Selezione multipla:** se il plugin invia più `node_id` o una policy “primo elemento”, documentare nel contratto API; in assenza, MUST usare **un solo root** (es. primo nella selection) e **warning** se `selection.length > 1`, senza fondere alberi non adiacenti in un unico componente senza indicarlo. | Recommended |
| CG-X-12 | **Allineamento nome export:** `componentName` (o export principale) SHOULD derivare dal nome del nodo root Figma (sanitizzato PascalCase), salvo collisioni; non rinominare in `Button` generico se il frame si chiama `Sidebar` / `AdminNav`. | Recommended |

**Nota implementazione plugin:** finché `handleGenerate` usa uno stub locale, l’output **non** legge il JSON del nodo; con `POST /api/agents/code-gen` il payload MUST includere serializzazione del sotto-albero per `node_id` (con cap documentati) così CG-X-08…12 sono applicabili.

---

## 2. React + Tailwind

**ID formato:** `REACT`

### 2.1 Struttura componente

- Functional component con export named o default.
- Props TypeScript dove appropriato.
- Nessuna dipendenza da stato globale non dichiarato.

### 2.2 Tailwind

- Utility classes Tailwind; mappare token Figma a classi esistenti (es. `bg-primary-500`, `p-4`, `text-sm`).
- Nomi token semantici: `primary`, `surface`, `text-muted`; evitare raw colori (`#ff90e8`).
- Responsive: `sm:`, `md:`, `lg:` per breakpoint coerenti con design.
- Nessun `@apply` inline; solo classi utility.

### 2.3 Best practice

- Componente sotto 200 righe; estrarre sottocomponenti se necessario.
- Destrutturazione props: `{ children, className, ...rest }`.
- Forward ref per elementi DOM se il componente wrappa input/button.
- Esportare il componente; non side effect nel file.

### 2.4 Esempio struttura

```tsx
export const Button = ({ children, variant = 'primary', className, ...rest }: ButtonProps) => (
  <button
    className={cn(
      'rounded-lg px-4 py-2 font-medium transition-colors',
      variant === 'primary' && 'bg-primary-500 text-white hover:bg-primary-600',
      variant === 'secondary' && 'border-2 border-black bg-transparent hover:bg-gray-100',
      className
    )}
    {...rest}
  >
    {children}
  </button>
);
```

---

## 3. Storybook (.stories.tsx)

**ID formato:** `STORYBOOK`

### 3.1 Struttura CSF (Component Story Format)

- Default export: `meta` con `component` e opzionalmente `title`, `tags`.
- Named exports: una Story per concetto (Default, Primary, Disabled, ecc.).
- TypeScript: `Meta<typeof Component>`, `StoryObj<typeof meta>` (o `satisfies` se disponibile).

### 3.2 Best practice

- Ogni story = un singolo concetto; no "SizesAndVariants" che mescola troppi stati.
- `args` per props del componente; `argTypes` solo se serve documentazione.
- Esempio Default, almeno un esempio Primary/variante, uno Disabled se applicabile.
- Nomi story descrittivi: "With Icon", "Loading State", non "Story1".

### 3.3 Esempio struttura

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  component: Button,
  title: 'Components/Button',
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Button', variant: 'primary' },
};

export const Secondary: Story = {
  args: { children: 'Secondary', variant: 'secondary' },
};
```

---

## 4. Shopify Liquid

**ID formato:** `LIQUID`

### 4.1 Snippet vs Section

- Snippet per componenti riutilizzabili (card, badge, form field).
- Usare `{% render 'snippet-name', param: value %}` con parametri espliciti.

### 4.2 Best practice

- Scope variabili: snippet non accede a variabili esterne; passare tutto via parametri.
- Parametri nominati: `product: product`, `show_price: true`, `max_items: 4`.
- Documentazione LiquidDoc: `{% doc %}...{% enddoc %}` con `@param` per snippet complessi.
- Conditional: `{% if condition %}` per stati varianti; evitare logica business pesante in snippet.

### 4.3 Esempio struttura

```liquid
{% comment %}
  Product card snippet
  @param {Object} product - Product object
  @param {boolean} [show_price=true] - Whether to show price
{% endcomment %}

<div class="product-card">
  <img src="{{ product.featured_image | img_url: 'medium' }}" alt="{{ product.title }}">
  <h3>{{ product.title }}</h3>
  {% if show_price %}<span class="price">{{ product.price | money }}</span>{% endif %}
</div>
```

---

## 5. HTML + Clean CSS

**ID formato:** `CSS`

### 5.1 Design tokens

- CSS custom properties su `:root` o `[data-theme]`.
- Nomenclatura: `--color-text-primary`, `--spacing-md`, `--radius-sm`.
- Nessun hex/rgba raw nei componenti; solo `var(--token-name)`.

### 5.2 CSS

- BEM dove appropriato: `.block__element--modifier`.
- Utility classes per spacing/typography se il progetto le usa.
- Mobile-first: base styles, poi `@media (min-width: ...)`.
- Organizzazione: layout, typography, colori, componenti; niente `!important` se non strettamente necessario.

### 5.3 HTML

- Semantico: `<header>`, `<nav>`, `<main>`, `<article>`, `<footer>`.
- Classi descrittive; evitare `.div1`, `.wrapper2`.

### 5.4 Esempio struttura

```css
:root {
  --color-primary: #ff90e8;
  --spacing-md: 16px;
  --radius-sm: 4px;
}

.card {
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}
```

```html
<article class="card">
  <h2 class="card__title">Title</h2>
  <p class="card__body">Content</p>
</article>
```

---

## 6. Vue 3

**ID formato:** `VUE`

### 6.1 Single File Component (SFC)

- `<template>`, `<script setup>`, `<style scoped>`.
- Composition API (script setup); evitare Options API per nuovi componenti.

### 6.2 Props e reattività

- `defineProps<T>()` con tipo; `withDefaults` per valori di fallback.
- `defineEmits` per eventi; naming kebab-case negli eventi (`update:modelValue`).

### 6.3 Styling

- Tailwind/UnoCSS o classi BEM in `<style scoped>`.
- Token via CSS vars o Tailwind config; nessun valore hardcoded.

### 6.4 Best practice

- Props in formato camelCase nel script; kebab-case nel template.
- Slot per contenuto composabile: `<slot />`, `<slot name="footer" />`.

### 6.5 Esempio struttura

```vue
<script setup lang="ts">
defineProps<{ label?: string; variant?: 'primary' | 'secondary' }>();
const emit = defineEmits<{ (e: 'click'): void }>();
</script>

<template>
  <button
    :class="['btn', `btn--${variant}`]"
    @click="emit('click')"
  >
    {{ label ?? 'Button' }}
  </button>
</template>

<style scoped>
.btn { padding: var(--spacing-md); border-radius: var(--radius-sm); }
.btn--primary { background: var(--color-primary); }
</style>
```

---

## 7. Svelte

**ID formato:** `SVELTE`

### 7.1 Svelte 5 (runes)

- `$props()` per props; destrutturazione con default.
- `$derived` per valori derivati da props; non `$state` per dati passati dal parent.
- `$props.bindable()` solo per prop che devono supportare `bind:`.

### 7.2 Template

- Struttura markup pulita; eventi con `on:click`, `on:submit`.
- Slot: `<slot />`, `<slot name="footer" />`.

### 7.3 Best practice

- Evitare `$effect` per derivazioni; usare `$derived`.
- Props reattive: trattare come immutabili nel child; aggiornamenti gestiti dal parent.
- Styling: `<style>` con scope automatico o Tailwind.

### 7.4 Esempio struttura (Svelte 5)

```svelte
<script lang="ts">
  let { label = 'Button', variant = 'primary' }: { label?: string; variant?: string } = $props();
</script>

<button class="btn btn--{variant}">
  {label}
</button>

<style>
  .btn { padding: 16px; border-radius: 4px; }
  .btn--primary { background: var(--color-primary); }
</style>
```

---

## 8. Angular

**ID formato:** `ANGULAR`

### 8.1 Standalone component

- `standalone: true` (default Angular 19+).
- `imports: [...]` per dipendenze (CommonModule, altri componenti).
- `@Component({ selector: 'app-button', ... })`.

### 8.2 Input / Output

- `@Input()` per props; `@Output()` con `EventEmitter` per eventi.
- Tipizzazione esplicita; evitare `any`.

### 8.3 Template

- Sintassi `[]` per binding, `()` per eventi.
- Pipe per formattazione; `*ngIf`, `*ngFor` (o control flow `@if`, `@for` se Angular 17+).

### 8.4 Best practice

- Change detection: preferire `OnPush` se il componente è presentazionale.
- Styling: `styleUrls` o Tailwind; encapsulation `ViewEncapsulation.Emulated`.

### 8.5 Esempio struttura

```typescript
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: `<button [class]="'btn btn--' + variant" (click)="click.emit()">{{ label }}</button>`,
  styles: [`.btn { padding: 16px; } .btn--primary { background: var(--color-primary); }`],
})
export class ButtonComponent {
  @Input() label = 'Button';
  @Input() variant: 'primary' | 'secondary' = 'primary';
  @Output() click = new EventEmitter<void>();
}
```

---

## 9. Mappatura Figma → codice

### 9.1 Nodi

| Figma | Output |
|-------|--------|
| FRAME + auto-layout H | `flex flex-row` / `display: flex` |
| FRAME + auto-layout V | `flex flex-col` |
| INSTANCE | Componente del framework |
| TEXT | `<span>`, `<p>`, `<h1>`–`<h6>` secondo stile |
| RECTANGLE | `div` con background/border; preferire componente se ripetuto |
| GROUP | `div` o fragment; valutare se estrarre componente |

### 9.2 Proprietà

| Figma | Output |
|-------|--------|
| fills (con boundVariables) | `var(--token)` o classe Tailwind |
| fills (hex) | Evitare; usare token più vicino |
| layoutMode | flex direction |
| itemSpacing | gap |
| paddingLeft/Right/Top/Bottom | padding / p-* |
| cornerRadius | rounded-* / border-radius |
| effects (shadow) | shadow-* / box-shadow token |

---

## 10. Output schema

L'agente restituisce un JSON:

```json
{
  "code": "string (codice generato)",
  "format": "REACT | STORYBOOK | LIQUID | CSS | VUE | SVELTE | ANGULAR",
  "componentName": "PascalCase",
  "warnings": ["opzionale: avvisi su token non mappati, ecc."]
}
```

In assenza di endpoint strutturato, il plugin può ricevere direttamente la stringa `code` e mostrarla nell'area di preview.

---

## 11. Riferimenti

- `docs/GENERATION-ENGINE-RULESET.md` — governance token, nessun hardcoded
- `audit-specs/ds-audit/DS-AUDIT-RULES.md` — coverage, naming, structure
- Storybook: https://storybook.js.org/docs/writing-stories
- Vue: https://vuejs.org/guide/extras/composition-api-faq.html
- Svelte: https://svelte.dev/docs/svelte/best-practices
- Angular: https://angular.dev/guide/standalone-components
- Shopify Liquid: https://shopify.dev/docs/storefronts/themes/architecture/snippets
