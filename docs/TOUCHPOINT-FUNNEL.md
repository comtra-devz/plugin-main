# Funnel touchpoint — Landing, Plugin, LinkedIn, Instagram, TikTok

Struttura per monitorare ingressi e conversioni da tutti i touchpoint: dall’ingresso fino all’utilizzo, upgrade PRO e retention.

---

## Le strade possibili

Un utente può arrivare in tantissimi modi: **dal post** (es. trophy su LinkedIn), **dalla landing** (dopo essere passato da un post o da un social), **dai vari social** (LinkedIn, Instagram, TikTok quando saranno attivi), o **dritto alla pagina del plugin**. Da lì apre il plugin nel file, fa login, usa le funzioni e magari diventa PRO. Ogni percorso è un percorso valido; l’obiettivo è **vedere da dove arriva il traffico** (visit, click, primo utilizzo) e **quanti arrivano fino a PRO**, per canale e per touchpoint. Questo doc e la dashboard Funnel touchpoint servono proprio a tenere traccia di tutti questi modi e del percorso fino alle azioni e all’upgrade.

---

## Cosa fare adesso (in breve)

- **Link dalla landing / LinkedIn / ecc.** → devono puntare alla **pagina del plugin su Figma** (con UTM: `utm_source=landing`, `utm_medium=header|hero|footer`, `utm_content=...`). L’utente scopre il plugin lì; il **login** avviene solo quando apre il plugin **nel suo file Figma**.
- **Opzionale:** per vedere in dashboard "Visite" e "Click" sulla landing, usa il beacon (§ 3).

---

## Il tracking è già pronto? Cosa fare dopo gli UTM (in 3 passi)

**Sì:** il sistema è già impostato (tabelle, API, dashboard). Per farlo funzionare davvero:

1. **Eseguire la migration sul database**  
   Sul DB che usa auth (Supabase / Vercel Postgres): esegui il file `auth-deploy/migrations/005_touchpoint_funnel.sql` (copia-incolla nel SQL Editor e Run). Così esistono le tabelle `touchpoint_events` e `user_attribution`. **Una sola volta.**

2. **Niente altro obbligatorio**  
   Gli UTM che hai messo sui link servono a te (es. Google Analytics). La dashboard **Funnel touchpoint** già oggi mostra: quanti utenti, primo utilizzo, PRO, ecc., per touchpoint. Quasi tutti risulteranno "Plugin" perché il login avviene solo dal plugin.

3. **Se vuoi vedere anche Visite e Click sulla landing**  
   Sulla landing aggiungi due chiamate (beacon): una quando si carica la pagina (visit), una quando l’utente clicca sul bottone che porta al plugin (click). Come fare è scritto sotto in § 3. Se non le aggiungi, la dashboard mostra comunque tutto il resto (ingressi da plugin, utilizzo, PRO).

**Riassunto:** migration una volta → il tracking è attivo. Beacon sulla landing solo se vuoi i numeri "Visite" e "Click" in dashboard.

---

## 1. Touchpoint supportati

| Touchpoint | Stato | Note |
|------------|-------|------|
| **Landing page** | Da abilitare | Richiede tracking UTM o beacon su comtra.dev |
| **Plugin Figma** | Attivo | Default: utenti da OAuth Figma (nessuna configurazione) |
| **Pagina LinkedIn** | Link non ancora attivo | Quando il link ufficiale è live, tracciare con UTM |
| **Instagram** | Futuro | Stesso schema UTM quando la pagina sarà attiva |
| **TikTok** | Futuro | Stesso schema UTM quando la pagina sarà attiva |

---

## 2. Schema database

- **touchpoint_events**: eventi generici (visit, click, signup, usage, upgrade)
- **user_attribution**: first-touch per utente (quale touchpoint ha portato l’utente)
- **users.signup_source**: colonna opzionale per retrocompatibilità

Migration: `auth-deploy/migrations/005_touchpoint_funnel.sql`

---

## 3. Integrazione landing page

**Non serve riportare gli UTM da nessuna parte:** li metti sui link, il backend li legge al login e li salva. La dashboard mostra tutto da sola.

### UTM al signup (già gestito dal backend)

Su **ogni link** del sito che porta al login/plugin usa gli UTM. Dalla **landing** (browser) usa **init con redirect** così l’utente viene portato al login Figma in una sola click:

```
https://auth.comtra.dev/auth/figma/init?utm_source=landing&utm_medium=website&redirect=1
```

