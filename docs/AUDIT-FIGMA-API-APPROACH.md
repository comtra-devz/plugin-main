# Audit e API Figma: approccio ibrido

## Due percorsi

### 1. Selezione corrente (current)

- **Plugin** serializza solo i nodi selezionati e invia il JSON alla UI (in un messaggio o a chunk se molto grande).
- **Backend** riceve `file_json` e esegue l’audit. **Nessun token Figma necessario** per questa chiamata.
- Funziona sempre (login persistente, file non salvato, ecc.), come prima.

### 2. Tutto il file / Una pagina (all | page)

- **Plugin** invia identificatori: `file_key`, `scope`, per "all" anche `pageIds` (lista ID pagine), per "page" il `page_id`.
- **Backend** (con token OAuth) **non** chiede mai il file intero a Figma: per **Tutto** fa una richiesta per ogni pagina (`GET /v1/files/:key?ids=pageId&depth=4`), poi unisce i risultati. Per **Una pagina** una sola richiesta con `ids=pageId`. Così si evita il 400 su file enormi.
- Richiede login Figma valido.

## File non salvato

Per scope **all** o **page** serve `file_key` (file salvato). Se manca, il plugin mostra: *"Save the file to run the audit."*  
Per **Selezione corrente** il file può essere anche non salvato (il plugin ha già i nodi in memoria).
