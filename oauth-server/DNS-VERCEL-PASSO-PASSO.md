# DNS per comtra.dev su Vercel – Passo dopo passo

L’ordine è: **prima aggiungi il dominio su Vercel**, poi **Vercel ti dice cosa scrivere** nel pannello DNS del tuo provider (quello con “Aggiungi un record alla zona DNS”).

---

## Parte 1 – Cosa fa Vercel e cosa fa il DNS

- **Vercel** ti dice: “Per usare comtra.dev (o auth.comtra.dev) con il mio progetto, nel DNS del dominio metti **questo tipo** di record con **questo valore**.”
- **Il pannello DNS** (dove sei tu ora) è dove inserisci **esattamente** tipo e valore che Vercel ti ha indicato.

Quindi: **non devi indovinare**. Devi prima andare su Vercel, aggiungere il dominio, e copiare ciò che Vercel mostra.

---

## Parte 2 – Su Vercel: aggiungere il dominio e leggere le istruzioni

1. Apri il **progetto** su [vercel.com](https://vercel.com) (quello del plugin/OAuth).
2. Vai in **Settings** → **Domains**.
3. Clicca **Add** e scrivi **il nome del dominio** che vuoi usare. Due possibilità:
   - **`comtra.dev`** (dominio principale), oppure  
   - **`auth.comtra.dev`** (sottodominio, consigliato se comtra.dev è già usato per un altro sito).

4. Clicca **Add** (o **Continue**).
5. Vercel mostrerà una schermata tipo **“Configure your DNS”** con una tabella. Esempio di cosa puoi vedere:

   | Tipo  | Nome / Host | Valore / Destinazione   |
   |-------|-------------|--------------------------|
   | **A** | `@`         | `76.76.21.21`            |
   | oppure |            |                          |
   | **CNAME** | `@` o `auth` | `cname.vercel-dns.com` |

   - **Tipo** = tipologia di record (A o CNAME).
   - **Nome** = cosa mettere nel campo “Sottodominio” nel tuo pannello (vedi sotto).
   - **Valore** = cosa mettere nel campo “Destinazione” nel tuo pannello.

6. **Annota** (o lascia aperta la pagina) con:
   - la **tipologia** (A o CNAME),
   - il **nome/host** che Vercel indica (@ o auth, ecc.),
   - il **valore** (IP per A, oppure hostname per CNAME).

Queste sono le uniche “info” che ti servono: le prendi da lì, non da altro.

---

## Parte 3 – Nel pannello DNS del provider (il modulo che vedi tu)

Sei nel modulo **“Aggiungi un record alla zona DNS”** con:
- **Sottodominio**
- **TTL** (puoi lasciare “Standard”)
- **Destinazione** (obbligatorio)

### Come si traducono le istruzioni di Vercel

- **“Nome” su Vercel** → **“Sottodominio” nel tuo modulo**
  - Se Vercel dice **`@`** (root): nel campo Sottodominio lascia **vuoto** (oppure metti `@` se il provider lo richiede). Così il record vale per **comtra.dev**.
  - Se Vercel dice **`auth`**: nel campo Sottodominio scrivi **`auth`**. Così il record vale per **auth.comtra.dev** (il “.comtra.dev.” che vedi accanto al campo è giusto che resti lì).

- **“Valore” su Vercel** → **“Destinazione” nel tuo modulo**
  - Se il **tipo** su Vercel è **A**: in Destinazione incolla l’**indirizzo IP** che Vercel ti dà (es. `76.76.21.21`).
  - Se il **tipo** su Vercel è **CNAME**: in Destinazione incolla l’**hostname** che Vercel ti dà (es. `cname.vercel-dns.com`).

- **Tipologia del record**
  - Il tuo modulo adesso è su “record **A**” (“Il record A generato è: IN A”).
  - Se **Vercel** ti ha detto di usare un record **A**, resta su **A** e in Destinazione metti l’**IP**.
  - Se **Vercel** ti ha detto di usare un **CNAME**, nel tuo pannello devi **cercare l’opzione per creare un record CNAME** (a volte è un altro pulsante/voce tipo “Aggiungi record” e scegli “CNAME”). Poi:
    - Sottodominio: come sopra (@ vuoto per root, oppure `auth`).
    - Destinazione: il valore CNAME che Vercel ti ha dato (es. `cname.vercel-dns.com`).

In sintesi: **tipologia** = quella che dice Vercel (A o CNAME). **Cosa inserire** = nome/host in “Sottodominio” e valore in “Destinazione”, **copiati da Vercel**.

---

## Attenzione al messaggio che vedi

Hai il messaggio: **“per questo dominio è già stato inserito un IP di destinazione”**.

Significa che per **comtra.dev** (root) esiste già un record (es. un A) che punta da qualche parte (altro hosting, altro IP).

- Se vuoi usare **solo un sottodominio** per Vercel (es. solo OAuth):
  - Su Vercel aggiungi **`auth.comtra.dev`**.
  - Nel DNS aggiungi un **nuovo** record (A o CNAME come da Vercel) con **Sottodominio = `auth`** e **Destinazione** = valore indicato da Vercel.
  - Non tocchi il record esistente del root; comtra.dev continua a puntare dove punta ora, auth.comtra.dev punta a Vercel.

- Se invece vuoi che **tutto comtra.dev** vada su Vercel:
  - Dovrai **modificare** il record esistente del root (o rimuoverlo e ricrearlo) con l’**IP o CNAME** che Vercel ti dà per `@` / comtra.dev.

Per il plugin OAuth va benissimo usare **solo auth.comtra.dev** e lasciare il resto com’è: su Vercel aggiungi `auth.comtra.dev`, nel DNS crei solo il record per “auth”, e imposti **BASE_URL** e Redirect URL Figma su `https://auth.comtra.dev`.

---

## Riepilogo in 4 punti

1. **Dove trovo le info?** → Su **Vercel**, dopo aver fatto **Add** del dominio (comtra.dev o auth.comtra.dev): la schermata “Configure your DNS” con tipo, nome e valore.
2. **Tipologia?** → Quella che Vercel indica: **A** (IP) oppure **CNAME** (hostname). Nel tuo modulo scegli il tipo di record corrispondente (A o CNAME).
3. **Cosa inserire?** → **Sottodominio** = nome/host di Vercel (@ = vuoto per root, `auth` per auth.comtra.dev). **Destinazione** = valore che Vercel ti dà (IP per A, hostname per CNAME).
4. **Record già presente per comtra.dev?** → Usa il sottodominio **auth.comtra.dev** e crea solo il record per “auth”; così non modifichi il sito principale.

Dopo aver salvato il record, aspetta qualche minuto (fino a ore in rari casi): su Vercel lo stato del dominio diventerà **Valid** quando il DNS si sarà aggiornato.
