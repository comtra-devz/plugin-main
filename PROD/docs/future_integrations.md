
# Future Integrations Guide

This document outlines the technical strategy for integrating advanced AI capabilities into the Comtra Design System plugin.

## 1. Multi-Model Support (Claude & Gemini)

To support Anthropic's Claude alongside Google's Gemini, we need to refactor `geminiService.ts` into a Provider Pattern.

### Interface Definition
Create an interface to standardize inputs/outputs across models.

```typescript
// types/ai.ts
export interface AIProvider {
  generateText(prompt: string, context?: string): Promise<string>;
  generateImage?(prompt: string): Promise<string>; // Base64
}
```

### Implementation Strategy
1. **Gemini Adapter**: Keep existing logic using `@google/genai`.
2. **Claude Adapter**: Use `@anthropic-ai/sdk`.
   - **Model**: Use `claude-3-5-sonnet-latest` for Design System tasks (best balance of reasoning/speed).
   - **Config**: Ensure `max_tokens` is set high enough for React code generation.

### Switching Logic
In `views/Generate.tsx` or `views/Code.tsx`, add a toggle in the UI or Settings to select the active provider.

```typescript
const getProvider = (type: 'GEMINI' | 'CLAUDE'): AIProvider => {
  return type === 'CLAUDE' ? new ClaudeService() : new GeminiService();
}
```

---

## 2. Gemini Image Generation (Mockups)

Use Gemini to generate realistic placeholder images (avatars, product shots) inside Figma frames instead of gray rectangles.

### Model Configuration
*   **Model**: `gemini-2.5-flash-image` (Fast, efficient for placeholders).
*   **High Res**: Use `gemini-3-pro-image-preview` only if the user requests "High Fidelity" (requires user API key).

### Implementation Snippet
When a user selects a Rectangle layer named `Image_Hero`:

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateMockupImage = async (prompt: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }], // e.g., "Cyberpunk city street, neon lights"
    },
    config: {
      imageConfig: { aspectRatio: "16:9" }
    }
  });
  
  // Handle response parts to find inlineData (Base64)
  // Decode Base64 -> Uint8Array -> figma.createImage(data)
};
```

---

## 3. Context-Aware Design System Generation (RAG)

To enable the AI to generate mockups using *your specific* Design System (Tokens and Components) rather than generic shapes, we use a **Context Injection / RAG** strategy.

### The Problem
Generic AI models generate generic HTML/Tailwind. We want them to instantiate Figma Components (e.g., `<Button variant="primary" />`) that exist in the user's library.

### The Solution: Design System Injection
We must "teach" the AI the available building blocks before asking for a design.

#### 1. Extraction (Figma -> JSON)
The plugin controller scans the local file for:
*   **Local Variables (Tokens):** Colors, Typography, Spacing.
*   **Main Components:** Their names and properties (Variants).

```typescript
// Example extracted context passed to AI
const designContext = {
  tokens: {
    colors: ['primary', 'secondary', 'surface'],
    spacing: ['4px', '8px', '16px']
  },
  components: [
    { name: "Button", props: ["variant: primary|secondary", "size: sm|lg"] },
    { name: "Card", props: ["type: outlined|elevated"] }
  ]
};
```

#### 2. Prompt Engineering (Context Injection)
Pass this context in the `systemInstruction` of `gemini-3-pro-preview`.

**System Instruction:**
> "You are a specialized UI generator. You MUST use the provided list of components and tokens. Do not invent new CSS. Return a JSON structure representing the layout tree using these specific component IDs."

#### 3. Structured Generation (JSON Output)
Use `responseSchema` to force the AI to return a tree structure that Figma can parse.

```typescript
// Schema for Figma Layout
const layoutSchema = {
  type: Type.OBJECT,
  properties: {
    layoutMode: { type: Type.STRING, enum: ["VERTICAL", "HORIZONTAL"] },
    children: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          componentName: { type: Type.STRING }, // Must match extracted component
          props: { type: Type.OBJECT }, // Must match extracted variants
          textContent: { type: Type.STRING }
        }
      }
    }
  }
};
```

#### 4. Rehydration (JSON -> Figma)
The plugin receives the JSON, finds the matching `ComponentSet` in Figma, creates an `instance`, sets the `variant` properties as defined by the AI, and wraps them in AutoLayout frames.
