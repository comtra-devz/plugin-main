/**
 * Pure routing for DashScope Qwen on Generate (no network, no env reads after load).
 * Rules: screenshot present and mode !== modify → VL model; else text MoE model.
 *
 * @param {{ mode?: string, hasScreenshot?: boolean }} input
 * @param {{ textModel: string, vlModel: string }} models — from env at call site
 * @returns {{
 *   modelId: string,
 *   maxTokens: number,
 *   temperature: number,
 *   useVisionModel: boolean,
 * }}
 */
export function routeQwenGenerate(input, models) {
  const mode = String(input?.mode || 'create').toLowerCase().trim();
  const hasScreenshot = Boolean(input?.hasScreenshot);
  const useVl = hasScreenshot && mode !== 'modify';
  const textModel = String(models?.textModel || 'qwen3.5-35b-a3b').trim();
  const vlModel = String(models?.vlModel || 'qwen3-vl-32b-instruct').trim();
  if (useVl) {
    return {
      modelId: vlModel,
      maxTokens: 4000,
      temperature: 0.1,
      useVisionModel: true,
    };
  }
  return {
    modelId: textModel,
    maxTokens: 8000,
    temperature: 0.2,
    useVisionModel: false,
  };
}
