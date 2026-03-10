# Trophy Case — Elenco trofei e descrizioni

Lista completa dei **20 trofei** della gamification Comtra. Definizione ufficiale: seed in `auth-deploy/schema.sql` (tabella `trophies`). Logica di sblocco: backend `evaluateTrophyCondition` in `auth-deploy/oauth-server/app.mjs`. Riferimenti: [GAMIFICATION.md](./GAMIFICATION.md).

---

## Tabella trofei

| # | ID | Nome | Descrizione | Condizione di sblocco |
|---|-----|------|-------------|------------------------|
| 1 | NOVICE_SPROUT | Novice Sprout | Prima azione completata (qualsiasi). | ≥ 1 XP |
| 2 | SOLID_ROCK | Solid Rock | 10 audit completati. | ≥ 10 audit (A11Y + UX + Proto) |
| 3 | IRON_FRAME | Iron Frame | 50 wireframe generati. | ≥ 50 wireframe generati |
| 4 | BRONZE_AUDITOR | Bronze Auditor | 100 audit completati. | ≥ 100 audit |
| 5 | DIAMOND_PARSER | Diamond Parser | Health Score 95%+ su un file. | max_health_score ≥ 95 |
| 6 | SILVER_SURFER | Silver Surfer | 500 XP totali accumulati. | ≥ 500 XP |
| 7 | GOLDEN_STANDARD | Golden Standard | 50 fix accettati consecutivi senza scartare. | consecutive_fixes ≥ 50 |
| 8 | PLATINUM_PRODUCER | Platinum Producer | 2.000 XP totali accumulati. | ≥ 2.000 XP |
| 9 | OBSIDIAN_MODE | Obsidian Mode | 100 proto scan completati. | ≥ 100 proto scan |
| 10 | PIXEL_PERFECT | Pixel Perfect | Health Score 100% su un file. | max_health_score = 100 |
| 11 | TOKEN_MASTER | Token Master | 200 token/variabili corretti via audit. | token_fixes_total ≥ 200 |
| 12 | SYSTEM_LORD | System Lord | 5.000 XP totali accumulati. | ≥ 5.000 XP |
| 13 | BUG_HUNTER | Bug Hunter | 50 segnalazioni bug/errore inviate. | bug_reports_total ≥ 50 |
| 14 | THE_FIXER | The Fixer | 500 fix accettati totali. | fixes_accepted_total ≥ 500 |
| 15 | SPEED_DEMON | Speed Demon | 10 audit completati in un singolo giorno. | ≥ 10 audit in un giorno |
| 16 | HARMONIZER | Harmonizer | Usate tutte e 3 le sync (Storybook + GitHub + Bitbucket). | Tutte e 3 le sync usate |
| 17 | SOCIALITE | Socialite | Condiviso il profilo su LinkedIn. | linkedin_shared = true |
| 18 | INFLUENCER | Influencer | 5 referral affiliate completati con successo. | total_referrals ≥ 5 |
| 19 | DESIGN_LEGEND | Design Legend | 10.000 XP totali accumulati. | ≥ 10.000 XP |
| 20 | GOD_MODE | God Mode | Tutti gli altri 19 trofei sbloccati. | Altri 19 trofei sbloccati |

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
