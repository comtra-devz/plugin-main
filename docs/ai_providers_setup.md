# AI Providers Setup

## 1. Abstraction Layer
Create `services/ai.ts` in Backend:
```ts
export const generate = async (provider: 'openai'|'claude', prompt: string) => {
  return provider === 'claude' ? callClaude(prompt) : callOpenAI(prompt);
}
```

## 2. Claude (Anthropic)
1. Install: `npm install @anthropic-ai/sdk`
2. Env: `ANTHROPIC_API_KEY`
3. Model: Use `claude-3-opus` for complex logic, `sonnet` for speed.

## 3. OpenAI
1. Install: `npm install openai`
2. Env: `OPENAI_API_KEY`
3. Model: `gpt-4-turbo` for code gen.