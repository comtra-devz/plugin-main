/**
 * DashScope OpenAI-compatible chat completions (International).
 * @see https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope
 */

function normalizeQwenUsage(usage) {
  if (!usage || typeof usage !== 'object') {
    return { input_tokens: 0, output_tokens: 0, prompt_tokens: 0, completion_tokens: 0 };
  }
  const inTok = Math.max(
    0,
    Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? 0),
  );
  const outTok = Math.max(
    0,
    Number(usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? 0),
  );
  return {
    ...usage,
    input_tokens: inTok,
    output_tokens: outTok,
    prompt_tokens: inTok,
    completion_tokens: outTok,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {object} opts
 * @param {string} opts.baseUrl — e.g. https://dashscope-intl.aliyuncs.com/compatible-mode/v1
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {Array<{role:string,content:unknown}>} opts.messages
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.temperature]
 * @returns {Promise<{ content?: string, usage?: object, status: number, cache_hit?: boolean }>}
 */
export async function callQwenChatCompletion(opts) {
  const startedAtMs = Date.now();
  const baseUrl = String(opts?.baseUrl || '').replace(/\/$/, '');
  const apiKey = String(opts?.apiKey || '').trim();
  const model = String(opts?.model || '').trim();
  if (!baseUrl) throw new Error('Qwen: QWEN_BASE_URL not set');
  if (!apiKey) throw new Error('Qwen: API key missing');
  if (!model) throw new Error('Qwen: model missing');

  const maxTokens = Math.max(256, Math.min(32000, Number(opts?.maxTokens || 8192)));
  const temperature =
    typeof opts?.temperature === 'number' && Number.isFinite(opts.temperature)
      ? Math.min(2, Math.max(0, opts.temperature))
      : 0.2;

  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: opts.messages,
    max_tokens: maxTokens,
    temperature,
  };

  const timeoutMs = Math.max(
    20000,
    typeof opts?.timeoutMs === 'number' && Number.isFinite(opts.timeoutMs)
      ? Math.floor(opts.timeoutMs)
      : Number(process.env.QWEN_API_TIMEOUT_MS || 120000),
  );
  const backoffMs = [1000, 2000, 4000];
  let lastErr = null;

  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(new Error(`Qwen API timeout after ${timeoutMs}ms`)), timeoutMs);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const raw = await r.text();
      if (r.status === 429 && attempt < backoffMs.length) {
        const wait = backoffMs[attempt];
        console.warn('[qwen] 429 rate limit, retry after', wait, 'ms');
        await sleep(wait);
        continue;
      }
      if (r.status >= 500) {
        throw new Error(`Qwen API ${r.status}: ${raw.slice(0, 800)}`);
      }
      if (!r.ok) {
        throw new Error(`Qwen API ${r.status}: ${raw.slice(0, 800)}`);
      }
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error('Qwen: response not JSON');
      }
      const content = data?.choices?.[0]?.message?.content;
      const usage = normalizeQwenUsage(data?.usage);
      const cacheHit =
        data?.usage?.cache_hit ??
        data?.usage?.cached_tokens ??
        data?.usage?.input_tokens_details?.cached_tokens;
      console.info(
        '[qwen]',
        JSON.stringify({
          model,
          ms: Date.now() - startedAtMs,
          in: usage.input_tokens,
          out: usage.output_tokens,
          cache_hit: cacheHit != null ? cacheHit : undefined,
        }),
      );
      return {
        content: typeof content === 'string' ? content : '',
        usage,
        status: r.status,
        cache_hit: cacheHit,
      };
    } catch (e) {
      lastErr = e;
      if (e?.name === 'AbortError' && String(e?.message || '').includes('timeout')) {
        throw e;
      }
      if (attempt < backoffMs.length && /429|rate|throttl/i.test(String(e?.message || ''))) {
        await sleep(backoffMs[attempt]);
        continue;
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr || new Error('Qwen: exhausted retries');
}
