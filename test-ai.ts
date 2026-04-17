import { createGeminiClient } from "./src/lib/ai/provider";
import { owlyTools } from "./src/lib/ai/tools";
import { prisma } from "./src/lib/prisma";

async function test_gemini() {
  const settings = await prisma.settings.findFirst();
  if (!settings?.aiApiKey) {
    console.error("No API key");
    return;
  }
  const client = createGeminiClient(settings.aiApiKey);
  
  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"];
  
  for (const model of models) {
    console.log(`\nTesting model: ${model}`);
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.aiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: "hello" }],
          tools: owlyTools
        })
      });
      const data = await response.json();
      console.log(`Tools Response (${response.status}):`, JSON.stringify(data).substring(0, 200));
    } catch(e) {
      console.error("Tools Fetch failed:", e);
    }
    
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.aiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: "hello" }]
        })
      });
      const data = await response.json();
      console.log(`Fallback Response (${response.status}):`, JSON.stringify(data).substring(0, 200));
    } catch(e) {
      console.error("Fallback Fetch failed:", e);
    }
  }
}

test_gemini().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