Con `redirect=1` l’utente viene reindirizzato alla finestra di login Figma e il backend salva l’attribuzione al completamento. Senza `redirect=1`, init restituisce JSON (uso dal plugin). Il backend:
- in **init** inoltra i parametri nell’URL di start;
- in **start** salva gli UTM nello stato del flusso;
- in **callback** (dopo il login) scrive in `user_attribution` (source = landing | linkedin | instagram | tiktok in base a `utm_source`).

Valori utili per `utm_source`: `landing`, `linkedin`, `instagram`, `tiktok`. Assegna tu i valori che vuoi (es. `utm_campaign=hero`, `footer`, ecc.): il backend li salva e li gestisce.

### Visite e click in dashboard (beacon)

Per tracciare **visite** e **click** (anche anonimi) e vederli in Funnel touchpoint:

**Endpoint:** `POST https://auth.comtra.dev/api/touchpoint-event`

**Body (JSON):**
```json
{ "source": "landing", "event_type": "visit" }
```
```json
{ "source": "landing", "event_type": "click", "metadata": { "utm_campaign": "cta_hero" } }
```

- `source`: `landing` | `plugin` | `linkedin` | `instagram` | `tiktok`
- `event_type`: `visit` | `click` (per anonimi; signup/usage/upgrade sono gestiti dal backend)
- `metadata`: opzionale, oggetto libero

**Sicurezza (opzionale):** in produzione imposta la variabile d’ambiente `TOUCHPOINT_EVENT_KEY` sul progetto auth; la landing invia lo stesso valore in header `X-Touchpoint-Key`. Se non imposti la key, l’endpoint accetta tutte le richieste (adatto solo a staging o se il dominio è privato).

**Esempio dalla landing (JavaScript):**
```js
// All’ingresso pagina (visit)
fetch('https://auth.comtra.dev/api/touchpoint-event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Touchpoint-Key': 'LA_TUA_KEY' },
  body: JSON.stringify({ source: 'landing', event_type: 'visit' }),
});

// Al click su “Prova il plugin” (click)
fetch('https://auth.comtra.dev/api/touchpoint-event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Touchpoint-Key': 'LA_TUA_KEY' },
  body: JSON.stringify({ source: 'landing', event_type: 'click', metadata: { cta: 'hero' } }),
});
```

---

## 4. Integrazione pagina LinkedIn

Quando il link ufficiale della pagina LinkedIn è attivo, usare UTM su tutti i link (es. `utm_source=linkedin&utm_medium=social`) verso la pagina plugin o verso la landing.

---

## 5. Link tracciabile nel footer del post (trophy) → landing

Nei post che fai per i trophy (es. share su LinkedIn) puoi mettere in **footer** un link che porta alla **landing** invece che al plugin. Così tracci da dove arriva il traffico (post LinkedIn, ecc.).

**Cosa fare:**

1. **URL del link in footer:** punta alla landing con UTM chiari, es.  
   `https://comtra.dev?utm_source=linkedin&utm_medium=post_footer&utm_campaign=trophy_share`  
   (o `utm_content=footer` / nome campagna a piacere).

2. **In dashboard:**  
   - Se sulla landing usi il beacon (§ 3), alla **visita** puoi leggere i parametri dalla URL e inviare `source: 'linkedin'` (o il valore di `utm_source`) così in Funnel touchpoint vedi le visite da "Pagina LinkedIn".  
   - Esempio: se in URL c’è `utm_source=linkedin`, alla load della pagina fai  
     `POST /api/touchpoint-event` con `{ "source": "linkedin", "event_type": "visit", "metadata": { "utm_medium": "post_footer" } }`.

In questo modo: **post → click sul link in footer → landing** resta tracciato come provenienza LinkedIn (o altro canale che usi in `utm_source`).

---

## 6. Dashboard

La pagina **Brand awareness → Funnel touchpoint** (`/brand-awareness/funnel`) mostra per ogni touchpoint:

- **Visite** e **Click**: da `touchpoint_events` (beacon dalla landing)
- **Ingressi (tot)**: visite + click + signup da quel touchpoint
- **Primo utilizzo**: utenti che hanno usato almeno una funzione (credit_transactions)
- **Upgrade PRO** e **PRO attivi**

---

## 7. Dati di tracciamento landing

Puoi anche esportare eventi da Google Analytics / Plausible e inserirli in `touchpoint_events` con uno script; oppure usare solo il beacon (vedi § 3). Formato tabelle: `auth-deploy/migrations/005_touchpoint_funnel.sql`.
