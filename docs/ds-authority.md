# Autorità del Design System (Comtra)

Questo documento definisce **cosa conta davvero** quando DS importato, prompt del server, validator e documentazione sembrano divergere. Serve al team per decidere cosa aggiornare senza dibattiti infiniti.

## Ordine di priorità (dal più vincolante)

1. **Dati nel file Figma dell’utente**  
   Componenti, varianti, variabili e struttura effettivi del documento DS importato o del file di lavoro. Se il DS non contiene un componente, Generate non può “inventarlo”.

2. **Indice DS nel contesto di Generate** (`ds-context-index`, snapshot slim inviato al backend con hash/cache)  
   È il ritaglio macchina-consultabile di ciò che il modello deve usare per `INSTANCE_COMPONENT`, token path, ecc. **Se un id non è nell’index scopo-prompt, non è una scelta valida** per quel turno — anche se compare in un vecchio esempio nei prompt.

3. **Contratto server-side** (`auth-deploy/prompts/generate-system.md` e pipeline correlata) + **validator** in `oauth-server`  
   Formato dell’action plan, enforcement schema/DS/index, repair pass. Questo è ciò che **può bloccare** una risposta errata del modello.

4. **Design Intelligence / playbook / pattern pack** (pattern archetype, content defaults, ecc.)  
   Guidano composizione e tono quando il livello precedente permette più interpretazioni equivalenti.

5. **Documentazione in `docs/`** (inclusa la cartella `docs/ds-for-generate/`)  
   Descrive intenti, convenzioni di team e checklist operative. **Non sostituisce** i livelli 1–3: se una frase qui contraddice il validator o l’index, vincono validator/index aggiornati.

## Conflitti tipici e come risolverli

| Situazione | Cosa fare |
|------------|-----------|
| Prompt di esempio cita un `componentKey` che non è più nell’index | Aggiornare o rimuovere l’esempio nel prompt; l’index riflette il file |
| Nuovo DS release cambia nome token | Aggiornare import/index; poi rigenerare contesto prompt-scoped |
| Doc dice “usa sempre X” ma il validator accetta anche Y | Il validator è la verità esecutiva finché non si cambiano le regole nel codice |
| Due `.md` in `docs/` si contraddicono | Vince il doc più specifico all’area (`GENERATE-*` vs generico); poi allineare l’altro |

## Cosa questo documento **non** è

- Non è il catalogo componenti (sta nell’export Figma / admin DS).
- Non è il prompt Kimi (sta in `auth-deploy/prompts/`).
- Non impone priorità tra prodotti diversi (Audit vs Generate): solo chiarisce **Generate + DS**.

Ultimo aggiornamento: introdotto come parte del piano “DS leggibile per il team”; revisionare quando cambia il contratto action-plan maggiore.
