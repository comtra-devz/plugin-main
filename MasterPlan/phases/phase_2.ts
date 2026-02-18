
import { PlanPhase } from '../types';

export const phase2: PlanPhase = { 
  id: 2, 
  title: "FEAT: GENERATE WIREFRAME", 
  desc: "Design System Context & Smart Labels.",
  tools: ["Kimi K2.5", "Figma API"],
  cost: "DEV: €0.001 | USER: 1 Credit (~€0.25)",
  details: "Logica di generazione UI con selettore del Design System (Material, Custom, etc.) e gestione cursore avanzata.",
  prompts: [
    "SYSTEM ROLE: UI Generator & Figma Specialist.",
    "*** CONTEXT & LOGIC RULES (DA IMPLEMENTARE) ***\nLOGICA GENERAZIONE:\n1. Context Analysis: Se un layer è selezionato, estrai il suo JSON.\n2. Design System Selector: Il frontend fornisce un parametro 'ds_type' (es. Material 3, iOS, Custom). L'AI deve adattare nomenclature e proprietà (es. usare 'M3/Button' vs 'Btn_Primary').\n3. Smart Labels (Range API): Se l'utente incolla un link Figma, usa Range API per inserire un nodo <span contenteditable='false'>.\n4. Incoming Prompt: Se l'utente arriva dalla pagina Audit (Prototype Redirect), il campo di input deve essere pre-compilato con il contesto richiesto.",
    "*** FIGMA PHYSICS & CONSTRAINTS (ANTI-HALLUCINATION) ***\n1. CSS vs FIGMA MAPPING: L'AI deve sapere che non può creare classi CSS. Deve tradurre 'padding' in 'AutoLayout padding', 'flex-direction' in 'layoutMode', 'z-index' in 'layer order' (children array index).\n2. IMPOSSIBLE ACTIONS: Non suggerire 'border-bottom' (Figma non lo ha nativo, serve un inner shadow o un line layer). Non suggerire 'vh/vw' units. Usa sempre AutoLayout per la responsività.",
    "*** SCENARI & ESEMPI REALI (GENERAZIONE) ***\nScenario A: Creazione da Zero (No Selection)\n- Prompt Utente: \"Login screen\"\n- DS Context: Material 3.\n- Output AI: JSON con Frame 'Login', Input 'Outlined', Button 'Filled', Elevation 'Level 1'. Naming rigoroso M3.\n\nScenario B: Modifica Contestuale (Selection Active)\n- Selezione: Card esistente (titolo, testo, immagine).\n- Prompt Utente: \"Aggiungi un badge 'Novità' in alto a destra\".\n- Output AI: JSON della card aggiornata. Mantiene i token esistenti, aggiunge il Badge usando il token 'sys.color.tertiary' (o il più simile).\n\nScenario C: Safe-Fail (Allucinazione evitata)\n- Prompt: \"Usa il font Comic Sans\".\n- DS Context: Il sistema ha solo 'Inter'.\n- Azione AI: Ignora Comic Sans, usa Inter, ma aggiunge nota: \"Font non in sistema, usato fallback Inter\".",
    "*** SCREENSHOT TO WIREFRAME PROTOCOLS (VISION API) ***\n1. ANALYSIS: When user uploads an image, Vision AI (Gemini 2.5) must analyze the structure (Layout, Hierarchy) and content.\n2. MAPPING: Do NOT create a pixel-perfect copy. Map recognized elements to the EXISTING Design System components.\n   - If Image shows a primary button -> Use <Button variant='primary' /> from library.\n   - If Image shows a generic card -> Use <Card /> container with AutoLayout.\n3. NOISE REDUCTION: Ignore decorative elements (background textures, complex illustrations) unless explicitly asked. Focus on functional wireframe.\n4. TOKENIZATION: Extract approximate colors from screenshot and snap them to the nearest valid System Token (e.g. #F23A4B -> sys.color.error).",
    "TASK: Genera o modifica la struttura JSON per Figma rispettando il Design System selezionato."
  ],
  section: "CORE FEATURES & LOGIC"
};
