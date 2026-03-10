/**
 * Pre-written LinkedIn posts per trophy (Comtra_LinkedIn_Trophy_Posts.pdf).
 * Placeholders: @[Comtra] → "Comtra", [PLUGIN_LINK] → link footer (landing Comtra con UTM, tracciabile; vedi LINKEDIN_FOOTER_LINK).
 */

/** Canonical trophy IDs (schema). Fallback badge IDs (LEAF, ROCK, ...) map to these for share URL and post. */
export const BADGE_ID_TO_CANONICAL: Record<string, string> = {
  LEAF: 'NOVICE_SPROUT',
  ROCK: 'SOLID_ROCK',
  IRON: 'IRON_FRAME',
  BRONZE: 'BRONZE_AUDITOR',
  DIAMOND: 'DIAMOND_PARSER',
  SILVER: 'SILVER_SURFER',
  GOLD: 'GOLDEN_STANDARD',
  PLATINUM: 'PLATINUM_PRODUCER',
  OBSIDIAN: 'OBSIDIAN_MODE',
  PIXEL: 'PIXEL_PERFECT',
  TOKEN: 'TOKEN_MASTER',
  SYSTEM: 'SYSTEM_LORD',
  BUG: 'BUG_HUNTER',
  FIXER: 'THE_FIXER',
  SPEED: 'SPEED_DEMON',
  HARMONY: 'HARMONIZER',
  SOCIAL: 'SOCIALITE',
  INFLUENCER: 'INFLUENCER',
  LEGEND: 'DESIGN_LEGEND',
  GOD: 'GOD_MODE',
  NOVICE_SPROUT: 'NOVICE_SPROUT',
  SOLID_ROCK: 'SOLID_ROCK',
  IRON_FRAME: 'IRON_FRAME',
  BRONZE_AUDITOR: 'BRONZE_AUDITOR',
  DIAMOND_PARSER: 'DIAMOND_PARSER',
  SILVER_SURFER: 'SILVER_SURFER',
  GOLDEN_STANDARD: 'GOLDEN_STANDARD',
  PLATINUM_PRODUCER: 'PLATINUM_PRODUCER',
  OBSIDIAN_MODE: 'OBSIDIAN_MODE',
  PIXEL_PERFECT: 'PIXEL_PERFECT',
  TOKEN_MASTER: 'TOKEN_MASTER',
  SYSTEM_LORD: 'SYSTEM_LORD',
  BUG_HUNTER: 'BUG_HUNTER',
  THE_FIXER: 'THE_FIXER',
  SPEED_DEMON: 'SPEED_DEMON',
  HARMONIZER: 'HARMONIZER',
  SOCIALITE: 'SOCIALITE',
  DESIGN_LEGEND: 'DESIGN_LEGEND',
  GOD_MODE: 'GOD_MODE',
};

