
import { PlanPhase } from '../types';

export const phase10: PlanPhase = { 
  id: 10, 
  title: "Ops: Governance & AI Training", 
  desc: "Pattern Memory, Fine-Tuning & Knowledge Base.",
  tools: ["Database", "Fine-tuning", "RAG"],
  cost: "DEV: €0.001 (DB) | USER: FREE",
  details: "Logica di Feedback Loop, salvataggio preferenze e definizione del dataset di addestramento strategico per l'AI.",
  prompts: [
    "SYSTEM ROLE: AI Data Engineer & Knowledge Architect.",
    "*** CONTEXT & LOGIC RULES (DA IMPLEMENTARE) ***\nQuando un designer accetta un suggerimento, Antigravity salva l'azione nel database. Questi dati vengono inviati come 'Esempi Few-Shot' nei prompt futuri.",
    "*** STRATEGIC KNOWLEDGE BASE (AI TRAINING SOURCES) ***\nPer garantire la superiorità tecnica, Comtra deve prendere a riferimento e allenare la propria AI su questi tre pilastri informativi:\n\n1. COMPETITIVE INTELLIGENCE:\n- Analizzare e replicare le feature chiave di TUTTI i competitor listati nella pagina 'Communication Hub' (Beacon, Subframe, Mobbin, etc.). L'AI deve conoscere i punti di forza avversari per superarli.\n\n2. CLAUDE CODE FOR DESIGNERS (Next-Gen Workflow):\n- Implementare i paradigmi descritti in: https://nervegna.substack.com/p/claude-code-for-designers-a-practical\n- Obiettivo: Non generare solo 'codice', ma 'logica di design' che Claude può interpretare bidirezionalmente.\n\n3. REACT FOR BACKEND (Modern Architecture):\n- Adottare i pattern architetturali descritti in: https://www.theaisignals.com/p/the-react-for-backend-exists-now?mcp_token=eyJwaWQiOjMxMjI4ODAsInNpZCI6Mzg1NzYwNzE1LCJheCI6ImQyMjRiMTk5OTY0YzdjNzc4NzM0NWVlNjNiZTkwOTQyIiwidHMiOjE3NzAzOTk2MjgsImV4cCI6MTc3MjgxODgyOH0.5tczHRW207zPVR6P10QbW0FyUpU7GMzNTjHoTMJx6nk\n- Obiettivo: Trattare il backend non come API statica, ma come un'estensione reattiva del frontend (Component-Driven Backend).",
    "TASK: Crea la tabella 'accepted_patterns' per il feedback loop e predisponi il sistema RAG per ingerire i documenti strategici sopra citati."
  ],
  section: "INFRASTRUCTURE & OPERATIONS"
};
