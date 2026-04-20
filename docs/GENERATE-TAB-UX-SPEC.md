# Generate tab — specifica UX e allineamento prodotto

Documento di lavoro: moduli della main tab Generate, dipendenze con l’A/B test, bar di qualità (agent loop × Figma), gap tecnici nel plugin.

---

## 1. Bar di riferimento: Agent loop × Figma (senza MCP)

Un pattern diffuso di integrazione **agent CLI ↔ Figma Desktop** usa bridge locale read/write al documento (DevTools / desktop), senza MCP obbligatorio, con ciclo “agente ↔ canvas” molto stretto.

**Cosa rende quel flusso “forte” percepito**

- Contesto **reale** sul file (layer, struttura, token se esposti).
- Iterazione rapida (comandi che diventano modifiche visibili subito).
- Possibilità di **memoria di contesto** (es. `CLAUDE.md` con convenzioni del team).

**Comtra (plugin + Kimi + API)** non replica 1:1 l’architettura del CLI:

- Non comanda Figma via DevTools; usa **Plugin API** + (dove serve) **REST** file key + contesto inviato al backend.
- Il **costo** è principalmente **token LLM** + infrastruttura, non la stessa curva del “desktop bridge”.
- L’obiettivo prodotto è avvicinare la **qualità percepita** dell’output (struttura, aderenza al DS, rispetto del target) **entro** questo modello, misurando con **A/B** (es. piano ASCII prima del JSON vs piano diretto).

---

## 2. Come incide l’A/B test (executive)

| Livello | Ruolo |
|--------|--------|
| **Box UI** | Definiscono **perimetro** e **istruzioni**: cosa è selezionato, quale DS/library come riferimento, cosa chiede l’utente nel terminale (+ link Figma incollati). |
| **Variante A / B** | Decide **come** il modello produce il piano (diretto vs wireframe ASCII → piano). Non sostituisce i tre box: li **consuma** (prompt, `mode`, `ds_source`, eventuale contesto file). |
| **Dashboard A/B** | Confronta performance (token, latenza, crediti, feedback) tra varianti. |

In sintesi: **stesso input utente**, **due pipeline di ragionamento**; i tre moduli restano la “single source of truth” per intent e contesto.

---

## 3. Moduli della main tab (target)

### 3.1 Spiegazione principale (“Generation Logic”)

- Box informativo in cima (come oggi), aggiornato se cambia il copy.
- Deve chiarire in modo **esecutivo**:
  - nessuna selezione → creazione da zero;
  - selezione attiva → modifica **contestuale** (copia / branch sicuro — allineare il messaggio legale/UX con il comportamento reale del plugin);
  - screenshot (se attivo) → riferimento visivo verso componenti DS;
  - link Figma nel prompt → riferimenti a frame/file.

### 3.2 Context Layer (solo contesto, **senza** Design System)

**Obiettivo:** riflettere la **selezione corrente in Figma**, non un mock da pulsante.

- **Rimuovere** il pulsante “Select Layer” / mock toggle che imposta `Hero_Section_V2`.
- **Mostrare** la UI “Target: …” solo quando la selezione è **valida** (frame, group, section, component, instance, ecc. — stessi tipi che già classificate in `get-file-context` / `selectionType`).
- **Vuoto:** messaggio tipo *Nessun layer selezionato. Crea nuovi wireframe o carica uno screenshot* + area upload (come oggi).
- **Opzionale:** “Clear” solo se ha senso (es. l’utente vuole ignorare temporaneamente la selezione senza deselezionare in canvas) — da decidere; non è il focus principale.

**Tecnico (gap attuale):** in `controller.ts` esiste `get-selection` → `selection-changed`, ma **non** c’è un listener globale `figma.on('selectionchange')` che mantenga la UI sincronizzata. Per il Generate tab serve:

- `figma.on('selectionchange', …)` → `postMessage` verso UI con `name`, `id`, `type` (e opzionalmente `mainComponent` per instance);
- oppure polling `get-selection` mentre la tab Generate è attiva.

La UI Generate deve ricevere questi dati (probabilmente via `App.tsx` → props callback, come per altri messaggi dal controller).

### 3.3 Design System (box **separato**, sotto Context Layer)

**Obiettivo:** perimetro di **riferimento stilistico / libreria**.

- **Default obbligatorio:** “Current file / librerie collegate” (equivalente concettuale di `Custom (Current)` oggi) — la select **non** può essere vuota.
- **Altre voci:** preset noti (Material, iOS, …) come oggi nel dropdown, o in futuro elenco librerie “aperte” se esponete API/plugin per enumerarle.

**Backend:** continuare a mappare su `ds_source` (es. `custom` vs nome preset) come già in `fetchGenerate`.

### 3.4 AI Terminal (nome TBD)

**Obiettivo:** unico posto dove l’utente **scrive** l’intent operativo per Kimi.

- **Rimuovere** “Inject Fake Link” (solo dev/test).
- **Mantenere / rafforzare** paste di link Figma → chip (già presente con regex); allineare copy a *“Incolla link ai frame (come da Figma → Copy link)”*.
- **Placeholder** dipendente da selezione (già in parte: modify vs create).
- **Suggerimenti sotto** (3 chip): possono essere **dinamici** in produzione; per ora usare 3 esempi che insegnano la logica:
  1. Creazione da zero (es. *“Schermata login desktop con email, password, link password dimenticata”*).
  2. Modifica con selezione (es. *“Riduci questo frame a layout mobile, mantieni gerarchia tipografica”*).
  3. Riferimento + link (es. *“Allinea questa hero allo stile del frame nel link incollato”*).

### 3.5 CTA primaria

- **Abilitata solo se** c’è testo (non solo spazi) nel terminale — allineato alla richiesta *“solo dopo aver scritto il prompt”*.
- **Label dinamica** (esempi):
  - nessuna selezione → *Genera wireframe* / *Crea wireframe*;
  - selezione attiva → *Modifica selezione* / *Applica alla copia* (copy da allineare al “Generation Logic”);
  - (opzionale) con screenshot e senza selezione → variante testuale se volete enfatizzare il flusso “da immagine”.

---

## 4. Checklist implementazione (ordine suggerito)

1. [ ] `selectionchange` nel plugin + messaggio verso UI; stato `selectedNode: { id, name, type } | null` in Generate.
2. [ ] Rimuovere mock Select Layer; mostrare target solo da stato reale.
3. [ ] Spezzare il card unico in **due** card: Context Layer | Design System.
4. [ ] Rimuovere blocco “Inject Fake Link”; raffinare copy terminale e chip suggerimenti.
5. [ ] CTA: `disabled` se `!prompt.trim()`; label da tabella selezione/prompt.
6. [ ] (Follow-up) Upload screenshot: oggi simulato — collegare a vero file → base64/URL secondo contratto API.
7. [ ] (Follow-up) Enumerazione librerie Figma “aperte” se prodotto lo richiede.

---

## 5. Riferimenti esterni (lettura)

- Pattern generici di integrazione agent CLI ↔ Figma Desktop.
- Repository e tutorial esterni usati solo come benchmark concettuale.

---

*Ultimo aggiornamento: allineamento con conversazione prodotto + stato codebase (`views/Generate.tsx`, `controller.ts`).*
