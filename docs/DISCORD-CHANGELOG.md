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

## 5. Sicurezza

- **Non committare** l’URL del webhook (tienilo solo in `.env`; `.env` è in `.gitignore`).
- Se l’URL viene esposto: su Discord rigenera o elimina il webhook e creane uno nuovo.
