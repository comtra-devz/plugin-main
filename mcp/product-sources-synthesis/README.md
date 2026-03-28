# MCP — sintesi fonti prodotto (Kimi / Moonshot)

Consente di **non chiamare l’LLM da Vercel/cron** (zero token Moonshot sul deploy) e di eseguire la Fase 5 **solo quando apri Cursor**, usando la stessa logica di `admin-dashboard/lib/product-sources-llm.mjs`.

## 1. Variabili sul deploy (cron / API)

```bash
PRODUCT_SOURCES_LLM_SYNTHESIS=1
PRODUCT_SOURCES_LLM_EXECUTION=mcp
# Non serve KIMI_API_KEY su Vercel se usi solo MCP.
```

Il report Markdown conterrà un blocco ` ```product-sources-llm-bundle` ` con JSON (`userBundle` + metadati).

## 2. Installazione dipendenze (una volta)

Dalla root del monorepo:

```bash
cd mcp/product-sources-synthesis && npm install
```

## 3. Cursor — registrazione MCP

In **Cursor Settings → MCP** aggiungi un server (adatta il path assoluto al tuo clone).

**Esempio Gemini (Google AI Studio):** default model nel codice `gemini-2.5-flash` (evitare 2.0 Flash, deprecato).

```json
{
  "mcpServers": {
    "comtra-product-sources": {
      "command": "node",
      "args": ["/PERCORSO/A/plugin-main-1/mcp/product-sources-synthesis/server.mjs"],
      "env": {
        "PRODUCT_SOURCES_LLM_PROVIDER": "gemini",
        "GEMINI_API_KEY": "..."
      }
    }
  }
}
```

**Esempio Groq** (spesso più stabile del free tier Gemini): `PRODUCT_SOURCES_LLM_PROVIDER=groq` + `GROQ_API_KEY`.

**Esempio Kimi (Moonshot):** `PRODUCT_SOURCES_LLM_PROVIDER=moonshot` (o omesso) + `KIMI_API_KEY`.

Opzionali: `PRODUCT_SOURCES_LLM_MODEL`, `PRODUCT_SOURCES_LLM_BASE_URL` (solo custom / override).

## 4. Tool esposti

| Tool | Uso |
|------|-----|
| `synthesize_product_sources` | `bundle` = JSON dal fence o solo `userBundle`. Usa il provider negli env MCP (Gemini, Kimi, …). |
| `kimi_synthesize_product_sources` | Alias retrocompatibile del precedente. |
| `parse_product_sources_bundle_fence` | Incolli un pezzo di report; restituisce il JSON puro da passare al tool sopra. |

## 5. Nota sui “token” / quota

- Con **Gemini free tier** le policy e i limiti sono quelli di Google (RPM/TPD); in caso di blocco, il **cron** sul deploy inserisce un messaggio nel report e **riprova da solo** alla run successiva.
- **MCP** in locale: quando invochi il tool, consumi quota della key configurata (Gemini o Moonshot).
- Il vantaggio del flusso **MCP + `LLM_EXECUTION=mcp`** è **non** chiamare l’API a ogni cron su Vercel.
