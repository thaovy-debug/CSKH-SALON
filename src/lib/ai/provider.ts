import OpenAI from "openai";
import {
  DEFAULT_GEMINI_AUDIO_MODEL,
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
