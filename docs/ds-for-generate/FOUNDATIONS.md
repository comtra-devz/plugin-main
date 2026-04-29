# Fondamenti — DS nel contesto Generate

## In due frasi

Il design system **esiste nel file Figma** (e nell’export che Comtra indicizza). Generate **non** crea nuovi componenti libreria: compone nodi usando **solo** riferimenti ammessi dal contratto (variabili, istanze da indice DS, azioni primitive dove obbligatorio).

## Concetti base

- **Variabili / token**  
  Percorsi come riferimenti al sistema di variabili Figma — il modello deve usare quelli previsti dal DS, non hex o px “a sentimento” dove il contratto richiede binding.

- **Componenti istanziabili**  
  Chiavi o id presenti nel **DS context index** (prompt-scoped). Se non compare nell’index per quel file/prompt scope, non è una scelta valida per quella generazione.

- **Primitive (frame, text, rect)**  
  Usate quando non c’è un componente DS adatto o quando la politica di qualità richiede fallback (vedi validator e messaggi errore nel motore).

## Cosa è già definito nel codice (non ripetere qui le tabelle)

- Schema action plan e validazione: `docs/GENERATION-ENGINE-RULESET.md` e codice in `auth-deploy/oauth-server/`.
- Come si costruisce l’index e le performance: `docs/DS-CONTEXT-INDEX-PERFORMANCE.md`.

Questo file serve a **allineare il linguaggio** tra PM, design e chi scrive prompt; non sostituisce le definizioni eseguibili.
