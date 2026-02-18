
import { PlanPhase } from '../types';

export const phase16: PlanPhase = {
  id: 16,
  title: "QA: Stress Testing Matrix",
  desc: "Protocolli di test per scenari Figma complessi.",
  tools: ["Figma Desktop", "Team Libraries"],
  cost: "DEV: Time | USER: N/A",
  details: "Guida strategica per validare la robustezza del plugin in ambienti Figma eterogenei (Locali, Esterni, Disconnessi).",
  prompts: [
    "SYSTEM ROLE: QA Lead.",
    "*** MANUAL TESTING PROTOCOLS (NO AI) ***",
    "Esegui questi test manuali prima di ogni release per garantire stabilità.",
    "SCENARIO 1: 'The Blank Canvas' (No Design System)\n- Setup: File Draft nuovo. Disegna forme e testi a mano senza stili.\n- Check Audit: Deve segnare 100% 'Hardcoded Hex' e 'Unknown Font'.\n- Check Generate: Deve usare valori di fallback o il sistema 'Custom'. Non deve crashare cercando variabili inesistenti.",
    "SCENARIO 2: 'The Consumer' (Linked External Library)\n- Setup: File che usa componenti e variabili da una Team Library attiva.\n- Check Audit: Deve riconoscere i token esterni come validi (non hardcoded).\n- Check Code: Deve esportare variabili con naming corretto (es. var(--sys-primary)) recuperando il nome dalla lib remota.",
    "SCENARIO 3: 'The Orphan' (Unlinked/Broken Library)\n- Setup: Copia un elemento tokenizzato da un altro file, incolla in un file nuovo dove quella libreria NON è attiva.\n- Rischio Tecnico: Figma potrebbe restituire un ID variabile ma non riuscire a risolvere il valore (resolvedType error).\n- Check Plugin: Non deve crashare (White Screen). Deve degradare elegantemente a HEX e segnalare 'Token Detached' o 'Missing Library'.",
    "SCENARIO 4: 'The Hybrid' (Mixed Mode)\n- Setup: Un componente istanza (collegato) con override manuali locali (es. cambio colore testo).\n- Check Audit: Deve segnalare 'Detached Style' solo sulla proprietà sovrascritta, mantenendo validi gli altri token.",
    "*** AI VALIDATION & ROI ANALYSIS (PRO TIPS) ***",
    "Per validare la qualità dell'Audit automatico, implementare il seguente protocollo di Cross-Check:\n\n1. AI DOUBLE CHECK:\n- Fai un double check con un'altra AI (come ad esempio ChatGPT > Claude) passando il JSON di output.\n\n2. ROI CLASSIFICATION PROMPT:\n- Successivamente chiedi:\n\"Classifica i problemi per costo di fix stimato sulla base di benchmark di mercato (basso/medio/alto) e impatto di ROI sulla UX.\"\n\nRisultato: ottieni una UX Audit molto dettagliata, molto concreta e già prioritizzata per definire la successiva roadmap di lavoro.",
    "TASK: Eseguire la matrice di test su Windows e Mac (Web & Desktop App)."
  ],
  section: "MARKETING & LAUNCH"
};
