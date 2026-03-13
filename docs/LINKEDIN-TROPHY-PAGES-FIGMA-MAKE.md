# Pagine trophy per share LinkedIn (Figma Make)

Istruzioni e prompt per creare sul sito comtra (comtra.dev) le **20 pagine** che servono a far comparire **titolo, descrizione e immagine** quando un utente condivide un trofeo su LinkedIn.

**Nota:** LinkedIn con share-offsite permette solo di passare l’**url**; il **testo del post** non si può pre-compilare via link (viene copiato negli appunti e l’utente incolla). Dettagli: [LINKEDIN-SHARE-LIMITS.md](./LINKEDIN-SHARE-LIMITS.md).

---

## 1. Cosa servono

- **20 pagine**, una per trofeo, con URL **esatti** come sotto.
- Ogni pagina può essere **minima**: niente contenuto elaborato. L’importante è che i **meta tag Open Graph** in `<head>` siano corretti, perché LinkedIn (e altri social) usano quelli per l’anteprima del link.
- **20 immagini** (o 1 template ripetuto con nome trofeo): formato **1200×627 px** (JPG o PNG), da usare in `og:image`.

---

## 2. URL obbligatori (path)

Base: **`/trophy/{ID}`** (es. dominio `https://comtra.dev` → `https://comtra.dev/trophy/NOVICE_SPROUT`).

| # | ID (path) | Nome trofeo (per titolo/UI) |
|---|-----------|-----------------------------|
| 1 | NOVICE_SPROUT | Novice Sprout |
| 2 | SOLID_ROCK | Solid Rock |
| 3 | IRON_FRAME | Iron Frame |
| 4 | BRONZE_AUDITOR | Bronze Auditor |
| 5 | DIAMOND_PARSER | Diamond Parser |
| 6 | SILVER_SURFER | Silver Surfer |
| 7 | GOLDEN_STANDARD | Golden Standard |
| 8 | PLATINUM_PRODUCER | Platinum Producer |
| 9 | OBSIDIAN_MODE | Obsidian Mode |
| 10 | PIXEL_PERFECT | Pixel Perfect |
| 11 | TOKEN_MASTER | Token Master |
| 12 | SYSTEM_LORD | System Lord |
| 13 | BUG_HUNTER | Bug Hunter |
| 14 | THE_FIXER | The Fixer |
| 15 | SPEED_DEMON | Speed Demon |
| 16 | HARMONIZER | Harmonizer |
| 17 | SOCIALITE | Socialite |
| 18 | INFLUENCER | Influencer |
| 19 | DESIGN_LEGEND | Design Legend |
| 20 | GOD_MODE | God Mode |

Gli ID vanno usati **esattamente** così nel path (maiuscolo, underscore): il plugin apre `https://comtra.dev/trophy/NOVICE_SPROUT` ecc.

---

## 3. Meta tag obbligatori (in `<head>`)

Ogni pagina deve avere almeno:

```html
<meta property="og:type" content="website" />
<meta property="og:url" content="https://comtra.dev/trophy/{ID}" />
<meta property="og:title" content="{Titolo sotto}" />
<meta property="og:description" content="{Descrizione sotto, max ~150 caratteri}" />
<meta property="og:image" content="https://comtra.dev/images/trophy/{ID}.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="627" />
```

- **og:image**: URL assoluto dell’immagine 1200×627 (una per trofeo o stesso template con testo diverso).
- **og:title**: sotto i 70 caratteri (LinkedIn tronca).
- **og:description**: sotto i 150 caratteri (LinkedIn tronca).

---

## 4. Titolo e descrizione suggeriti (per og:title / og:description)

| ID | og:title (breve) | og:description (max ~150 char) |
|----|------------------|---------------------------------|
| NOVICE_SPROUT | Unlocked: Novice Sprout | First design system check done. One audit, one trophy. Comtra – AI Design System Governance for Figma. |
| SOLID_ROCK | Unlocked: Solid Rock | 10 audits in. Design system less chaotic. Comtra – AI Design System Governance for Figma. |
| IRON_FRAME | Unlocked: Iron Frame | 50 governed wireframes. Zero off-system components. Comtra – AI Design System Governance for Figma. |
| BRONZE_AUDITOR | Unlocked: Bronze Auditor | 100 audits completed. Design system stress-tested. Comtra – AI Design System Governance for Figma. |
| DIAMOND_PARSER | Unlocked: Diamond Parser | 95%+ Token Health Score on a real file. Comtra – AI Design System Governance for Figma. |
| SILVER_SURFER | Unlocked: Silver Surfer | 500 XP. The plugin is now a habit. Comtra – AI Design System Governance for Figma. |
| GOLDEN_STANDARD | Unlocked: Golden Standard | 50 consecutive fixes accepted. Every suggestion worth applying. Comtra – AI Design System Governance for Figma. |
| PLATINUM_PRODUCER | Unlocked: Platinum Producer | 2,000 XP. Serious design system governance. Comtra – AI Design System Governance for Figma. |
| OBSIDIAN_MODE | Unlocked: Obsidian Mode | 100 prototype scans. Every flow tested. Comtra – AI Design System Governance for Figma. |
| PIXEL_PERFECT | Unlocked: Pixel Perfect | 100% Token Health Score. Zero deviations. Comtra – AI Design System Governance for Figma. |
| TOKEN_MASTER | Unlocked: Token Master | 200 tokens corrected. Design system leveled up. Comtra – AI Design System Governance for Figma. |
| SYSTEM_LORD | Unlocked: System Lord | 5,000 XP. Governance is worth the effort. Comtra – AI Design System Governance for Figma. |
| BUG_HUNTER | Unlocked: Bug Hunter | 50 bug reports submitted. Helping shape the tool. Comtra – AI Design System Governance for Figma. |
| THE_FIXER | Unlocked: The Fixer | 500 fixes accepted. Figma files transformed. Comtra – AI Design System Governance for Figma. |
| SPEED_DEMON | Unlocked: Speed Demon | 10 audits in one day. Governance speedrun complete. Comtra – AI Design System Governance for Figma. |
| HARMONIZER | Unlocked: Harmonizer | Storybook, GitHub, Bitbucket – all synced and governed. Comtra – AI Design System Governance for Figma. |
| SOCIALITE | Unlocked: Socialite | Shared my Comtra profile. Your tokens will thank you. Comtra – AI Design System Governance for Figma. |
| INFLUENCER | Unlocked: Influencer | 5 referred designers now use Comtra. Governance spreads. Comtra – AI Design System Governance for Figma. |
| DESIGN_LEGEND | Unlocked: Design Legend | 10,000 XP. Sustained commitment to design system governance. Comtra – AI Design System Governance for Figma. |
| GOD_MODE | Unlocked: God Mode | Every trophy. Full design system governance. Comtra – AI Design System Governance for Figma. |

