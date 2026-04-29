# Regole “umane” (non codificabili al 100% nel validator)

## Perché esiste questo file

Il validator può imporre schema, presenza nell’index DS e molti guardrail. Restano **preferenze di squadra** — quando scegliere un componente simile rispetto a un altro, tono micro-copy di default, priorità tra due layout entrambi validi — che vanno **scritte** così onboarding e Cursor non ricostruiscono tutto dalla cronologia chat.

## Regole operative (placeholder da affinare)

1. **Preferenza componente vs primitiva**  
   Se il DS espone due componenti sovrapposti (es. button primario vs variante “quiet”), indicare qui la **priorità di default** per contesti noti (solo dopo aver verificato che entrambi sono nell’index).

2. **Eccezioni brand**  
   Qualsiasi eccezione (“su schermata X usiamo sempre il componente Y anche se Z sarebbe valido”) va qui **e** deve essere riflessa nei prompt esempio se influisce sulla qualità percepita.

3. **Cosa non chiedere mai al modello**  
   Es.: non inventare nomi di varianti non presenti nell’index; non assumere librerie esterne al file.

## Manutenzione

- Revisionare questo file quando **QA o utenti** segnalano confusione sistematica dello stesso tipo.
- Se una regola diventa verificabile automaticamente, **spostarla nel validator** e ridurre questo elenco.

Conflict resolution: vedere sempre `docs/ds-authority.md` — il codice vince sul testo se sono in contrasto finché il codice non viene aggiornato.
