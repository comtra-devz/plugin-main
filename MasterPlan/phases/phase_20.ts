
import { PlanPhase } from '../types';

export const phase20: PlanPhase = {
  id: 20,
  title: "Growth: Lifecycle Email System",
  desc: "Automazione Email per Retention & Conversion.",
  tools: ["Lemon Squeezy Email", "Supabase Triggers"],
  cost: "DEV: €0.05 | USER: N/A",
  details: "Implementazione di un sistema di email marketing automatizzato basato su trigger comportamentali nel database.",
  prompts: [
    "SYSTEM ROLE: Lifecycle Marketing Specialist.",
    "*** EMAIL AUTOMATION TRIGGERS & WORKFLOWS ***",
    
    "1. ONBOARDING SEQUENCE (Activation):",
    "- Trigger: `auth.users` insert.",
    "- Email 1 (Day 0): 'Welcome to the Brutal Truth'. (Mission, Link a Video Tutorial, Install Plugin).",
    "- Email 2 (Day 2): 'Your First Scan'. (Se `usage_logs` è vuoto -> Nudge gentile).",
    
    "2. FEATURE LAUNCH (Engagement):",
    "- Trigger: Manual Blast su segmento `active_users`.",
    "- Subject: 'Upgrade: Deep Sync is here'. (Highlight valore, link diretto alla documentazione).",
    
    "3. HEALTH SCORE GAMIFICATION (Retention):",
    "- Trigger: `audit_logs.score` > 95.",
    "- Subject: 'Perfection Achieved 🏆'.",
    "- Body: 'You hit 98% Health Score. Here is a generic badge to share on LinkedIn'. (Social Proof).",
    "- Trigger: `audit_logs.score` < 40.",
    "- Subject: 'Your system is bleeding'.",
    "- Body: 'We found 50+ errors. Fix them in 1 click'. (Loss Aversion).",
    
    "4. CREDIT STATUS (Monetization):",
    "- Trigger: `users.credits_remaining` == 0 AND `plan` == 'FREE'.",
    "- Subject: 'Energy Depleted ⚡'.",
    "- Body: 'You hit the limit. Upgrade now to unlock infinite power'. (Urgency).",
    "- Trigger: `users.plan` changes 'PRO' -> 'FREE' (Churn).",
    "- Subject: 'Was it something we said?'.",
    "- Body: 'Feedback request + 20% discount coupon to comeback'.",
    
    "5. REFERRAL LOOP (Growth):",
    "- Trigger: `users.affiliates_count` increases.",
    "- Subject: 'Cha-ching! You just earned cash 💸'.",
    "- Body: 'Someone used your code. Your balance is now €XX. Keep going'.",
    "- Trigger: `users.affiliates_count` == 0 (Day 7).",
    "- Subject: 'Earn while you sleep'.",
    "- Body: 'Did you know you have a partner code? Share it and get 20%'.",
    
    "*** TONE OF VOICE ***",
    "- Direct, Brutalist, slightly edgy but professional.",
    "- Emojis usate strategicamente (⚡, 💸, 🏆).",
    "- Subject lines corte e impattanti (max 40 chars).",
    
    "TASK: Configurare i webhook Supabase che chiamano le API di Lemon Squeezy Broadcast per inviare queste email."
  ],
  section: "MARKETING & LAUNCH"
};
