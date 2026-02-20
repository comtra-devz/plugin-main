// AI service stub — live calls will be re-enabled once the integration phase begins.
// Keeping @google/genai out of the bundle avoids dynamic import() rejections and
// permission policy violations inside Figma's sandboxed webview.

export const generateDesignSuggestions = async (_prompt: string): Promise<string> => {
  return "AI Service Unavailable (TEST ENV)";
};
