export type AiModelPricing = {
  modelId: string;
  provider: 'qwen' | 'kimi';
  inputPer1MUsd: number;
  outputPer1MUsd: number;
  sourceLabel: string;
  sourceUrl: string;
  note?: string;
};

export const OFFICIAL_QWEN_PRICING_URL =
  'https://www.alibabacloud.com/help/en/model-studio/model-pricing';

const QWEN_MODEL_PRICING: Record<string, AiModelPricing> = {
  'qwen3.5-35b-a3b': {
    modelId: 'qwen3.5-35b-a3b',
    provider: 'qwen',
    inputPer1MUsd: 0.05,
    outputPer1MUsd: 0.2,
    sourceLabel: 'Alibaba Model Studio (Qwen-Turbo tier)',
    sourceUrl: OFFICIAL_QWEN_PRICING_URL,
    note: 'Generate text path default in auth-deploy.',
  },
  'qwen3-vl-32b-instruct': {
    modelId: 'qwen3-vl-32b-instruct',
    provider: 'qwen',
    inputPer1MUsd: 0.16,
    outputPer1MUsd: 0.64,
    sourceLabel: 'Alibaba Model Studio (Qwen3-VL-32B Instruct)',
    sourceUrl: OFFICIAL_QWEN_PRICING_URL,
    note: 'Generate vision path when screenshot is present.',
  },
  'qwen-plus': {
    modelId: 'qwen-plus',
    provider: 'qwen',
    inputPer1MUsd: 0.23,
    outputPer1MUsd: 0.23,
    sourceLabel: 'Alibaba Model Studio (Qwen-Plus)',
    sourceUrl: OFFICIAL_QWEN_PRICING_URL,
    note: 'Used as sync reconcile fallback/default in auth-deploy.',
  },
  kimi: {
    modelId: 'kimi',
    provider: 'kimi',
    inputPer1MUsd: 0.4,
    outputPer1MUsd: 2.0,
    sourceLabel: 'Legacy internal baseline',
    sourceUrl: 'https://platform.moonshot.ai/',
    note: 'Still used by DS Audit and other non-Generate flows.',
  },
};

function normalizeModelId(value: string): string {
  return value.trim().toLowerCase();
}

export function getModelPricing(modelId: string): AiModelPricing | null {
  const normalized = normalizeModelId(modelId);
  if (!normalized) return null;
  if (QWEN_MODEL_PRICING[normalized]) return QWEN_MODEL_PRICING[normalized];
  if (normalized.startsWith('qwen-plus')) return QWEN_MODEL_PRICING['qwen-plus'];
  if (normalized.startsWith('qwen3-vl-32b-instruct')) return QWEN_MODEL_PRICING['qwen3-vl-32b-instruct'];
  if (normalized.startsWith('qwen3.5-35b-a3b')) return QWEN_MODEL_PRICING['qwen3.5-35b-a3b'];
  if (normalized.startsWith('kimi') || normalized.startsWith('moonshot')) return QWEN_MODEL_PRICING.kimi;
  return null;
}

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  pricing: AiModelPricing,
): number {
  return (
    (Math.max(0, inputTokens) / 1_000_000) * pricing.inputPer1MUsd +
    (Math.max(0, outputTokens) / 1_000_000) * pricing.outputPer1MUsd
  );
}

export const CORE_MODELS: AiModelPricing[] = [
  QWEN_MODEL_PRICING['qwen3.5-35b-a3b'],
  QWEN_MODEL_PRICING['qwen3-vl-32b-instruct'],
  QWEN_MODEL_PRICING['qwen-plus'],
  QWEN_MODEL_PRICING.kimi,
];
