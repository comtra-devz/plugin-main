# EU AI Act UX Checklist (Comtra)

Scopo: tradurre i requisiti di trasparenza/oversight in controlli UX concreti per `plugin` e `webapp`.

Nota: questa checklist non sostituisce consulenza legale; serve come baseline di prodotto/design engineering.

---

## 1) AI Disclosure (utente sa che interagisce con AI)

- [ ] Ogni risposta AI nel plugin mostra un label persistente visibile (es. `AI-generated` / `Generated with AI`).
- [ ] Ogni vista web che mostra output AI usa la stessa disclosure, non solo testo in footer/ToS.
- [ ] Il label resta visibile anche dopo refresh/reopen sessione (non solo primo render).
- [ ] La disclosure compare anche in stati errore/fallback se il contenuto arriva comunque da pipeline AI.

**Acceptance criteria**
- [ ] Test manuale: 5 output consecutivi (audit/generate) mostrano sempre il label senza eccezioni.
- [ ] Nessun output AI è renderizzato senza disclosure in plugin e webapp.

---

## 2) AI Content Labeling (etichetta per-item)

- [ ] Ogni item di output AI include metadata minimi: `generated_by_ai`, `created_at`, `source` (plugin/web/api).
- [ ] In history/dashboard, gli elementi generati da AI sono distinguibili da eventi non-AI.
- [ ] Export JSON include flag AI e provenance minima.

**Acceptance criteria**
- [ ] `GET /api/history` consente di identificare chiaramente eventi AI vs non-AI.
- [ ] Export dashboard contiene campi coerenti per tracciabilità.

---

## 3) Explainability + Human Review Path

- [ ] Ogni raccomandazione AI ha una spiegazione sintetica (“perché questo suggerimento”).
- [ ] Esiste una CTA esplicita per escalation/review umana (es. `Request human review`).
- [ ] La CTA è disponibile nel punto di decisione, non nascosta in pagine secondarie.

**Acceptance criteria**
- [ ] Da un output AI reale l’utente raggiunge la review umana in <= 2 click.
- [ ] La spiegazione è visibile senza aprire log tecnici.

---

## 4) Input Safety (UI layer)

- [ ] Prompt/input fields mostrano warning su dati sensibili e uso sicuro.
- [ ] Presenza di validazioni base lato UI (lunghezza, pattern pericolosi, input vuoto).
- [ ] Error messaging chiaro quando un input è bloccato da policy.

**Acceptance criteria**
- [ ] Input volutamente non conforme produce messaggio comprensibile + azione correttiva.
- [ ] Nessun crash/UI freeze su input anomali o eccessivi.

---

## 5) Human Override / Kill Switch

- [ ] Presenza di un meccanismo di stop rapido per feature AI (feature flag o toggle operativo).
- [ ] Stato di override visibile in UI/admin (non implicito).
- [ ] Fallback UX definito quando AI è disabilitata (messaggio + percorso alternativo).

**Acceptance criteria**
- [ ] Disabilitando AI, il prodotto resta usabile con percorso degradato dichiarato.
- [ ] Il cambio di stato override è auditabile (timestamp + actor).

---

## 6) Session & Authentication Hygiene

- [ ] Session state chiaro in UI (`signed in as`, logout esplicito, token/session invalid path).
- [ ] Nessun contenuto AI personale è mostrato dopo logout.
- [ ] Errori auth hanno messaggi comprensibili (expired/unauthorized/reconnect).

**Acceptance criteria**
- [ ] Logout invalida la vista sensibile e richiede nuovo login per accedere ai dati.
- [ ] Test “session restore” non espone dati di utente precedente.

---

## 7) Auditability (prodotto + compliance evidence)

- [ ] Logging minimo eventi compliance-critical: disclosure shown, review requested, override toggled.
- [ ] Tracciamento versione pattern/disclosure attiva al momento dell’azione.
- [ ] Evidenza esportabile per audit interno.

**Acceptance criteria**
- [ ] Per un output AI campione, si può ricostruire: disclosure mostrata, azione utente, eventuale review.

---

## 8) Rollout plan consigliato (Comtra)

### Phase A (subito)
- [ ] Label persistente AI su plugin e web.
- [ ] Per-item labeling in history/export.
- [ ] Warning input safety base.

### Phase B (breve)
- [ ] Explainability sintetica per output principali.
- [ ] CTA review umana nel flusso.
- [ ] Logging compliance events.

### Phase C (hardening)
- [ ] Kill switch operativo + fallback UX completo.
- [ ] Review periodica pattern contro evoluzione normativa.

---

## 9) Definition of Done (release gate)

- [ ] Tutti i check Phase A completati.
- [ ] Nessun output AI senza disclosure in regression test manuale.
- [ ] Almeno 1 scenario end-to-end documentato: login -> output AI -> explanation -> human review path.
- [ ] Changelog interno aggiornato con decisioni UX compliance.

