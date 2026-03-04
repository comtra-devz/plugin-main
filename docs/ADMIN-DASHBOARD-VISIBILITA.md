# Come rendere visibile la dashboard admin (solo a voi)

La dashboard **non** è nel plugin e **non** va linkata dal sito pubblico. È visibile solo a chi ha l’URL e (opzionale) il secret. Ecco come averla “sotto mano” senza esporla.

---

## 1. Dove “vive” la dashboard (URL)

Dopo il deploy su Vercel (vedi [ADMIN-DASHBOARD-DEPLOY-VERCEL.md](./ADMIN-DASHBOARD-DEPLOY-VERCEL.md)) avrai **uno o due URL**:

| Tipo | Esempio | Quando |
|------|--------|--------|
| **Vercel default** | `https://comtra-admin-dashboard-xxx.vercel.app` | Subito dopo il primo deploy. |
| **Dominio custom** | `https://admin.comtra.dev` | Dopo aver aggiunto il dominio in Vercel e configurato il CNAME in DNS. |

La dashboard è **visibile** aprendo uno di questi URL nel browser. Non c’è login nella UI: l’autenticazione avviene “in silenzio” tramite l’header che la SPA invia alle API (`ADMIN_SECRET`). Chi non conosce l’URL (e in futuro, se aggiungerete un check lato server, chi non ha il secret) non può usarla.

---

## 2. Come aprirla (uso quotidiano)

- **Bookmark:** aggiungi ai preferiti del browser l’URL scelto (es. `https://admin.comtra.dev`). Usa un nome chiaro tipo “Comtra Admin”.
- **Documento interno:** tieni l’URL in un doc condiviso solo con il team (Notion, Google Doc, password manager aziendale). Così gli altri admin sanno dove andare senza cercare.
- **Barra indirizzi:** basta incollare l’URL o digitarlo (se breve, es. admin.comtra.dev).

Non serve “pubblicarla” da nessuna parte: è sufficiente che gli admin conoscano l’indirizzo e lo usino quando serve.

---

## 3. Come condividerla con altri admin (senza esporla)

- **Condivisione diretta:** invia l’URL (e, se usate una “password” o secret condiviso, le istruzioni) via canale privato (Slack interno, email, 1:1).
- **Un solo URL per tutti:** la dashboard usa lo stesso `VITE_ADMIN_SECRET` per tutti; chi ha l’URL e apre la pagina invia automaticamente il secret (incluso nel build). Quindi **chi ha l’URL può vedere la dashboard**. Se volete restringere ulteriormente:
  - **Opzione A:** tenete l’URL “segreto” (solo chi lo conoscete può accedere).
  - **Opzione B (futuro):** aggiungere un login (es. password unica o allowlist email) prima di mostrare la SPA; l’URL resta uguale, ma senza login non si vede nulla.

Per ora la visibilità si controlla **non linkando** la dashboard da:
- sito pubblico Comtra  
- plugin Figma  
- README pubblici  
- sitemap o motori di ricerca  

E condividendo l’URL solo con chi deve usarla.

---

## 4. Checklist “dashboard visibile”

- [ ] Deploy completato (secondo progetto Vercel, root `admin-dashboard`).
- [ ] Env impostate: `POSTGRES_URL`, `ADMIN_SECRET`, `VITE_ADMIN_SECRET` (stesso valore).
- [ ] Apertura dell’URL (`.vercel.app` o dominio custom): la Home si carica e mostra dati (non 401, non pagina bianca).
- [ ] Bookmark o doc interno con l’URL per te e gli altri admin.
- [ ] Nessun link alla dashboard da sito/plugin/README pubblico.

---

## 5. Riepilogo

| Domanda | Risposta |
|--------|----------|
| **Dove si apre?** | Nel browser, all’URL del progetto Vercel (es. `https://admin.comtra.dev`). |
| **Come la trovo?** | Bookmark, doc interno, o digitando l’URL. Non è raggiungibile dal sito/plugin. |
| **Chi può vederla?** | Chiunque con l’URL (il secret è nel build della SPA). Per limitare: non diffondere l’URL; in futuro si può aggiungere login. |
| **Come la rendo “visibile” al team?** | Condividi l’URL (e eventuali istruzioni) in canale privato o doc interno. |

In sintesi: la dashboard è **visibile** aprendo il suo URL; la **rendi disponibile** agli admin condividendo quell’URL in modo riservato e tenendola fuori da tutto ciò che è pubblico.
