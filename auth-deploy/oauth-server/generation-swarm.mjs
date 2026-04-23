/**
 * Generation pipeline — Phase 3 (roadmap): Layout Planner + Component Mapper.
 *
 * Moonshot/Kimi (docs ufficiali: platform.moonshot.ai) espone l’API su **https://api.moonshot.ai/v1**
 * con **`/chat/completions`** (stile OpenAI). Non esiste un secondo URL pubblico tipo “Swarm” da cablare:
 * la “swarm / multi-agent” del prodotto è orchestrazione lato **modello + tool calling** sulla stessa API,
 * oppure pattern applicativi come questo (più round di chat).
 *
 * Questo modulo usa **due chiamate sequenziali** a `chat/completions` — stesso endpoint già usato da `callKimi`
 * in app.mjs. **Default attivo**; disattiva con **`USE_KIMI_SWARM=0`** o **`false`**. **Non serve `KIMI_SWARM_URL`.**
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAYOUT_PLANNER_PATH = path.join(__dirname, '..', 'prompts', 'generate-layout-planner.md');
const COMPONENT_MAPPER_PATH = path.join(__dirname, '..', 'prompts', 'generate-component-mapper.md');

/**
 * @param {object} opts
 * @param {(messages: Array<{role:string,content:string}>, maxTokens?: number, textModelOverride?: string | null) => Promise<{content?: string, usage?: object}>} opts.callKimi
 * @param {(text: string) => object | null} opts.extractJsonFromContent
 * @param {string} opts.userPrompt
 * @param {string} opts.contextBlob
 * @param {string} opts.actionPlanSystemPrompt - generate-system.md (full v1 contract)
 * @param {string | null} [opts.screenshotDataUrl] - optional data URL for Kimi vision (first + second call)
 * @returns {Promise<{ actionPlan: object | null, layout_skeleton: object | null, usage: { input: number, output: number }, stage: string }>}
 */
function withOptionalVision(text, screenshotDataUrl) {
  const t = String(text || '');
  if (!screenshotDataUrl || typeof screenshotDataUrl !== 'string') return t;
  return [
    { type: 'image_url', image_url: { url: screenshotDataUrl } },
    { type: 'text', text: t },
  ];
}

export async function runGenerateDualCallPipeline({
  callKimi,
  extractJsonFromContent,
  userPrompt,
  contextBlob,
  actionPlanSystemPrompt,
  screenshotDataUrl = null,
}) {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  let layoutSystem;
  let mapperSystem;
  try {
    layoutSystem = readFileSync(LAYOUT_PLANNER_PATH, 'utf8');
    if (!String(layoutSystem || '').trim()) throw new Error('empty');
  } catch (e) {
    throw new Error(`generation-swarm: layout planner prompt: ${e?.message || e}`);
  }
  try {
    mapperSystem = readFileSync(COMPONENT_MAPPER_PATH, 'utf8');
    if (!String(mapperSystem || '').trim()) throw new Error('empty');
  } catch (e) {
    throw new Error(`generation-swarm: component mapper prompt: ${e?.message || e}`);
  }

  const layoutUser = [
    `User request:\n${userPrompt}`,
    '',
    'Context (mode, DS, file hints — no Figma node ids in your output):',
    contextBlob,
    '',
    'Return only one JSON object: the layout skeleton as specified in your system instructions.',
  ].join('\n');

  const layoutUserContent = withOptionalVision(layoutUser, screenshotDataUrl);
  const { content: layoutContent, usage: u1 } = await callKimi(
    [{ role: 'system', content: layoutSystem }, { role: 'user', content: layoutUserContent }],
    4096,
  );
  totalInputTokens += Math.max(0, Number(u1?.input_tokens ?? u1?.prompt_tokens ?? 0));
  totalOutputTokens += Math.max(0, Number(u1?.output_tokens ?? u1?.completion_tokens ?? 0));

  const layoutSkeleton = extractJsonFromContent(layoutContent);
  if (!layoutSkeleton || typeof layoutSkeleton !== 'object') {
    return {
      actionPlan: null,
      layout_skeleton: null,
      usage: { input: totalInputTokens, output: totalOutputTokens },
      stage: 'layout_parse_failed',
    };
  }

  const combinedMapperSystem = [
    mapperSystem,
    '',
    '---',
    'Action plan output contract (you must satisfy this in full):',
    actionPlanSystemPrompt,
  ].join('\n');

  const mapperUser = [
    `User request:\n${userPrompt}`,
    '',
    'Context (includes [DS CONTEXT INDEX] when provided — use only listed component ids for instances):',
    contextBlob,
    '',
    'Layout skeleton JSON (realize this structure as the action plan):',
    JSON.stringify(layoutSkeleton),
    '',
    'Return only one JSON object: the full Comtra action plan (version "1.0").',
  ].join('\n');

  const mapperUserContent = withOptionalVision(mapperUser, screenshotDataUrl);
  const { content: mapContent, usage: u2 } = await callKimi(
    [{ role: 'system', content: combinedMapperSystem }, { role: 'user', content: mapperUserContent }],
    8192,
  );
  totalInputTokens += Math.max(0, Number(u2?.input_tokens ?? u2?.prompt_tokens ?? 0));
  totalOutputTokens += Math.max(0, Number(u2?.output_tokens ?? u2?.completion_tokens ?? 0));

  const actionPlan = extractJsonFromContent(mapContent);

  return {
    actionPlan: actionPlan && typeof actionPlan === 'object' ? actionPlan : null,
    layout_skeleton: layoutSkeleton,
    usage: { input: totalInputTokens, output: totalOutputTokens },
    stage: actionPlan && typeof actionPlan === 'object' ? 'ok' : 'mapper_parse_failed',
  };
}