const RAW_POSTS: Record<string, string> = {
  NOVICE_SPROUT: `Just ran my first design system check with Comtra and apparently that's enough to earn a trophy.
Not gonna lie, seeing "Novice Sprout" pop up felt unexpectedly satisfying.
One audit. One small step toward a cleaner design system. Let's see where this goes.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  SOLID_ROCK: `10 audits in. Design system: significantly less chaotic.
Just unlocked the "Solid Rock" trophy in Comtra, meaning I've run 10 accessibility, UX, and prototype audits on my Figma files.
Turns out, when you actually check your work against your own design system, things start making sense faster.
Who knew.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  IRON_FRAME: `50 wireframes generated. Zero off-system components.
Just hit the "Iron Frame" milestone in Comtra. 50 governed wireframes built directly on the Figma canvas, all respecting my design system tokens.
No ShadCN defaults. No mystery components. Just my system, enforced.
That's the kind of productivity I can get behind.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  BRONZE_AUDITOR: `Triple digits.
Just unlocked "Bronze Auditor" in Comtra. 100 audits completed across accessibility, UX, and prototype analysis.
At this point my design system has been stress-tested more than most production codebases.
And every audit taught me something I'd missed.
If you're still eyeballing your Figma files for consistency... there's a better way.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  DIAMOND_PARSER: `95% Token Health Score. On a real file. With a real design system.
Just earned "Diamond Parser" in Comtra, meaning one of my Figma files hit 95%+ compliance with my own token architecture.
Not a template. Not a demo. An actual working file, governed by actual tokens.
This is what design system maturity looks like.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  SILVER_SURFER: `500 XP and counting.
Just unlocked "Silver Surfer" in Comtra, which means I've been auditing, generating, fixing, and syncing my way through design system governance for a while now.
At 500 XP, the plugin isn't a tool anymore. It's a habit.
And my Figma files are significantly better for it.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  GOLDEN_STANDARD: `50 fixes in a row. Zero skipped. Zero dismissed.
Just earned "Golden Standard" in Comtra. The trophy you get when you accept 50 consecutive audit fixes without dismissing a single one.
Honestly? This one hit different. It means every suggestion the engine made was worth applying.
That's trust between a tool and its user.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  PLATINUM_PRODUCER: `2,000 XP. At this point Comtra knows my design system better than I do.
Just unlocked "Platinum Producer," the milestone for serious, sustained design system governance.
Audits. Generation. Code sync. Token fixes. All of it, all governed, all tracked.
This is what it looks like when your design system actually works as a system.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  OBSIDIAN_MODE: `100 prototype scans. Every flow, tested.
Just hit "Obsidian Mode" in Comtra. 100 prototype analyses completed. That's 100 times I let the AI walk through my prototypes and flag what humans would miss.
Broken flows. Missing states. Inconsistent transitions. All caught before anyone else saw them.
Design review, but make it automated.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  PIXEL_PERFECT: `100%. Not 99. Not "close enough." One hundred percent.
Just earned "Pixel Perfect" in Comtra. A perfect Token Health Score on a Figma file.
Every token mapped. Every variable resolved. Every value governed by my design system.
Zero deviations.
I didn't think this was possible on a production file. It is.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  TOKEN_MASTER: `200 tokens corrected. My design system just leveled up.
"Token Master" unlocked in Comtra, meaning I've fixed 200 token and variable issues flagged by the audit engine.
Wrong color references. Missing semantic tokens. Hardcoded values that should've been variables.
200 small corrections that compound into one very clean system.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  SYSTEM_LORD: `5,000 XP. I am now officially a System Lord.
This Comtra trophy means one thing: I've been governing my design system consistently, across audits, generation, code sync, and fixes, for long enough to earn this.
At 5K XP you stop wondering if governance is worth the effort.
It is.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  BUG_HUNTER: `50 bug reports submitted. Yes, I'm that person.
Just unlocked "Bug Hunter" in Comtra. The trophy for users who actually report issues instead of just complaining about them.
Every report makes the tool better for everyone. That's how good products get built.
If you use a tool daily, help shape it. The devs notice.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  THE_FIXER: `500 fixes accepted. Five hundred times I said "yes, fix that."
Just earned "The Fixer" in Comtra. Half a thousand audit suggestions, applied.
That's 500 moments where the engine spotted something off (wrong token, broken contrast, missing variable) and I trusted the fix.
My Figma files are not the same files they were 500 fixes ago.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  SPEED_DEMON: `10 audits in one day. Call it a productive Tuesday.
Just triggered "Speed Demon" in Comtra. The trophy for running 10+ audits in a single day.
Sometimes you just need to tear through your files and make sure everything's compliant.
Token health, accessibility, prototype flows, all of it in one sitting.
Governance speedrun: complete.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  HARMONIZER: `Storybook. GitHub. Bitbucket. All synced. All governed.
Just unlocked "Harmonizer" in Comtra. The trophy for connecting all three code sync targets.
This means my Figma design system is now drift-detected against Storybook components, GitHub repos, and Bitbucket repos simultaneously.
Design-to-code consistency isn't a dream. It's a dashboard.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  SOCIALITE: `Just shared my Comtra profile. Apparently that's trophy-worthy.
"Socialite" unlocked. The meta trophy for doing exactly what I'm doing right now.
But honestly? If you're a designer working with a design system in Figma and you haven't tried AI-powered governance yet, this is your sign.
Your tokens will thank you.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  INFLUENCER: `5 people I referred are now using Comtra. That's a trophy.
"Influencer" unlocked. Not because I'm influencing anyone, but because 5 designers I told about this plugin actually tried it and stuck around.
When a tool is good enough that word-of-mouth works, the product speaks for itself.
Governance spreads.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  DESIGN_LEGEND: `10,000 XP. They call this one "Design Legend." I'm not arguing.
This Comtra milestone means sustained, serious commitment to design system governance: audits, generation, code sync, token management, and beyond.
10K XP doesn't happen by accident. It happens by caring about the craft.
If your design system is still ungoverned, this is your nudge.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
  GOD_MODE: `Every. Single. Trophy.
I just unlocked "God Mode" in Comtra. The final trophy. All 19 other achievements complete.
Audits. Generation. Token mastery. Code sync. Prototype scans. Bug reports. Referrals. Speed runs. Perfect health scores. All of it.
This is what full design system governance looks like.
If you made it this far on my feed, go try it.
Comtra: AI Design System Governance for Figma
Try it free at [PLUGIN_LINK]`,
};

export function getCanonicalTrophyId(badgeId: string): string {
  return BADGE_ID_TO_CANONICAL[badgeId] ?? badgeId;
}

export function getLinkedInPostForTrophy(badgeId: string, pluginLink: string): string {
  const canonical = getCanonicalTrophyId(badgeId);
  const raw = RAW_POSTS[canonical];
  if (!raw) return `I just unlocked a trophy on Comtra! Try it at ${pluginLink}`;
  return raw.replace(/\[PLUGIN_LINK\]/g, pluginLink);
}
