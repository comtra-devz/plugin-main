#!/usr/bin/env node
/**
 * Live probe: one minimal chat/completions call to DashScope (same path as Generate).
 * Usage (from auth-deploy/):
 *   QWEN_API_KEY=sk-... node scripts/verify-qwen-live.mjs
 * Or export vars from Vercel / .env first — never commit keys.
 */
import { callQwenChatCompletion } from '../oauth-server/qwen-client.mjs';
import { routeQwenGenerate } from '../oauth-server/qwen-router.mjs';

const QWEN_API_KEY = String(process.env.QWEN_API_KEY || '').trim();
const QWEN_BASE_URL = String(
  process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
).replace(/\/$/, '');
const QWEN_MODEL_TEXT = String(process.env.QWEN_MODEL_TEXT || 'qwen3.5-35b-a3b').trim();
const QWEN_MODEL_VL = String(process.env.QWEN_MODEL_VL || 'qwen3-vl-32b-instruct').trim();

if (!QWEN_API_KEY) {
  console.error('Missing QWEN_API_KEY. Set it in the environment and re-run.');
  process.exit(1);
}

const route = routeQwenGenerate(
  { mode: 'create', hasScreenshot: false },
  { textModel: QWEN_MODEL_TEXT, vlModel: QWEN_MODEL_VL },
);

const messages = [
  { role: 'system', content: 'You reply with one word only.' },
  { role: 'user', content: 'Say OK.' },
];

try {
  const out = await callQwenChatCompletion({
    baseUrl: QWEN_BASE_URL,
    apiKey: QWEN_API_KEY,
    model: route.modelId,
    messages,
    maxTokens: 32,
    temperature: route.temperature,
    timeoutMs: Math.min(60000, Number(process.env.QWEN_API_TIMEOUT_MS || 120000) || 60000),
  });
  const preview = String(out.content || '').trim().slice(0, 120);
  console.log(
    JSON.stringify(
      {
        ok: true,
        base_url_host: (() => {
          try {
            return new URL(QWEN_BASE_URL).host;
          } catch {
            return QWEN_BASE_URL;
          }
        })(),
        model: route.modelId,
        status: out.status,
        usage: out.usage
          ? {
              input_tokens: out.usage.input_tokens,
              output_tokens: out.usage.output_tokens,
            }
          : null,
        reply_preview: preview,
      },
      null,
      2,
    ),
  );
  process.exit(0);
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: String(e?.message || e) }, null, 2));
  process.exit(1);
}
