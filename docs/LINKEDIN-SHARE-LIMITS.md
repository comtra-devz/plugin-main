# Limitazioni share LinkedIn (share-offsite)

Questo doc spiega **perché** lo share che apre LinkedIn non può mostrare il testo del post già scritto nel box, e cosa **possiamo** controllare (foto, link, anteprima).

---

## Cosa supporta LinkedIn oggi

L’URL ufficiale per condividere un link è:

```text
https://www.linkedin.com/sharing/share-offsite/?url=<URL_DA_CONDIVIDERE>
```

**LinkedIn accetta solo il parametro `url`.**  
Parametri come `title`, `summary`, `text` che esistevano in versioni vecchie (shareArticle, cws/share) **non sono più supportati** e vengono ignorati. Non è un bug nostro: è una limitazione voluta di LinkedIn (anti-spam, controllo dell’esperienza).

Quindi:
- **Sì**: possiamo aprire la finestra di condivisione con un **link** (es. `https://comtra.dev/trophy/NOVICE_SPROUT`).
- **No**: non possiamo pre-compilare il **testo del post** nella finestra di LinkedIn tramite URL.

---

## Cosa controlliamo noi (foto, titolo, descrizione del link)

Quando l’utente condivide un **url**, LinkedIn fa una richiesta a quel url e legge i **meta tag Open Graph** della pagina. Da lì prende:

- **Immagine** → `og:image` (es. 1200×627)
- **Titolo** → `og:title`
- **Descrizione** → `og:description`

Quindi:
- **Foto e “tag” della pagina** (titolo/descrizione dell’anteprima) **dipendono dalle pagine che noi mettiamo online** (es. le 20 pagine `comtra.dev/trophy/{ID}` con og:image e meta tag). Vedi [LINKEDIN-TROPHY-PAGES-FIGMA-MAKE.md](./LINKEDIN-TROPHY-PAGES-FIGMA-MAKE.md).
- **Il link** condiviso è quello che passiamo in `?url=...` (es. pagina trophy o landing).

Riassunto: **foto, link e “tag” (anteprima) sono sotto il nostro controllo** tramite le pagine e gli og:; **il testo che l’utente scrive nel post no**, non è impostabile via share-offsite.

---

## Come abbiamo implementato il flusso (trofei)

Dato che il testo non può essere pre-compilato nella finestra LinkedIn:

1. **Apriamo** la share con solo l’**url** della pagina trophy (o landing):  
   `share-offsite/?url=https://comtra.dev/trophy/{ID}`  
   → LinkedIn mostrerà l’anteprima (foto, titolo, descrizione) presa dagli og: di quella pagina.

2. **Copiamo negli appunti** il testo del post (quello che abbiamo per ogni trofeo).  
   L’utente incolla manualmente il testo nel box di LinkedIn prima di pubblicare.

Questo è il **massimo che si può fare** con il solo share-offsite, senza usare le API LinkedIn.

---

## Se un giorno volessimo il testo già nel box

Per avere il testo del post **pre-compilato** nella finestra LinkedIn servirebbe:

- **LinkedIn UGC API** (User Generated Content) con **OAuth 2.0** e scope `w_member_social`
- App registrata nel [LinkedIn Developer Portal](https://developer.linkedin.com/)
- L’utente che fa login con LinkedIn e poi noi che inviamo un **POST** a `https://api.linkedin.com/v2/ugcPosts` con il testo

È un’integrazione molto più pesante (login LinkedIn, permessi, backend). Per ora il flusso “url + copy testo negli appunti” è la soluzione compatibile con i limiti attuali di share-offsite.

---

## Riferimenti

- [Share on LinkedIn (Microsoft Learn)](https://developer.linkedin.com/docs/share-on-linkedin) — documentazione ufficiale
- Discussioni su parametri deprecati: ad es. [Stack Overflow – share-offsite deprecated/broken](https://stackoverflow.com/questions/71613355), [LinkedIn stripping parameters](https://stackoverflow.com/questions/60062478)

---

**In sintesi**: non è che “non funziona” lo share: **funziona** per link e anteprima (foto/tag). Il testo del post non arriva nel box perché **LinkedIn non lo permette** via URL; lo gestiamo con la copia negli appunti e l’incolla manuale. Foto, link e tag della pagina si controllano mettendo online le pagine con gli og: giusti.
