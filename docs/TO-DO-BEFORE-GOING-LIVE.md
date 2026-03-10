# TO DO BEFORE GOING LIVE

Checklist di azioni e link da completare o verificare **prima di pubblicare il plugin** Comtra.

---

## 1. Dominio e URL

- [ ] **comtra.dev** usato ovunque (già impostato in constants, docs, plugin).
- [ ] **Pagine trophy** su comtra.dev: creare le 20 pagine `/trophy/{ID}` con og:image (1200×627) e meta tag — vedi [LINKEDIN-TROPHY-PAGES-FIGMA-MAKE.md](./LINKEDIN-TROPHY-PAGES-FIGMA-MAKE.md).
- [ ] **Link footer nei post trophy**: il testo copiato usa `LINKEDIN_FOOTER_LINK` = landing Comtra con UTM (`utm_source=linkedin&utm_medium=post_footer&utm_campaign=trophy_share`) — tracciabile in Funnel touchpoint quando la landing invia il beacon (vedi [TOUCHPOINT-FUNNEL.md](./TOUCHPOINT-FUNNEL.md)).
- [ ] **Footer link** (altri contesti sul sito): aggiornare eventuale URL e abilitare tracking click in Brand awareness se serve.

---

## 2. Auth e backend

- [ ] **Auth backend** (auth.comtra.dev o custom): variabili d’ambiente in produzione (`POSTGRES_URL`, `JWT_SECRET`, `LEMON_SQUEEZY_*`, ecc.) — vedi `auth-deploy/SETUP.md`.
- [ ] **Migration** `004_linkedin_share_events.sql`: eseguire su DB auth se non si usa lo schema completo (tabella per Brand awareness).
- [ ] **CORS / allowed origins**: verificare che il dominio del plugin Figma e comtra.dev siano consentiti dove serve.

---

## 3. Plugin Figma

- [ ] **Plugin ID produzione**: sostituire `FIGMA_PLUGIN_ID` in `constants.ts` con l’ID del plugin pubblicato (non lasciare `COMTRA_PLUGIN_DEV_ID` in prod).
- [ ] **Versione**: aggiornare `APP_VERSION` in `constants.ts` (es. 1.0.0 → 1.0.1 per release).
- [ ] **Test user emails**: in produzione lasciare `TEST_USER_EMAILS` vuoto (o rimuovere gli indirizzi di test) in `constants.ts` / env.

---

## 4. Lemon Squeezy

- [ ] **Store e variant ID**: confermare che `LEMON_SQUEEZY_CHECKOUT_BASE` e `LEMON_SQUEEZY_VARIANT_IDS` (1w, 1m, 6m, 1y) puntino allo store e ai prodotti corretti.
- [ ] **Webhook**: URL webhook Lemon Squeezy impostato sul backend auth per aggiornare `plan` e `plan_expires_at` dopo acquisto.
- [ ] **Sconti livello**: `LEMON_SQUEEZY_API_KEY` e `LEMON_SQUEEZY_STORE_ID` configurati per creare/disattivare codici sconto gamification (livello 5/10/15/20).

---

## 5. Admin dashboard

- [ ] **URL e segreto**: `VITE_ADMIN_API_URL` e `VITE_ADMIN_SECRET` (o env deploy) per la dashboard admin.
- [ ] **Brand awareness**: pagina “Brand awareness” usa la tabella `linkedin_share_events`; verificare che la migration sia stata applicata sul DB condiviso con auth.

---

## 6. Contenuti e link finali

- [ ] **Documentation / Help**: link a documentazione e supporto aggiornati (comtra.dev o pagine definitive).
- [ ] **Privacy / Contact**: email `privacy@comtra.dev` (o quella definitiva) in `PRIVACY_CONTENT` e nelle pagine legali.
- [ ] **Post LinkedIn**: testare il flusso “Share on LinkedIn” (copy post + apertura LinkedIn + tracking click in Brand awareness).

---

## 7. Verifiche tecniche

- [ ] **Build plugin**: `npm run build` senza errori; test in Figma con build di produzione.
- [ ] **Login OAuth**: flusso completo (login → crediti, storico, trofei, sync) con account reali.
- [ ] **Acquisto**: un test di checkout Lemon Squeezy (sandbox se disponibile) e verifica aggiornamento piano utente.

---

*Ultimo aggiornamento: in fase di preparazione go-live. Aggiungere qui nuove voci man mano che emergono.*
