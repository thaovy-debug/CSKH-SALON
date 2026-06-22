import OpenAI from "openai";
import {
  DEFAULT_GEMINI_AUDIO_MODEL,
  DEFAULT_GEMINI_DOCUMENT_MODEL,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  GEMINI_OPENAI_BASE_URL,
  normalizeAIModel,
} from "./catalog";

export function createGeminiClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: GEMINI_OPENAI_BASE_URL,
  });
}

export async function generateGeminiEmbedding(
  text: string,
  apiKey: string
): Promise<number[] | null> {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        `${DEFAULT_GEMINI_EMBEDDING_MODEL}:embedContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: `models/${DEFAULT_GEMINI_EMBEDDING_MODEL}`,
          content: {
            parts: [{ text: text.substring(0, 8000) }],
          },
        }),
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      embedding?: { values?: number[] };
    };

    return data.embedding?.values || null;
  } catch {
    return null;
  }
}

export async function transcribeAudioWithGemini(
  audioBuffer: Buffer,
  apiKey: string,
  mimeType = "audio/wav"
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_AUDIO_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Transcribe this audio exactly and keep the original language.",
              },
              {
                inlineData: {
                  mimeType,
                  data: audioBuffer.toString("base64"),
                },
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini transcription error: ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

export async function generateGeminiDocumentJson(
  prompt: string,
  apiKey: string,
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
  model = DEFAULT_GEMINI_DOCUMENT_MODEL
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, ...parts],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Gemini document import error (${model}, HTTP ${response.status}): ${extractGeminiErrorMessage(errorText)}`
    );
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      finishReason?: string;
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    promptFeedback?: {
      blockReason?: string;
    };
  };

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || "";

  if (!text) {
    const finishReason = data.candidates?.[0]?.finishReason || "unknown";
    const blockReason = data.promptFeedback?.blockReason;
    throw new Error(
      `Gemini không trả về text (${model}). finishReason=${finishReason}${
        blockReason ? `, blockReason=${blockReason}` : ""
      }`
    );
  }

  return text;
}

export function shouldFallbackGeminiModel(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("timeout") ||
    message.includes("overloaded") ||
    message.includes("503") ||
    message.includes("500") ||
    message.includes("unavailable") ||
    message.includes("not found") ||
    message.includes("not supported") ||
    message.includes("model")
  );
}

export function shouldStopGeminiFallback(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("api key") ||
    message.includes("permission") ||
    message.includes("unauthorized") ||
    message.includes("forbidden")
  );
}

function extractGeminiErrorMessage(errorText: string): string {
  if (!errorText) return "Không có nội dung lỗi từ Gemini.";

  try {
    const parsed = JSON.parse(errorText) as {
      error?: {
        message?: string;
        status?: string;
      };
    };
    const message = parsed.error?.message || errorText;
    const status = parsed.error?.status ? ` (${parsed.error.status})` : "";
    return `${message}${status}`.slice(0, 1000);
  } catch {
    return errorText.slice(0, 1000);
  }
}

export async function pingGemini(apiKey: string, model?: string | null): Promise<boolean> {
  const client = createGeminiClient(apiKey);
  const completion = await client.chat.completions.create({
    model: normalizeAIModel(model),
    messages: [{ role: "user", content: "ping" }],
    max_tokens: 1,
    temperature: 0,
  });

  return Boolean(completion.choices[0]);
}
