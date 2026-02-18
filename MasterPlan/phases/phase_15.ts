
import { PlanPhase } from '../types';

export const phase15: PlanPhase = { 
  id: 15, 
  title: "Marketing: Site, Community & Growth", 
  desc: "Lancio Sito, Newsletter e Community.", 
  tools: ["Lemon Squeezy", "Discord", "Silktide", "Iubenda"], 
  cost: "DEV: Time | USER: N/A", 
  details: "1. SITO: Creazione video tutorial, acquisto e collegamento dominio, integrazione Cookie Banner (Silktide) e Privacy Policy (Iubenda).\n2. NEWSLETTER: Setup tramite Lemon Squeezy Email Marketing.\n3. COMMUNITY: Creazione server Discord, presenza social e piano editoriale.", 
  prompts: [
    "SYSTEM ROLE: CMO & Marketing Operations.",
    "*** MARKETING & LAUNCH CHECKLIST ***",
    "1. WEBSITE: Video tutorial per ogni feature chiave. Setup dominio custom. Compliance legale (Silktide + Iubenda).",
    "2. NEWSLETTER: Configurare Lemon Squeezy per invio update prodotto e lead nurturing.",
    "3. COMMUNITY: Setup Discord per supporto e feedback. Definizione piano editoriale social.",
    "4. EARLY ADOPTERS: Creare link trasformati in coupon (come da doc affiliate) per gli early adopters con crediti gratis per testing.",
    "5. CREATIVE TOOLKIT (VIDEO & VISUALS):",
    "- Animated Mockups & Video Editing: Usare 'Claude code orange' (https://www.instagram.com/reel/DUoDMdkiv2x/?igsh=MTR0NmJ0cmZ3aXQ0Mw%3D%3D), 'Higgsfield AI Motion' (https://higgsfield.ai/blog/Higgsfield-Vibe-Motion-Guide-AI-Motion-Design?mcp_token=eyJwaWQiOjI5Mjg2NTgsInNpZCI6MTk0MjE1MDc5NywiYXgiOiI4NDAxNWE3ZGJjMDgyOGVhMjFkNDE0MGUxZGE1MjdhMCIsInRzIjoxNzcwMjQ1NjU0LCJleHAiOjE3NzI2NjQ4NTR9.-V8gYjnOH3OZQNSSqMVIXdgmb-u8Z5PEYsmwfHnz3EI) oppure 'Seedance 2.0' (https://www.linkedin.com/posts/vannarot-roeung-868679341_seedance-20-just-killed-the-ui-motion-design-ugcPost-7427939690193948672-ZqDI/?utm_source=share&utm_medium=member_android&rcm=ACoAABfEwbIBYbgxtqqu2MXgz88iqLNAfOyAcio).",
    "- Image Automation: Usare 'Loveart AI' (https://www.instagram.com/reel/DTih9FCGFzP/?igsh=MWh2MnhidGlieXdmcg%3D%3D) oppure 'Krea Prompt to Workflow' (https://www.linkedin.com/posts/introducing-prompt-to-workflow-now-you-ugcPost-7426908940245929984-21CT/?utm_source=share&utm_medium=member_desktop&rcm=ACoAABfEwbIBYbgxtqqu2MXgz88iqLNAfOyAcio) per creare automazioni nella generazione di immagini.",
    "- Micro-interactions: Usare 'Jitter' (https://jitter.video/templates/) per la creazione di microanimazioni e video template di alta qualità.",
    "6. ANALYTICS & COMPETITOR SPYING (FREE TOOLS 2026):",
    "- Metricool (Analisi & AI): Il più completo. Analisi post dettagliata, orari migliori, assistente AI per testi.",
    "- Buffer (Semplicità): Ottimo per gestire fino a 3 canali e vedere statistiche base.",
    "- Meta Business Suite (Native): Fondamentale per Facebook/Instagram. Confronto con 'Aziende simili' nella sezione Insight.",
    "- Rival IQ (Competitor Check): Usa i 'Head-to-Head Reports' gratuiti per confronto engagement immediato.",
    "- Facebook Ad Library (Spy Ads): Archivio pubblico per vedere su cosa investono i competitor.",
    "- Social Blade (Growth Tracking): Per vedere picchi di crescita e correlarli ai post pubblicati.",
    "- LinkedIn Analisi Competitor: Sezione nativa per monitorare post top e frequenza di 9 competitor.",
    "- Strategy AI (ChatGPT/Perplexity): 'Analizza questi dati (es. Like Post A vs B) e trova pattern comuni per i prossimi contenuti'.",
    "- AnswerThePublic (Content Ideas): Trova le domande reali degli utenti per superare i contenuti auto-referenziali.",
    "TASK: Eseguire il setup degli strumenti di marketing e compliance."
  ],
  section: "MARKETING & LAUNCH" 
};
