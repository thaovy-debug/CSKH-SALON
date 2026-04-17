export const GEMINI_PROVIDER = "gemini";
export const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
export const DEFAULT_GEMINI_AUDIO_MODEL = "gemini-2.5-flash";

export const AI_PROVIDER_OPTIONS = [
  {
    value: GEMINI_PROVIDER,
    label: "Gemini (Google)",
    models: [DEFAULT_GEMINI_MODEL, "gemini-2.5-pro", "gemini-3-flash-preview"],
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
