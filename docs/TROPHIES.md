# Trophy Case — List and descriptions

Complete list of the **20 trophies** for Comtra gamification. Official definition: seed in `auth-deploy/schema.sql` (table `trophies`). Unlock logic: backend `evaluateTrophyCondition` in `auth-deploy/oauth-server/app.mjs`. See [GAMIFICATION.md](./GAMIFICATION.md).

---

## Trophy table

| # | ID | Name | Description | Unlock condition |
|---|-----|------|-------------|------------------------|
| 1 | NOVICE_SPROUT | Novice Sprout | First action completed (any). | ≥ 1 XP |
| 2 | SOLID_ROCK | Solid Rock | 10 audits completed. | ≥ 10 audits (A11Y + UX + Proto) |
| 3 | IRON_FRAME | Iron Frame | 50 wireframes generated. | ≥ 50 wireframes generated |
| 4 | BRONZE_AUDITOR | Bronze Auditor | 100 audits completed. | ≥ 100 audits |
| 5 | DIAMOND_PARSER | Diamond Parser | Health Score 95%+ on a file. | max_health_score ≥ 95 |
| 6 | SILVER_SURFER | Silver Surfer | 500 total XP earned. | ≥ 500 XP |
| 7 | GOLDEN_STANDARD | Golden Standard | 50 consecutive fixes accepted without dismissing. | consecutive_fixes ≥ 50 |
| 8 | PLATINUM_PRODUCER | Platinum Producer | 2,000 total XP earned. | ≥ 2,000 XP |
| 9 | OBSIDIAN_MODE | Obsidian Mode | 100 proto scans completed. | ≥ 100 proto scans |
| 10 | PIXEL_PERFECT | Pixel Perfect | Health Score 100% on a file. | max_health_score = 100 |
| 11 | TOKEN_MASTER | Token Master | 200 tokens/variables fixed via audit. | token_fixes_total ≥ 200 |
| 12 | SYSTEM_LORD | System Lord | 5,000 total XP earned. | ≥ 5,000 XP |
| 13 | BUG_HUNTER | Bug Hunter | 50 bug/error reports submitted. | bug_reports_total ≥ 50 |
| 14 | THE_FIXER | The Fixer | 500 total fixes accepted. | fixes_accepted_total ≥ 500 |
| 15 | SPEED_DEMON | Speed Demon | 10 audits completed in a single day. | ≥ 10 audits in one day |
| 16 | HARMONIZER | Harmonizer | Used all 3 sync targets (Storybook + GitHub + Bitbucket). | All 3 syncs used |
| 17 | SOCIALITE | Socialite | Shared profile on LinkedIn. | linkedin_shared = true |
| 18 | INFLUENCER | Influencer | 5 successful affiliate referrals. | total_referrals ≥ 5 |
| 19 | DESIGN_LEGEND | Design Legend | 10,000 total XP earned. | ≥ 10,000 XP |
| 20 | GOD_MODE | God Mode | All other 19 trophies unlocked. | All other 19 trophies unlocked |

---

## Icone (icon_id)

Ogni trofeo ha un `icon_id` usato nella UI (Trophy Case in Stats): SPROUT, ROCK, IRON, BRONZE, DIAMOND, SILVER, GOLD, PLATINUM, OBSIDIAN, PIXEL, TOKEN, SYSTEM, BUG, FIXER, SPEED, HARMONY, SOCIAL, INFLUENCER, LEGEND, GOD. I componenti icona sono in `views/Analytics.tsx` (mappa `ICON_ID_TO_COMPONENT`).

---

## Fallback UI

Se l’API `GET /api/trophies` non è disponibile, la view Stats usa `BADGES_FALLBACK` in `views/Analytics.tsx` con descrizioni in inglese e condizioni derivate da stats locali.

---

## Share su LinkedIn

In Stats, aprendo il dettaglio di un badge sbloccato, il pulsante **Share on LinkedIn**:

1. Copia negli appunti il **post pre-scritto** per quel trofeo (testi da `Comtra_LinkedIn_Trophy_Posts.pdf`; mappa in `linkedinTrophyPosts.ts`).
2. Apre la finestra di condivisione LinkedIn con **solo** il parametro `url` (LinkedIn non supporta più `summary`/prefill testo via URL). L’URL condiviso è `{LINKEDIN_TROPHY_SHARE_BASE}{canonicalId}` (es. `https://comtra.dev/trophy/NOVICE_SPROUT`).
3. L’utente incolla il testo nel post (Ctrl+V / Cmd+V).

**Foto nel post:** LinkedIn mostra l’anteprima (titolo, descrizione, **immagine**) solo se la pagina condivisa espone i meta **Open Graph**. Per avere una **foto per trofeo** nel post:

- Sul sito (es. comtra.dev) deve esistere una pagina per ogni trofeo, es. `/trophy/NOVICE_SPROUT`, `/trophy/SOLID_ROCK`, …
- Ogni pagina deve avere in `<head>` almeno: `og:image` (URL immagine **1200×627** px consigliato), `og:title`, `og:url`. Opzionale `og:description`.
- Le immagini possono essere 20 card/asset (uno per trofeo) ospitate sul sito o su CDN.

Costanti in `constants.ts`: `LINKEDIN_TROPHY_SHARE_BASE`, `LINKEDIN_PLUGIN_LINK` (override con `VITE_LINKEDIN_TROPHY_SHARE_BASE`, `VITE_LINKEDIN_PLUGIN_LINK`).
