
import { PlanPhase } from '../types';

export const phase8: PlanPhase = { 
  id: 8, 
  title: "Infra: Lemon Squeezy & Affiliates", 
  desc: "Pagamenti, Webhook e Sistema Affiliazione.",
  tools: ["Lemon Squeezy API", "Supabase Edge Functions"],
  cost: "DEV: ~3% Fee | USER: €7 - €250",
  details: "Integrazione Flusso Pagamenti Lemon Squeezy, Webhook e implementazione della funzione Affiliate.",
  prompts: [
    "SYSTEM ROLE: Payment Systems Engineer.",
    "*** CONTEXT & LOGIC RULES (DA IMPLEMENTARE) ***\n1. PRICING TIERS & MARGINS (UPDATED):\n- 1 WEEK: €7 (20 Prompts/Credits). Rev/Prompt: €0.35. (High Margin)\n- 1 MONTH: €25 (100 Prompts/Credits). Rev/Prompt: €0.25. (Good Margin)\n- 6 MONTHS: €99 (600 Prompts/Credits). Rev/Prompt: €0.165. (Excellent Margin)\n- 1 YEAR: €250 (3000 Prompts Total). Rev/Prompt: €0.083. (Standard Bulk Margin). *Hard cap to ensure safety.\n\n2. CHECKOUT FLOW:\n- Frontend: Utente clicca 'Upgrade'.\n- Backend: Genera URL Lemon Squeezy Checkout.\n- Frontend: `figma.openExternal(checkout_url)`.\n\n3. WEBHOOK HANDLING:\n- Evento `order_created` e `subscription_created`: Recupera `custom_data.figma_user_id`.\n- DB Update: Aggiorna `user.plan`, `user.credits` e `user.subscription_end`.\n\n4. AFFILIATE SYSTEM:\n- Implementare logica per tracciare `affiliate_id` o referral code nel metadata dell'ordine Lemon Squeezy.",
    "*** LEMON SQUEEZY AFFILIATE LOGIC (FIGMA WORKAROUND) ***\n\n1️⃣ Come funziona l’affiliate tracking in Lemon Squeezy\nLemon Squeezy traccia le vendite tramite il parametro URL ?aff=ID.\nNon esiste un modo nativo per far sì che Lemon Squeezy interpreti un codice inserito dall’utente come “affiliate” direttamente nel checkout.\nI coupon sono separati dal sistema affiliati: usare un codice come “coupon-affiliate” non attribuisce automaticamente la vendita a un affiliato. (docs.lemonsqueezy.com)\n\n2️⃣ Cosa puoi fare dentro Figma\nPuoi far inserire all’utente le ultime lettere del link affiliato o un codice tipo “AFF123”.\nIl plugin può leggere quel codice e costruire l’URL del checkout Lemon Squeezy completo con ?aff=ID prima di aprire il popup.\nEs: l’utente inserisce 123\nPlugin costruisce https://tuostore.lemonsqueezy.com/checkout/buy/...&aff=123\n\nAprendo questo URL, Lemon Squeezy riconosce la referral e attribuisce la vendita.\n\n✅ Vantaggi:\nTutto funziona dentro Figma\nNon serve che l’utente apra browser separato o sia loggato a Lemon Squeezy\nReferral tracking funziona perché alla fine il checkout viene aperto con il parametro aff",
    "TASK: Implementa le API di Lemon Squeezy e il webhook handler rispettando questi tier e aggiungendo il supporto affiliati."
  ],
  section: "INFRASTRUCTURE & OPERATIONS"
};
