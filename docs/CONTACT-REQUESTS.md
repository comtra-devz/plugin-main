# Contact requests

Sezione che raccoglie i **link di contatto** usati nel prodotto (CTA Enterprise, “Book a call”, ecc.), il piano di **tracciamento** (API del tool) e la gestione dei **clienti Enterprise** (tag, utenti registrati).

---

## 1. Link in uso

| Nome | URL | Contesto | Tool |
|------|-----|----------|------|
| **Deep Sync — Enterprise call** | https://calendly.com/comtra-enterprise | Modal Deep Sync (utente non PRO): “Book a call to discuss your setup”. | Calendly |

*Aggiornare questa tabella quando si aggiungono nuovi link di contact request.*

---

## 2. Tracciamento (da valutare per tool)

- **Obiettivo:** Sapere quante di queste call (o richieste contatto) portano a un **cliente Enterprise**.
- **Approccio per tool:**
  - **Calendly:** Valutare integrazione tramite API (webhook “invitee created” / “invitee no-show” / “scheduled” o export) per tracciare eventi e, lato nostro, associare a conversione Enterprise (es. quando un utente viene marcato con tag `enterprise`).
  - **Altri tool** (Typeform, HubSpot, ecc.): Stessa logica: webhook o API per ricevere eventi, poi correlazione con utenti/lead e con tag `enterprise` dove applicabile.
- **Metriche utili:** numero di call prenotate, numero di call effettuate (se disponibile), numero di utenti poi taggati `enterprise` (conversione).

---

## 3. Clienti Enterprise (inserimento manuale, tag)

- I **clienti Enterprise** vengono inseriti/gestiti **manualmente** (es. dopo la call o onboarding dedicato).
- Devono **risultare tra gli utenti registrati**: stesso record in `users` (stesso `id` Figma se già registrati, oppure creazione manuale del profilo se necessario), con **tag** per identificarli.
- **Tag in uso:** `enterprise` (array `tags` su `users` contiene `"enterprise"`).
- **Come marcare un utente come Enterprise (manuale):**
  - Se l’utente esiste già (login Figma):  
    `UPDATE users SET tags = COALESCE(tags, '[]'::jsonb) || '"enterprise"'::jsonb WHERE id = '<figma_user_id>';`
  - Se si crea un utente manualmente (caso limite): inserire in `users` con `tags = '["enterprise"]'::jsonb`.
- Il plugin (e le API che restituiscono il profilo utente) ricevono `user.tags`; si può mostrare in UI (es. badge “Enterprise”) dove serve.

---

## 4. Riferimenti

- **Schema:** `auth-deploy/schema.sql` (colonna `users.tags`); migration `auth-deploy/migrations/006_user_tags.sql` (GIN index su `tags`).
- **Enterprise / SSO:** `docs/SYNC-ENTERPRISE-SSO.md`.