Puoi accorciare le description se servono sotto i 150 caratteri; il brand line finale può essere uguale per tutti.

---

## 5. Contenuto visibile (opzionale)

- **Minimo:** pagina quasi vuota con solo i meta tag (va bene: LinkedIn legge solo l’head). Chi apre il link può vedere una riga tipo “Unlocked: [Nome trofeo]” e un link “Back to Comtra” / “Try the plugin”.
- **Consigliato:** stessa card/template per tutte le 20: logo Comtra, nome trofeo, una riga di copy (“You unlocked this badge in the Comtra Figma plugin”), CTA “Try Comtra” → home o plugin. Stile in linea con la landing esistente.

---

## 6. Immagini (1200×627)

- **Opzione A:** 20 immagini diverse (una card per trofeo con nome/icona). Es. `/images/trophy/NOVICE_SPROUT.jpg` … `GOD_MODE.jpg`.
- **Opzione B:** 1 template unico (stesso layout, stessi colori) e 20 export con solo il **nome del trofeo** cambiato (testo o asset). Stesso aspect ratio 1200×627.

---

## 7. Prompt per Figma Make

Copia e incolla il blocco sotto (adatta dominio e path se usi comtra.dev o altro).

---

**Prompt:**

```
Create 20 minimal landing pages for Comtra (AI Design System Governance for Figma) used only for LinkedIn link previews when users share a "trophy" they unlocked in the plugin.

Requirements:

1. URL structure: exactly 20 routes:
   /trophy/NOVICE_SPROUT
   /trophy/SOLID_ROCK
   /trophy/IRON_FRAME
   /trophy/BRONZE_AUDITOR
   /trophy/DIAMOND_PARSER
   /trophy/SILVER_SURFER
   /trophy/GOLDEN_STANDARD
   /trophy/PLATINUM_PRODUCER
   /trophy/OBSIDIAN_MODE
   /trophy/PIXEL_PERFECT
   /trophy/TOKEN_MASTER
   /trophy/SYSTEM_LORD
   /trophy/BUG_HUNTER
   /trophy/THE_FIXER
   /trophy/SPEED_DEMON
   /trophy/HARMONIZER
   /trophy/SOCIALITE
   /trophy/INFLUENCER
   /trophy/DESIGN_LEGEND
   /trophy/GOD_MODE

2. Each page must have Open Graph meta tags in the head so LinkedIn shows a rich preview (image + title + description):
   - og:type = website
   - og:url = full canonical URL of that page (e.g. https://comtra.dev/trophy/NOVICE_SPROUT)
   - og:title = "Unlocked: [Trophy name]" (e.g. "Unlocked: Novice Sprout") — keep under 70 characters
   - og:description = one short line about the achievement + "Comtra – AI Design System Governance for Figma" — under 150 characters
   - og:image = absolute URL to an image 1200×627 px (one image per trophy or one template with the trophy name)

3. Visible content can be minimal: a simple card with the trophy name, one line of copy ("You unlocked this badge in the Comtra Figma plugin"), and a primary CTA "Try Comtra" linking to the main site or Figma plugin. Style consistent with the existing Comtra landing (brutalist / bold typography, black/white/pink/yellow accents if that's the brand).

4. Images: either 20 separate 1200×627 assets (one per trophy) or one 1200×627 template with a text/variant for the trophy name. Format JPG or PNG. Serve from the same domain or a CDN.

5. Trophy display names for titles/card:
   Novice Sprout, Solid Rock, Iron Frame, Bronze Auditor, Diamond Parser, Silver Surfer, Golden Standard, Platinum Producer, Obsidian Mode, Pixel Perfect, Token Master, System Lord, Bug Hunter, The Fixer, Speed Demon, Harmonizer, Socialite, Influencer, Design Legend, God Mode.

Domain to use: https://comtra.dev (in og:url, og:image and CTA link).
```

---

Se Figma Make genera una sola pagina-template con variabili, assicurati che il routing produca esattamente i path sopra e che i meta tag siano dinamici per `{ID}` e nome trofeo.

---

## 8. Dopo il deploy

- Verifica un URL con [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) (inserisci es. `https://comtra.dev/trophy/NOVICE_SPROUT`) e controlla che titolo, descrizione e immagine compaiano.
- Nel plugin la costante `LINKEDIN_TROPHY_SHARE_BASE` punta già a `https://comtra.dev/trophy/` (override con `VITE_LINKEDIN_TROPHY_SHARE_BASE` se serve).

Quando le pagine sono live, il flusso “Share on LinkedIn” nel plugin mostrerà automaticamente l’anteprima con la foto per ogni trofeo.
