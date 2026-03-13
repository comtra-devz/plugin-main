# Changelog su Discord (webhook)

Dopo ogni commit viene inviato su Discord un **riassunto chiaro** delle modifiche (per area: Plugin, Dashboard, Backend, Documentazione), ricavato dal diff **senza usare AI** — solo regole sul tipo di file e sul contenuto.

---

## 1. URL del webhook

Copialo da Discord: **Impostazioni canale → Integrazioni → Webhook → Crea webhook → Copia URL**.

Mettilo nel file **`.env`** nella root del repo (non committarlo):

```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/abcdef...
```

---

## 2. Automatismo: invio dopo ogni commit

**Una volta sola** installa l’hook git:

```bash
chmod +x scripts/install-discord-hook.sh
./scripts/install-discord-hook.sh
```

Da quel momento, **ogni volta che fai `git commit`**, lo script parte in automatico e invia su Discord il riassunto dell’ultimo commit (cosa è cambiato in Plugin, Dashboard, Backend, Docs).

- L’hook usa il `.env` nella root per `DISCORD_WEBHOOK_URL`, quindi non serve fare nulla a ogni commit.
- Per disattivare: rimuovi l’hook con `rm .git/hooks/post-commit`.

---

## 3. Cosa appare su Discord

Non solo il messaggio del commit: lo script **legge le modifiche nel codice** e le raggruppa per area, con descrizioni leggibili.

Esempio:

**Comtra — aggiornamento**

**Backend**  
• Migration **005_touchpoint_funnel**: 2 tabella/e.  
• **touchpoint-event.mjs**: POST /api/touchpoint-event.

**Documentazione**  
• **TOUCHPOINT-FUNNEL.md** aggiornato.

**Dashboard**  
• **TouchpointFunnel** (TouchpointFunnel.tsx).

_Commit:_ feat: funnel touchpoint + doc

---

## 4. Uso a mano (senza hook)

Se vuoi inviare gli ultimi N commit senza aver fatto l’installazione dell’hook:

```bash
# .env già con DISCORD_WEBHOOK_URL
node scripts/notify-discord.mjs 5
```

(5 = ultimi 5 commit; default 1.)

---

## 5. Notifiche admin → Discord (automatico)

Le **notifiche della dashboard admin** (stato Kimi, PRO in scadenza, throttle, supporto, ecc.) vengono inviate su un canale Discord **in automatico** tramite **cron Vercel** (una volta al giorno).

### Configurazione (progetto dashboard su Vercel)

1. Crea un **nuovo webhook** nel canale Discord dove vuoi ricevere le notifiche (come per i commit) e copia l’URL.
2. Nel **progetto Vercel della dashboard admin** imposta le variabili d’ambiente:
   - **`ADMIN_NOTIFICATIONS_WEBHOOK_URL`** — URL del webhook Discord (es. `https://discord.com/api/webhooks/...`).
   - **`ADMIN_SECRET`** — stesso segreto usato dalla dashboard per le API admin (già presente).
   - **`CRON_SECRET`** — una stringa segreta a piacere (es. `openssl rand -hex 32`). Vercel la invia nell’header `Authorization: Bearer <CRON_SECRET>` quando lancia il cron; l’endpoint la verifica per accettare solo richieste dal cron.
3. Rideploya la dashboard. Il cron è definito in **`admin-dashboard/vercel.json`**:
   - **Path:** `GET /api/cron-notify-discord`
   - **Schedule:** `0 8 * * *` (ogni giorno alle 08:00 UTC, es. 09:00/10:00 in Italia). Puoi modificare `schedule` in `vercel.json` se vuoi un orario diverso.

A ogni esecuzione, Vercel chiama l’endpoint; l’endpoint legge le notifiche da `/api/admin?route=notifications` e invia il riepilogo su Discord. Se non ci sono notifiche, non viene inviato alcun messaggio (l’endpoint risponde 200 con `sent: 0`).

### Uso a mano (opzionale)

Puoi anche invocare l’endpoint a mano (es. per test) con lo stesso segreto:

```bash
curl -H "Authorization: Bearer IL_TUO_CRON_SECRET" "https://admin.tuo-dominio.dev/api/cron-notify-discord"
```

Oppure con query param: `?key=IL_TUO_CRON_SECRET`.

---

## 6. Sicurezza

- **Non committare** l’URL del webhook (tienilo solo in `.env`; `.env` è in `.gitignore`).
- Se l’URL viene esposto: su Discord rigenera o elimina il webhook e creane uno nuovo.
