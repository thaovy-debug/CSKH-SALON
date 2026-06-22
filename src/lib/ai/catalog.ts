export const GEMINI_PROVIDER = "gemini";
export const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_GEMINI_DOCUMENT_MODEL = "gemini-2.5-pro";
export const DEFAULT_GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
export const DEFAULT_GEMINI_AUDIO_MODEL = "gemini-2.5-flash";

export const GEMINI_CHAT_FALLBACK_MODELS = [
  DEFAULT_GEMINI_MODEL,
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
] as const;

export const GEMINI_DOCUMENT_FALLBACK_MODELS = [
  DEFAULT_GEMINI_DOCUMENT_MODEL,
  "gemini-3.5-flash",
  DEFAULT_GEMINI_MODEL,
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
] as const;

export const AI_PROVIDER_OPTIONS = [
  {
    value: GEMINI_PROVIDER,
    label: "Gemini (Google)",
    models: [
      DEFAULT_GEMINI_MODEL,
      "gemini-2.5-pro",
      "gemini-3.5-flash",
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash-lite",
    ],
  },
] as const;

export function normalizeAIProvider(provider?: string | null): string {
  return provider === GEMINI_PROVIDER ? GEMINI_PROVIDER : GEMINI_PROVIDER;
}

export function normalizeAIModel(model?: string | null): string {
  const value = model?.trim();
  if (!value) return DEFAULT_GEMINI_MODEL;

  const legacyPrefixes = ["gpt-", "claude", "llama", "mistral", "codellama", "phi"];
  if (legacyPrefixes.some((prefix) => value.startsWith(prefix))) {
    return DEFAULT_GEMINI_MODEL;
  }

  return value;
}

export function getGeminiChatModelFallbackChain(model?: string | null): string[] {
  return uniqueModels([normalizeAIModel(model), ...GEMINI_CHAT_FALLBACK_MODELS]);
}

export function getGeminiDocumentModelFallbackChain(model?: string | null): string[] {
  return uniqueModels([
    model?.trim() || DEFAULT_GEMINI_DOCUMENT_MODEL,
    ...GEMINI_DOCUMENT_FALLBACK_MODELS,
  ]);
}

function uniqueModels(models: string[]): string[] {
  return models.map((model) => model.trim()).filter((model, index, all) => {
    return Boolean(model) && all.indexOf(model) === index;
  });
}
