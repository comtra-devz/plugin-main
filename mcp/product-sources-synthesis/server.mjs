#!/usr/bin/env node
/**
 * MCP server (stdio) — completa la Fase 5 LLM in locale (stesso codice del cron).
 * Free tier: `PRODUCT_SOURCES_LLM_PROVIDER=groq` + `GROQ_API_KEY`, oppure Gemini + `GEMINI_API_KEY`.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const llmModuleUrl = pathToFileURL(join(__dirname, '../../admin-dashboard/lib/product-sources-llm.mjs')).href;
const { runProductSourcesSynthesisWithConfig, getProductSourcesLlmConfig } = await import(llmModuleUrl);

/**
 * @param {{ provider: string }} cfg
 */
function missingApiKeyMessage(cfg) {
  const p = cfg.provider;
  if (p === 'gemini') {
    return 'Imposta GEMINI_API_KEY o GOOGLE_AI_API_KEY nel env del server MCP (Cursor → MCP).';
  }
  if (p === 'groq') {
    return 'Imposta GROQ_API_KEY nel env MCP (console.groq.com).';
  }
  if (p === 'openai') {
    return 'Imposta OPENAI_API_KEY o PRODUCT_SOURCES_LLM_API_KEY nel env MCP.';
  }
  if (p === 'custom') {
    return 'Imposta PRODUCT_SOURCES_LLM_API_KEY e PRODUCT_SOURCES_LLM_BASE_URL / MODEL nel env MCP.';
  }
  return 'Imposta KIMI_API_KEY o PRODUCT_SOURCES_LLM_API_KEY nel env MCP (Moonshot).';
}

/**
 * @param {string} bundle
 */
function parseBundleArg(bundle) {
  const t = String(bundle || '').trim();
  if (!t) throw new Error('bundle vuoto');
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t);
      if (typeof j.userBundle === 'string' && j.userBundle.trim()) return j.userBundle.trim();
    } catch {
      /* uso come testo grezzo */
    }
  }
  return t;
}

const bundleInputSchema = z.object({
  bundle: z
    .string()
    .describe('JSON completo dal fence product-sources-llm-bundle oppure solo userBundle / markdown bundle.'),
});

async function handleSynthesizeProductSources({ bundle }) {
  let userBundle;
  try {
    userBundle = parseBundleArg(bundle);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: 'text', text: msg }],
      isError: true,
    };
  }

  const cfg = getProductSourcesLlmConfig();
  if (!cfg.apiKey) {
    return {
      content: [{ type: 'text', text: missingApiKeyMessage(cfg) }],
      isError: true,
    };
  }

  try {
    const md = await runProductSourcesSynthesisWithConfig(cfg, userBundle);
    return { content: [{ type: 'text', text: md }] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: 'text', text: `Errore LLM (${cfg.provider}): ${msg}` }],
      isError: true,
    };
  }
}

const server = new McpServer(
  { name: 'comtra-product-sources', version: '1.0.0' },
  {
    instructions:
      'Sintesi fonti prodotto (Comtra). Env: PRODUCT_SOURCES_LLM_PROVIDER=gemini|groq|moonshot|openai|custom e la key corrispondente. Tool: synthesize_product_sources oppure alias kimi_synthesize_product_sources.',
  },
);

server.registerTool(
  'synthesize_product_sources',
  {
    title: 'Sintesi migliorie (LLM)',
    description:
      'Stesso endpoint del cron: Gemini (generateContent) o OpenAI-compatible. Argomento bundle dal report (fence) o solo userBundle.',
    inputSchema: bundleInputSchema,
  },
  handleSynthesizeProductSources,
);

server.registerTool(
  'kimi_synthesize_product_sources',
  {
    title: 'Sintesi (alias Kimi)',
    description:
      'Alias di synthesize_product_sources per retrocompatibilità; rispetta PRODUCT_SOURCES_LLM_PROVIDER sul processo MCP.',
    inputSchema: bundleInputSchema,
  },
  handleSynthesizeProductSources,
);

server.registerTool(
  'parse_product_sources_bundle_fence',
  {
    title: 'Estrai JSON bundle dal Markdown',
    description:
      'Trova il primo blocco ```product-sources-llm-bundle``` e restituisce il JSON interno (da passare a synthesize_product_sources).',
    inputSchema: z.object({
      markdown: z.string().describe('Report o frammento Markdown'),
    }),
  },
  async ({ markdown }) => {
    const m = String(markdown);
    const re = /```product-sources-llm-bundle\s*([\s\S]*?)```/i;
    const match = m.match(re);
    if (!match) {
      return {
        content: [{ type: 'text', text: 'Nessun fence ```product-sources-llm-bundle``` trovato.' }],
        isError: true,
      };
    }
    const inner = match[1].trim();
    try {
      JSON.parse(inner);
    } catch {
      return {
        content: [{ type: 'text', text: 'Fence trovato ma il contenuto non è JSON valido.' }],
        isError: true,
      };
    }
    return { content: [{ type: 'text', text: inner }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
