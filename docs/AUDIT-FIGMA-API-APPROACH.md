# Audit e API Figma: approccio consigliato

## Perché non inviamo il file dal plugin al backend

La documentazione Figma è chiara:

- **Plugin API**: [Accessing the Document](https://www.figma.com/plugin-docs/accessing-document/) — Figma **sconsiglia** di attraversare l’intero documento e serializzarlo; per file grandi è lento e pesante. Le pagine sono caricate on-demand.
- **REST API**: [GET file](https://developers.figma.com/docs/rest-api/file-endpoints/) supporta **`ids`** (sottoinsieme di nodi) e **`depth`** (profondità dell’albero). Il backend può chiedere solo ciò che serve, senza far passare tutto dal plugin alla UI al server.

Quindi l’architettura corretta (come molti altri plugin che analizzano file grandi) è:

1. **Plugin** invia solo **identificatori**: `file_key`, `scope` (all | page | current), `page_id`, `node_ids`. Nessun JSON del file.
2. **Backend** (con token OAuth dell’utente) chiama Figma REST API:
   - **Tutto**: `GET /v1/files/:key?depth=2` (solo pagine + primo livello)
   - **Una pagina**: `GET /v1/files/:key?ids=:pageId&depth=4`
   - **Selezione**: `GET /v1/files/:key/nodes?ids=id1,id2&depth=5`
3. Figma risponde con un JSON (possibilmente più piccolo grazie a `ids`/`depth`). Il backend esegue l’audit e restituisce gli issue.

## Cosa evita questo approccio

- Limite **postMessage** (~2 MB) tra plugin e UI
- Limite **body HTTP** (es. Vercel) quando si invia `file_json`
- Chunking, riassemblaggio, doppio percorso (con/senza token)

## Requisito

L’utente deve essere **loggato con Figma** (OAuth) così il backend ha il token per chiamare l’API. È lo stesso requisito di qualsiasi plugin che invia dati a un server per l’analisi.

## File non salvato

Se il file non è ancora salvato, `file_key` non è disponibile. In quel caso il plugin mostra un messaggio chiaro: *"Salva il file per eseguire l’audit"*.
