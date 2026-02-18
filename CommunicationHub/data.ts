
import React from 'react';
import { StrategyCard, FolderType, EditorialPost } from './types';

// Kept for backward compatibility with orphaned files, but emptied of meaningful data
export const INITIAL_EDITORIAL_POSTS: EditorialPost[] = [];

export const DATA: Record<Exclude<FolderType, 'EDITORIAL'>, StrategyCard[]> = {
  BRAND: [
    {
      id: 'archetype',
      title: "Archetype: The Ruler / Creator",
      subtitle: "Authority meets Innovation",
      lastUpdated: '24 Oct 2023',
      tags: ["Identity", "Psychology"],
      content: "Noi siamo l'Ordine nel Caos. Non chiediamo per favore, dettiamo lo standard. Ma lo facciamo con la creatività di un artista. 'Dreamy Brutalism' è l'unione di regole ferree (Brutalism: bordi spessi, contrasto alto, nessun compromesso) e visione aspirazionale (Dreamy: metafore cosmiche, palette neon, linguaggio poetico). La nostra missione è dare ai designer il potere di un Developer Senior e ai developer l'occhio di un Art Director."
    },
    {
      id: 'colors',
      title: "Visual Identity & System",
      subtitle: "#FF90E8 & #FFC900",
      lastUpdated: '24 Oct 2023',
      tags: ["Design", "Assets"],
      content: "Primary: Neon Pink (#FF90E8) - Rappresenta l'elemento magico/AI, la creatività e la trasformazione. Secondary: Warning Yellow (#FFC900) - Usato per l'audit, l'attenzione, il cantiere in corso. Black & White: La struttura portante, il codice, la verità assoluta. I componenti devono avere bordi di 2px neri, ombre nette (no blur) e font Space Grotesk/Tiny5 per evocare un terminale retro-futurista."
    },
    {
      id: 'tov',
      title: "Tone of Voice: Gentle Precision",
      subtitle: "Diretto ma Poetico",
      lastUpdated: '24 Oct 2023',
      tags: ["Copywriting"],
      content: "Non siamo un software freddo. Parliamo come un mentore esperto. Regole: 1. Mai dire 'Errore', dire 'Una nuvola copre la vista' o 'Dissonanza rilevata'. 2. Mai dire 'Loading', dire 'Tessendo i pixel' o 'Allineando le stelle'. 3. Essere autorevoli sui fatti ('Il contrasto è errato') ma gentili nella soluzione ('Ecco come farlo brillare'). Microcopy Esempio: Invece di 'Fix All', usa 'Harmonize System'."
    },
    {
      id: 'philosophy',
      title: "Philosophy: Honest Interface",
      subtitle: "Ethics of Raw Data",
      lastUpdated: 'Today',
      tags: ["Values", "Design"],
      content: "Il Brutalismo non è solo estetica, è etica. Mostriamo i dati 'crudi' (Raw JSON, Errori non edulcorati). Non nascondiamo la complessità dietro sfumature o blur, la organizziamo in griglie rigide. Se il sistema è rotto, l'interfaccia deve urlarlo, non sussurrarlo. È un tool di lavoro, non un giocattolo."
    },
    {
      id: 'mission',
      title: "Mission: Engineering Empathy",
      subtitle: "Bridging the Gap",
      lastUpdated: 'Today',
      tags: ["Goal", "Culture"],
      content: "Il designer spesso ignora i vincoli del codice, creando frizione. La nostra missione è forzare il designer a pensare come un ingegnere (Componenti, Variabili, Stati, Constraints) senza dover scrivere una riga di codice. Costruiamo l'empatia strutturale tra le due figure."
    }
  ],
  COMPETITORS: [
    {
      id: 'image_to_design',
      title: "image.to.design — by ‹div›RIOTS",
      subtitle: "The Vision AI Player",
      lastUpdated: 'Today',
      tags: ["Vision", "Import"],
      content: "Ref: https://www.figma.com/community/plugin/1461393763625176521/image-to-design-by-divriots-imports-avif-webp-jpeg-xl-jpeg-2000-png-tiff-svg-raw. Posizionamento: Forte sulla generazione visuale e interpretazione screenshot. Punto di Debolezza: Genera output 'Flat' o scollegati dal Design System aziendale. Comtra vince integrando la 'Vista' con la 'Logica': quando noi vediamo uno screenshot, non lo copiamo pixel-perfect, ma lo ricostruiamo usando semanticamente i TUOI componenti e token."
    },
    {
      id: 'stark',
      title: "Stark",
      subtitle: "The Accessibility Vertical",
      lastUpdated: 'Today',
      tags: ["A11y", "Code Scan"],
      content: "Posizionamento: Il gold standard per l'accessibilità (Contrast, Vision Sim, Code Scanning). Punto di Debolezza: È uno strumento di 'Ispezione'. Ti dice cosa è rotto, ma non lo ricostruisce per te. Comtra integra le regole di Stark *dentro* il motore di generazione: non abbiamo bisogno di uno scanner esterno se il codice nasce già perfetto (Semantic HTML, ARIA automatici)."
    },
    {
      id: 'beacon',
      title: "Beacon (OnBeacon.ai)",
      subtitle: "The Automated Linter",
      lastUpdated: 'Today',
      tags: ["Linting", "AI"],
      content: "Posizionamento: Beacon eccelle nell'audit visuale automatizzato e nella consistenza. Punto di Debolezza: È focalizzato sul 'Design Linting' (trovare errori di stile), ma manca di 'Engineering Context'. Comtra vince perché non si limita a segnalare 'Hex errato', ma capisce la semantica del componente e lo collega al codice di produzione (Storybook Deep Sync). Beacon pulisce il Figma, Comtra pulisce il Prodotto."
    },
    {
      id: 'anima',
      title: "Anima App",
      subtitle: "The 'Good Student'",
      lastUpdated: '26 Oct 2023',
      tags: ["Competitor", "Weakness"],
      content: "Posizionamento: Anima punta tutto sulla fedeltà del codice ('Design to Code'). Punto di Debolezza: È uno strumento passivo. Esporta quello che gli dai, anche se è spazzatura. Non ha un 'cervello' di design system. Comtra invece è ATTIVO: audita, corregge e rifiuta di esportare se i token non sono collegati. Noi siamo Governance, loro sono Export."
    },
    {
      id: 'figma_ai',
      title: "Figma AI (Native)",
      subtitle: "The Generic Assistant",
      lastUpdated: '26 Oct 2023',
      tags: ["Market", "Threat"],
      content: "Figma 'Make' permette di generare design da zero. Il problema? Genera design 'nuovi', scollegati dal tuo sistema esistente. Crea debito tecnico immediato. Comtra si posiziona all'opposto: Noi NON inventiamo stili. Noi *assembliamo* usando RIGOROSAMENTE i tuoi token e componenti. Figma AI è per l'esplorazione, Comtra è per la produzione e la coerenza."
    },
    {
      id: 'zeroheight',
      title: "ZeroHeight",
      subtitle: "The Documentation Statico",
      lastUpdated: '27 Oct 2023',
      tags: ["Docs"],
      content: "ZeroHeight è eccellente per documentare, ma la documentazione vive separata dal lavoro. Comtra porta la documentazione *dentro* l'azione. Quando sbagli un contrasto, Comtra ti cita la regola in tempo reale. ZeroHeight è la legge scritta in biblioteca, Comtra è il vigile urbano all'incrocio."
    },
    {
      id: 'relume',
      title: "Relume (Webflow)",
      subtitle: "The Standard Library",
      lastUpdated: 'Today',
      tags: ["Competitor", "Differentiation"],
      content: "Il re dei layout generici. Ottimo per partire veloce con strutture standard, ma pessimo per la brand consistency specifica. Comtra non usa 'Librerie standard', usa la TUA libreria. Relume è IKEA (funziona per tutti), Comtra è Falegnameria su misura (funziona solo per te)."
    },
    {
      id: 'linters',
      title: "Dumb Linters (Design Lint)",
      subtitle: "Rule-Based Robots",
      lastUpdated: 'Today',
      tags: ["Tech", "Superiority"],
      content: "I linter classici segnalano tutto ciò che non è un token come errore. Sono pedanti e generano rumore. Comtra usa l'AI per capire l'intento: se usi un colore custom per un'illustrazione specifica, Comtra lo capisce e non ti disturba. I linter vedono pixel, Comtra vede contesto."
    },
    {
      id: 'design_tokens_plugin',
      title: "Design Tokens Plugin",
      subtitle: "The Token Engine",
      lastUpdated: 'Today',
      tags: ["Tokens", "JSON"],
      content: "Ref: https://www.figma.com/community/plugin/888356646278934516/design-tokens. Posizionamento: Lo standard storico per gestire i token. Punto di Debolezza: È un tool tecnico per gestire JSON, non un assistente AI. Comtra integra la logica dei token *dentro* la generazione e l'audit, non si limita a esportarli. Loro sono il database, noi siamo l'intelligenza che lo usa."
    },
    {
      id: 'subframe',
      title: "Subframe (Design Canvas)",
      subtitle: "The Claude Code Player",
      lastUpdated: 'Today',
      tags: ["Claude", "Code Gen"],
      content: "Ref: https://www.linkedin.com/posts/filipskrzesinski_introducing-design-canvas-for-claude-code-activity-7427810151174447104-eQkL. Posizionamento: Generazione UI text-to-code molto forte con Claude. Punto di Debolezza: È focalizzato sul codice (React) e meno sulla governance interna di Figma (Audit, Naming, Token Cleanup). Comtra presidia il 'prima' (pulizia Figma) e il 'dopo' (Codice), garantendo che il source of truth (Figma) rimanga pulito."
    },
    {
      id: 'mobbin_superdesign',
      title: "Mobbin + Superdesign (Jason Zhou)",
      subtitle: "Taste-Powered UGC AI",
      lastUpdated: 'Today',
      tags: ["UGC", "Taste", "GenAI"],
      content: "Ref: https://www.linkedin.com/posts/jasonzhoudesign_what-if-ai-could--design-with-taste-powered-ugcPost-7427698716939321345-qysH/?utm_source=share&utm_medium=member_android&rcm=ACoAABfEwbIBYbgxtqqu2MXgz88iqLNAfOyAcio. Posizionamento: Utilizzare l'enorme database di Mobbin (UI reali di alta qualità) per addestrare l'AI sul 'Gusto' e non solo sulla griglia. Punto di forza: L'AI non inventa, 'impara' dai migliori prodotti reali. Comtra deve rispondere integrando la 'Pattern Memory' (Fase 10) non solo sui design dell'utente, ma curando un dataset di 'Golden Standards' interni."
    },
    {
      id: 'hera',
      title: "Hera",
      subtitle: "The Motion Mockup Specialist",
      lastUpdated: 'Today',
      tags: ["Animation", "Mockup", "Presentation"],
      content: "Ref: https://www.linkedin.com/posts/jan-mraz_how-to-animate-any-design-in-figma-in-a-single-ugcPost-7427422505465856001-cpbE/?utm_source=share&utm_medium=member_android&rcm=ACoAABfEwbIBYbgxtqqu2MXgz88iqLNAfOyAcio. Posizionamento: Plugin verticale per animare mockup e design direttamente in Figma con un click. Ottimo per la presentazione visiva. Punto di Debolezza: È focalizzato sull'output visivo (video/gif) e non sulla struttura del codice o del design system. Comtra si posiziona a monte: garantiamo che il design sia strutturalmente sano prima di animarlo, e in futuro potremmo integrare 'AI Motion' per generare animazioni CSS/Code-based, non solo video."
    },
    {
      id: 'token_forge',
      title: "Token Forge",
      subtitle: "The Variable Builder",
      lastUpdated: 'Today',
      tags: ["Tokens", "Variables"],
      content: "Ref: https://www.figma.com/community/plugin/1566133735926608173/token-forge-variables-tokens-builder. Posizionamento: Verticale sulla creazione e gestione di Variabili Figma e Token JSON. Punto di Debolezza: È un tool di 'Setup' e 'Building'. Ti aiuta a definire la struttura, ma non ha un motore AI che scansiona i layout esistenti per correggerli. Comtra è complementare: Token Forge crea i mattoni, Comtra controlla che la casa sia costruita dritta e secondo le regole (Governance vs Creation)."
    }
  ],
  USP: [
    {
      id: 'usp_1',
      title: "Guardiano del Design System (Firewall)",
      subtitle: "Non generiamo spazzatura",
      lastUpdated: '01 Oct 2023',
      tags: ["Positioning", "Core"],
      content: "La nostra Unique Value Proposition numero 1. A differenza dei generatori AI generici che allucinano colori e spaziature, Comtra agisce come un Firewall. Se un colore non è nel tuo `design-tokens.json`, Comtra lo rifiuta o lo converte al token più vicino. Garantiamo il 100% di aderenza al sistema, rendendo il codice risultante immediatamente utilizzabile in produzione."
    },
    {
      id: 'usp_2',
      title: "Deep Drift Detection",
      subtitle: "Realtà vs Design",
      lastUpdated: '05 Oct 2023',
      tags: ["Tech", "Feature"],
      content: "L'unico plugin che implementa un algoritmo di Hashing bidirezionale. Calcoliamo l'impronta digitale (Hash) del componente Figma e la confrontiamo con la `prop-table` estratta da Storybook/GitHub. Se lo sviluppatore ha cambiato il padding in produzione, Comtra avvisa il designer: 'Drift Rilevato'. Chiudiamo il loop infinito tra Design e Code."
    },
    {
      id: 'usp_3',
      title: "Auto-Fix Intelligente & Context Aware",
      subtitle: "1-Click Cleanup",
      lastUpdated: '10 Oct 2023',
      tags: ["UX", "Magic"],
      content: "Non ci limitiamo a segnalare l'errore. Grazie all'AI Contestuale (RAG), Comtra sa *come* risolverlo. Se rileva un testo grigio chiaro su bianco, non dice solo 'Contrasto basso', ma applica il token `sys.color.text.secondary` corretto. Ridenomina i layer (`Frame 432` -> `Card_Header`) e collega le variabili orfane in un solo click."
    },
    {
      id: 'usp_4',
      title: "Market Revolution: The AI Guardian",
      subtitle: "Designer Centricity & Governance",
      lastUpdated: 'Today',
      tags: ["Vision", "Strategy", "Urgency"],
      content: "Comtra è rivoluzionario perché è il primo **'Guardiano AI'** che non si limita a generare design, ma **ingegnerizza** i file Figma rispettando rigorosamente Token e Codice. **Designer al Centro**: I designer restano protagonisti assoluti; eliminando la manovalanza (renaming, fix), guadagnano tempo per esaminare la strategia, fare A/B testing e ricerca. **Per le Aziende**: Azzera il debito tecnico e il 'Design Drift'. **Urgenza**: I competitor generano output 'creativi' ma strutturalmente poveri. Comtra domina la nicchia della Governance, un vantaggio da occupare ora."
    },
    {
      id: 'usp_5',
      title: "Context-Aware Generation",
      subtitle: "Material 3, iOS, Bootstrap & Custom",
      lastUpdated: 'Today',
      tags: ["AI RAG", "Versatility"],
      content: "Comtra non 'immagina' il design nel vuoto. Il motore di generazione accetta un contesto specifico (Material Design 3, iOS Human Interface, Carbon, ecc.) o apprende dal tuo sistema 'Custom'. Questo garantisce che un wireframe generato rispetti non solo i token, ma anche le convenzioni di naming e struttura specifiche del framework scelto."
    },
    {
      id: 'usp_6',
      title: "The 4-Layer Audit Matrix",
      subtitle: "DS • A11y • UX • Prototype",
      lastUpdated: 'Today',
      tags: ["Deep Tech", "Quality"],
      content: "La maggior parte dei plugin si ferma al controllo visivo. Comtra implementa una matrice di audit a 4 livelli: 1. Design System (Token coverage, Naming); 2. Accessibility (WCAG Contrast, Touch Targets); 3. UX Logic (Dead ends, Error prevention, Tone consistency); 4. Prototype (Broken links, Loops). È una validazione olistica del prodotto, non solo del disegno."
    },
    {
      id: 'usp_7',
      title: "Engineering-Grade Code",
      subtitle: "Smart Routing & Semantic HTML",
      lastUpdated: 'Today',
      tags: ["Code Quality", "Dev Experience"],
      content: "Non esportiamo 'Div Soup'. L'AI analizza la struttura per generare HTML5 semantico (<nav>, <main>, <article>). Killer Feature: 'Smart Routing'. Se due bottoni hanno lo stesso testo ('Next') ma destinazioni diverse nel prototipo Figma, Comtra genera rotte uniche e contestuali nel codice React (/onboarding-step-2 vs /checkout-next), risolvendo conflitti di navigazione prima ancora che lo sviluppatore inizi a scrivere."
    },
    {
      id: 'usp_8',
      title: "Privacy: Ephemeral Intelligence",
      subtitle: "Stateless Processing",
      lastUpdated: 'Today',
      tags: ["Security", "Enterprise"],
      content: "Le aziende temono l'AI sui loro file proprietari. La nostra architettura è rigorosamente 'Stateless'. Analizziamo la struttura JSON del nodo in tempo reale e dimentichiamo tutto (memory wipe) subito dopo la risposta. Nessun training sui dati utente. Questo è fondamentale per vendere a banche e corporate."
    },
    {
      id: 'usp_9',
      title: "The 'Sanitizer' Protocol",
      subtitle: "Lightweight Payloads",
      lastUpdated: 'Today',
      tags: ["Performance", "Tech"],
      content: "Prima di inviare i dati all'AI, il nostro Controller esegue uno 'stripping' aggressivo. Rimuoviamo immagini pesanti, metadati binari inutili e vettori complessi, inviando solo lo scheletro logico. Risultato: Payload leggerissimo, risposta ultra-veloce (<2s) e costo API ridotto drasticamente."
    }
  ],
  SUSTAINABILITY: [
    {
      id: 'sus_1',
      title: "The Hook Strategy",
      subtitle: "Audit Scan (99.5% Margin)",
      lastUpdated: 'Today',
      tags: ["High Margin", "Acquisition"],
      content: "L'Audit iniziale (-5 Crediti) è la nostra funzione 'hook' principale. Incasso stimato: €1,00. Costo API reale (Kimi K2.5 per input testuale): ~€0,001. Questo garantisce un margine del 99.5%. È guadagno puro che finanzia l'acquisizione utente."
    },
    {
      id: 'sus_2',
      title: "High Volume Operations",
      subtitle: "Auto-Fix & Generate (98-99% Margin)",
      lastUpdated: 'Today',
      tags: ["Volume", "Retention"],
      content: "Le operazioni frequenti sono calibrate per la massima sostenibilità. Auto-Fix Layer (-2 Crediti): Incasso €0,40 vs Costo ~€0,002 (Margine 99%). Generate Wireframe (-3 Crediti): Incasso €0,60 vs Costo ~€0,005 (Kimi K2.5). Anche con uso intensivo, il costo è trascurabile."
    },
    {
      id: 'sus_3',
      title: "The Cash Cow",
      subtitle: "Code Export & Sync (Value Based)",
      lastUpdated: 'Today',
      tags: ["Profit", "B2B"],
      content: "Qui facciamo il vero profitto. Sync Storybook (-10 Crediti): Incasso €2,00 vs Costo ~€0,02. Code Export (-40 Crediti): Incasso €8,00 vs Costo ~€0,02 (Kimi K2.5). L'utente paga volentieri 8€ per risparmiare 4 ore di coding manuale. Il prezzo è basato sul 'Valore Percepito', non sul costo tecnico."
    },
    {
      id: 'sus_4',
      title: "Enterprise Risk & Solution",
      subtitle: "Large Files (1 Credit / 50 Nodes)",
      lastUpdated: 'Today',
      tags: ["Risk", "Protection"],
      content: "Il Rischio 'Aziende': Se un'azienda scansiona un DS enorme (es. 5.000 nodi) a costo fisso, potresti andare in perdita (Costo API €2.00 vs Ricavo €0.40). Soluzione Strategica: Implementare un costo variabile per le scansioni massive: '1 Credito ogni 50 Nodi analizzati'. In questo modo il sistema scala automaticamente: il freelance paga poco, l'azienda paga il giusto, e il margine rimane protetto."
    },
    {
      id: 'sus_5',
      title: "Conclusion: Ironclad",
      subtitle: "Worst Case Scenario Analysis",
      lastUpdated: 'Today',
      tags: ["Forecast", "Safety"],
      content: "Il sistema è estremamente profittevole e sbilanciato a nostro favore. Anche nel caso peggiore (Scan Prototipo pesantissimo da 3000 nodi -> 60 Crediti), il costo API salirebbe al massimo a €0,10-€0,20 a fronte di un incasso di €12,00. Siamo in una botte di ferro."
    },
    {
      id: 'sus_6',
      title: "The 'Sticky' Drift Retention",
      subtitle: "Lock-in Positivo",
      lastUpdated: 'Today',
      tags: ["Retention", "LTV"],
      content: "La funzione 'Deep Sync' crea un lock-in psicologico fortissimo. Una volta che un team si abitua a vedere in tempo reale se Figma e Storybook sono disallineati (Drift), tornare indietro significa tornare al caos e all'incertezza. Il churn rate su questa feature sarà vicino allo zero."
    },
    {
      id: 'sus_7',
      title: "Context Caching (Smart Cost)",
      subtitle: "Hashing & Memory",
      lastUpdated: 'Today',
      tags: ["Optimization", "Tech"],
      content: "Non inviamo l'intero Design System (2000 token) ad ogni richiesta. Calcoliamo un hash del DS: se non è cambiato dall'ultima richiesta, l'AI usa la 'memoria a breve termine' o un embedding pre-calcolato nel backend. Questo riduce i token di input del 40% medio su sessioni lunghe."
    }
  ]
};
