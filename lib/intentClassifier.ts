/**
 * Comtra Generate intent classifier.
 * Deterministic, client-side, no LLM calls.
 */

export type IntentId =
  | 'GENERATE_CLEAR'
  | 'GENERATE_VAGUE'
  | 'GREETING'
  | 'GIBBERISH'
  | 'FRUSTRATION'
  | 'COMPLIMENT'
  | 'EDIT'
  | 'QUESTION_DS'
  | 'OUT_OF_SCOPE'
  | 'UNCLEAR'
  | 'FAMOUS_PERSON'
  | 'EXISTENTIAL'
  | 'TESTING_ME'
  | 'BOSSY';

export type IntentConfidence = 'high' | 'medium' | 'low';

export type IntentResult = {
  intent: IntentId;
  confidence: IntentConfidence;
  extracted?: string;
  personKey?: string;
};

export function classifyIntent(input: string): IntentResult {
  const raw = String(input || '');
  const goalLine = raw.match(/^\s*goal\s*:\s*([^\n]+)/i)?.[1];
  const intentInput = goalLine && goalLine.trim().length > 0 ? goalLine : raw;
  const t = intentInput
    .toLowerCase()
    .replace(/[!?.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = t.split(' ').filter(Boolean);
  const len = words.length;

  const personKey = detectFamousPerson(t);
  if (personKey) return { intent: 'FAMOUS_PERSON', confidence: 'high', personKey };

  const GENERATE_VERBS =
    /\b(create|make|build|design|generate|draw|craft|produce|wireframe|prototype|sketch|layout|add|need a|want a|give me a|show me a|can you make|can you build|can you create|can you design|pls make|please make|please build|please create|quick|just|asap)\b/;
  const GENERATE_NOUNS =
    /\b(dashboard|login|log[- ]in|signup|sign[- ]up|register|registration|homepage|home page|landing|checkout|check[- ]out|onboarding|on[- ]boarding|settings|setting|profile|list|form|modal|sidebar|side[- ]bar|navbar|nav[- ]bar|nav|menu|card|cart|search|notifications|notification|table|calendar|screen|page|layout|component|widget|banner|hero|footer|header|flow|wizard|stepper|drawer|tooltip|dropdown|tabs|tab|accordion|breadcrumb|pagination|empty state|404|error page|splash screen|bottom sheet|toast|snackbar|dialog|popover|chip|badge|avatar|skeleton|loader|progress|timeline|feed|chat|inbox|kanban|grid|pricing|testimonial|faq|about|contact|map view|detail view|list view|overview)\b/;
  const TYPO_NOUNS =
    /\b(dashbord|loggin|loging|sigup|chekout|onbording|setings|profil|sidbar|navebar|navar|calender|acordion|notifcation|tablue|progres)\b/;
  const VAGUE_WORDS =
    /\b(something|anything|stuff|thing|a thing|idk|dunno|whatever|a page|a screen|some ui|an interface|a design|a layout|a vibe)\b/;
  const QUESTION_SIG =
    /\b(what|which|how many|do i have|show me|list|display|are there|can i use|what's in|what is in|available|defined|exist|have a)\b/;
  const DS_NOUNS =
    /\b(component|token|variable|style|color|palette|typography|spacing|design system|library|rule|font|breakpoint|icon|shadow|radius|grid|motion)\b/;
  const GREETING =
    /^(hi|hello|hey|good morning|good afternoon|good evening|sup|yo|howdy|hiya|greetings|salut|ciao|ola|hola|morning|evening|what's up|whats up|hey there|hi there|hello there)\b/;
  const FRUSTRATION =
    /\b(not working|broken|doesn't work|wont work|won't work|failing|failed|stuck|help|confused|wrong|error|bug|terrible|awful|sucks|horrible|hate|ugh|argh|redo|again|messed up|keeps breaking|no idea|don't understand|dont understand|what am i doing|help me|assist|support)\b/;
  const COMPLIMENT =
    /\b(amazing|awesome|great|perfect|fantastic|brilliant|incredible|excellent|love it|love this|nailed it|beautiful|stunning|wonderful|superb|top notch|best|well done|nice work|nice job|so good|exactly right|exactly what|10\/10|5 stars|thumbs up|thank you|thanks|cheers|appreciate)\b/;
  const EDIT_SIG =
    /\b(change|modify|update|adjust|tweak|redo|revise|different|not what i|go back|start over|try again|instead|rather|swap|replace|edit|rework|undo|remove|add a|no wait|wait no|actually)\b/;
  const OOS =
    /\b(weather|email|translate|code|script|excel|recipe|news|flight|hotel|time|date|music|movie|book|song|sport|match|game|gpt|chatgpt|google|remind|alarm|call|text someone|whats the|who is|when did|capital of|how to cook|give me a joke|tell me a story)\b/;
  const GIBBERISH_PAT = /^[a-z]{8,}$|^([a-z]{1,2}\s){5,}$/;
  const NONSENSE =
    /\b(banana|telephone|asteroid|pizza|elephant|unicorn|spaghetti|trampoline|penguin|dinosaur|mushroom|cactus|lightbulb|duck|zucchini|potato|disco|flamingo|waffle|spatula)\b/;
  const AFFIRMATIVE =
    /^(yes|yep|yeah|yup|sure|ok|okay|go ahead|confirm|confirmed|proceed|do it|let's go|lets go|absolutely|of course|right|correct|exactly|sounds good|go|start|generate|build it|make it)\b/;
  const EXISTENTIAL =
    /\b(what is design|what even is|meaning of|why do(es)? design|is form|does ui|is a button|is atomic|what is a component|are tokens|what came first|is design|is responsive|what would bauhaus|does dark mode|do users even|is consistency|philosophic|what is a wireframe|ever finished)\b/;
  const TESTING =
    /\b(are you (an )?ai|are you sentient|what('s| is) your name|who made you|are you (chat)?gpt|do you have feelings|can you think|are you conscious|what do you (actually )?do|are you just|can you pass|do you dream|are you smarter|do you have opinions|are you real|what are your limitations|do you get tired|can you be wrong|are you learning)\b/;
  const BOSSY =
    /^(just do it|figure it out|surprise me|you decide|just build|make something good|i trust you|whatever you think|just go|do your thing|you're the designer|impress me|just start|pick something|i don't care|be creative|use your best judgment|make it beautiful|go wild|just surprise me)/;

  const hasVerb = GENERATE_VERBS.test(t);
  const hasNoun = GENERATE_NOUNS.test(t) || TYPO_NOUNS.test(t);
  const hasDsNoun = DS_NOUNS.test(t);
  const hasVague = VAGUE_WORDS.test(t);
  const hasQuestion = QUESTION_SIG.test(t);
  const isGibberish = (GIBBERISH_PAT.test(t) && len <= 3) || NONSENSE.test(t) || /^[^a-z\s]+$/.test(t);
  const isFrustration = FRUSTRATION.test(t);
  const isCompliment = COMPLIMENT.test(t);
  const isGreeting = GREETING.test(t);
  const isOos = OOS.test(t);
  const isEdit = EDIT_SIG.test(t);
  const isAffirm = AFFIRMATIVE.test(t);

  if (isGibberish) return { intent: 'GIBBERISH', confidence: 'high' };
  if (isGreeting && len <= 4) return { intent: 'GREETING', confidence: 'high' };
  if (isAffirm && len <= 5 && !hasNoun)
    return { intent: 'GENERATE_CLEAR', confidence: 'high', extracted: 'the requested screen' };
  if (isFrustration) return { intent: 'FRUSTRATION', confidence: 'high' };
  if (isCompliment && !hasNoun && !hasVerb) return { intent: 'COMPLIMENT', confidence: 'high' };
  if (isEdit && !hasNoun) return { intent: 'EDIT', confidence: 'high' };
  if (EXISTENTIAL.test(t)) return { intent: 'EXISTENTIAL', confidence: 'high' };
  if (TESTING.test(t)) return { intent: 'TESTING_ME', confidence: 'high' };
  if (BOSSY.test(t)) return { intent: 'BOSSY', confidence: 'high' };
  if (hasVerb && hasNoun) return { intent: 'GENERATE_CLEAR', confidence: 'high', extracted: extractSpec(t) };
  if (!hasVerb && hasNoun && !hasVague)
    return { intent: 'GENERATE_CLEAR', confidence: 'medium', extracted: extractSpec(t) };
  if (hasVerb && hasVague && !hasNoun) return { intent: 'GENERATE_VAGUE', confidence: 'high' };
  if (!hasVerb && hasNoun && hasVague) return { intent: 'GENERATE_VAGUE', confidence: 'medium' };
  if (hasQuestion && hasDsNoun) return { intent: 'QUESTION_DS', confidence: 'high' };
  if (hasDsNoun && !hasNoun) return { intent: 'QUESTION_DS', confidence: 'medium' };
  if (isOos) return { intent: 'OUT_OF_SCOPE', confidence: 'high' };
  if (hasVague && len <= 5) return { intent: 'GENERATE_VAGUE', confidence: 'low' };
  return { intent: 'UNCLEAR', confidence: 'low' };
}

function extractSpec(t: string): string {
  const nounMatch = t.match(
    /\b(dashboard|login|log[- ]in|signup|sign[- ]up|register|homepage|landing|checkout|onboarding|settings|profile|list|form|modal|sidebar|navbar|nav|menu|card|cart|search|notification|table|calendar|screen|page|layout|component|widget|banner|hero|footer|header|wizard|stepper|drawer|tooltip|dropdown|tabs|accordion|empty state|404|splash screen|bottom sheet|toast|dialog|chip|badge|avatar|skeleton|loader|progress|timeline|feed|chat|inbox|kanban|pricing|faq|about|contact)\b/,
  );
  if (!nounMatch) return 'the requested screen';
  let spec = nounMatch[0];
  const forMatch = t.match(/(?:for|on|with)\s+([\w\s]{2,18})(?:\b|$)/);
  if (forMatch) spec += ` for ${forMatch[1].trim()}`;
  return spec;
}

function detectFamousPerson(t: string): string | null {
  const map: Record<string, string> = {
    'don norman': 'don_norman',
    'donald norman': 'don_norman',
    'jakob nielsen': 'jakob_nielsen',
    nielsen: 'jakob_nielsen',
    'dieter rams': 'dieter_rams',
    rams: 'dieter_rams',
    'jony ive': 'jony_ive',
    'jonathan ive': 'jony_ive',
    'brad frost': 'brad_frost',
    'edward tufte': 'edward_tufte',
    tufte: 'edward_tufte',
    'steve jobs': 'steve_jobs',
    'massimo vignelli': 'massimo_vignelli',
    vignelli: 'massimo_vignelli',
    'paul rand': 'paul_rand',
    'alan cooper': 'alan_cooper',
    'ellen lupton': '__generic__',
    'nathan curtis': '__generic__',
    'chris messina': '__generic__',
    'luke wroblewski': '__generic__',
    'dan saffer': '__generic__',
    'jen simmons': '__generic__',
    'ethan marcotte': '__generic__',
    'john maeda': '__generic__',
    'susan kare': '__generic__',
    'matías duarte': '__generic__',
    'matias duarte': '__generic__',
    batman: '__generic__',
    'bruce wayne': '__generic__',
    superman: '__generic__',
    'clark kent': '__generic__',
    spiderman: '__generic__',
    'spider-man': '__generic__',
    'peter parker': '__generic__',
  };
  const sorted = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (t.includes(key)) return map[key];
  }
  return null;
}

type IntentResponse = {
  bubbles: string[];
  actions: string[];
  callKimi: boolean;
};

export const INTENT_META: Record<IntentId, { label: string; callKimi: boolean }> = {
  GENERATE_CLEAR: { label: 'Generate - clear', callKimi: true },
  GENERATE_VAGUE: { label: 'Generate - vague', callKimi: false },
  GREETING: { label: 'Greeting', callKimi: false },
  GIBBERISH: { label: 'Gibberish', callKimi: false },
  FRUSTRATION: { label: 'Frustration', callKimi: false },
  COMPLIMENT: { label: 'Compliment', callKimi: false },
  EDIT: { label: 'Edit / revise', callKimi: true },
  QUESTION_DS: { label: 'DS question', callKimi: false },
  OUT_OF_SCOPE: { label: 'Out of scope', callKimi: false },
  UNCLEAR: { label: 'Unclear', callKimi: false },
  FAMOUS_PERSON: { label: 'Famous person', callKimi: false },
  EXISTENTIAL: { label: 'Existential', callKimi: false },
  TESTING_ME: { label: 'Testing the AI', callKimi: false },
  BOSSY: { label: 'Bossy / vague command', callKimi: false },
};

export const INTENT_ACTIONS: Record<IntentId, string[]> = {
  GENERATE_CLEAR: ['Generate now'],
  GENERATE_VAGUE: ['Show examples'],
  GREETING: [],
  GIBBERISH: ['Show examples'],
  FRUSTRATION: ['Start over'],
  COMPLIMENT: [],
  EDIT: ['Apply change'],
  QUESTION_DS: ['Show components', 'Show tokens'],
  OUT_OF_SCOPE: [],
  UNCLEAR: ['Show examples'],
  FAMOUS_PERSON: [],
  EXISTENTIAL: [],
  TESTING_ME: [],
  BOSSY: [],
};

const RESPONSES: Record<IntentId, Array<(s: string) => string[]>> = {
  GENERATE_CLEAR: [
    (s) => [`Let me make sure I got this right: you want to generate a ${s}. Does that look correct?`],
    (s) => [`Got it. So we're building a ${s}. Want to go ahead?`],
    (s) => [`Quick check before I start: you're asking for a ${s}, right?`],
  ],
  GENERATE_VAGUE: [
    () => ["I'd love to help. What kind of screen or component do you want to generate?"],
    () => ['Sure thing! Can you tell me a bit more about what you are looking for?'],
    () => ['Almost there. What do you want to generate today? A page, a component, a flow?'],
  ],
  GREETING: [() => ['Hey! What would you like to generate today?']],
  GIBBERISH: [
    (s) => [`Hmm, "${s}" does not match any screen in your design system. What would you like to generate today?`],
  ],
  FRUSTRATION: [() => ["Let's figure this out together. What were you trying to generate?"]],
  COMPLIMENT: [() => ['Thanks! What are we generating next?']],
  EDIT: [() => ['Got it, let us adjust. What would you like to change?']],
  QUESTION_DS: [() => ['Sure, I can walk you through your design system. What specifically do you want to know?']],
  OUT_OF_SCOPE: [() => ["That's outside what I do. I generate UI from your design system. What would you like to build?"]],
  UNCLEAR: [() => ['I am not sure I followed that. What would you like to generate?']],
  FAMOUS_PERSON: [() => ['A design legend has entered the chat. What would you like to generate today?']],
  EXISTENTIAL: [() => ["That's a great question that has kept designers awake for years.", () => 'Anyway - what would you like to generate today?'].map((x) => (typeof x === 'string' ? x : x())) as string[]],
  TESTING_ME: [() => ['I am Comtra. I generate UI from your design system.', 'What would you like to generate today?']],
  BOSSY: [() => ["'Surprise me' is valid, but I still need direction.", 'What would you like to generate?']],
};

export function getResponse(result: IntentResult, rawInput = ''): IntentResponse {
  const meta = INTENT_META[result.intent] || INTENT_META.UNCLEAR;
  const pool = RESPONSES[result.intent] || RESPONSES.UNCLEAR;
  const entry = pool[Math.floor(Math.random() * pool.length)];
  const bubbles = entry(result.extracted || rawInput || 'the requested screen');
  return {
    bubbles: Array.isArray(bubbles) ? bubbles : [String(bubbles)],
    actions: INTENT_ACTIONS[result.intent] || [],
    callKimi: meta.callKimi,
  };
}
