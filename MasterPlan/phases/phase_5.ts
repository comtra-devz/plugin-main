
import { PlanPhase } from '../types';

export const phase5: PlanPhase = { 
  id: 5, 
  title: "FEAT: DOCUMENTATION HUB", 
  desc: "Setup pagina Docs e Video.",
  tools: ["React", "Embedded Video"],
  cost: "DEV: €0 | USER: FREE",
  details: "Sviluppo Frontend della vista Documentation.",
  prompts: [
    "SYSTEM ROLE: Frontend Developer.",
    "*** CONTEXT & LOGIC RULES (DA IMPLEMENTARE) ***\nSTRUTTURA PAGINA:\n1. Video Tutorials: Embedda video (YouTube/Loom) che spiegano il workflow. Usa thumbnail statiche per performance.\n2. FAQ Accordion: Lista domande frequenti (es. 'Come calcolate lo score?').\n3. Support Link: `mailto:support@comtra.ai` o link a Discord.\n4. Implementation: È una View separata (`view === DOCUMENTATION`). Usa componenti riutilizzabili `Card` per ogni sezione.",
    "TASK: Costruisci la vista Documentation seguendo il design system Brutalist.",
    "*** INDICE DOCUMENTAZIONE (Reference) ***\n1. Introduzione\n2. Requisiti\n3. Installazione\n4. Connessioni e Autenticazioni\n5. Gestione Design System (Token, Palette, Typo, Spacing, Themes, Grids)\n6. Sincronizzazione con Storybook, GitHub e Bitbucket\n7. Generazione automatica di Stories\n8. Generazione codice (Linguaggi, Struttura, Naming, AI Switch)\n9. Accessibilità\n10. Motion e Interaction Design\n11. FAQ\n12. Contatti / Supporto"
  ],
  section: "CORE FEATURES & LOGIC"
};
