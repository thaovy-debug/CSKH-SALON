import type OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { owlyTools, executeToolCall } from "./tools";
import { emitNewMessage } from "@/lib/realtime";
import { evaluateRules, executeAutomationRules } from "@/lib/automation";
import {
  analyzeSentiment,
  detectIntent,
  estimateConfidence,
  requiresHumanApproval,
} from "./guardrails";
import { logger } from "@/lib/logger";
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_PROVIDER,
  normalizeAIModel,
  normalizeAIProvider,
} from "./catalog";
import { createGeminiClient } from "./provider";
import { searchKnowledgeBase } from "./semantic-search";
import type { AIMessage, AIConfig, ConversationContext, KnowledgeItem } from "./types";

function buildSystemPrompt(context: ConversationContext): string {
  const toneGuide: Record<string, string> = {
    friendly:
      "Giữ giọng điệu nhẹ nhàng, thân thiện, dễ hiểu và lịch sự như một nhân viên tư vấn salon tóc nữ.",
    formal: "Giữ giọng điệu chuyên nghiệp, lịch sự, rõ ràng và chỉn chu.",
    technical:
      "Giải thích rõ ràng, chính xác nhưng vẫn dễ hiểu, tránh thuật ngữ khó khi không cần thiết.",
  };

  const knowledgeSection =
    context.knowledgeBase.length > 0
      ? context.knowledgeBase
          .sort((a, b) => b.priority - a.priority)
          .map((k) => `[${k.category}] ${k.title}:\n${k.content}`)
          .join("\n\n---\n\n")
      : "Chưa có nội dung cụ thể trong kho kiến thức. Chỉ được trả lời dựa trên thông tin doanh nghiệp đang có, không tự bịa thêm.";

  return `Bạn là chatbot tư vấn của salon ${context.businessName}${context.businessDesc ? ` - ${context.businessDesc}` : ""}.

## MỤC TIÊU & NHIỆM VỤ CHÍNH:
- Bạn CÓ TRÁCH NHIỆM phải tìm câu trả lời trong dữ liệu được cung cấp (Kho Kiến Thức/Knowledge Base).
- Nếu có thông tin liên quan (dù chỉ là 1 phần, khoảng giá, hay thời gian ước tính), BẮT BUỘC phải dùng thông tin đó để trả lời khách.
- Tuyệt đối không được vội vàng kết luận "không có thông tin" khi dữ liệu có đề cập đến dịch vụ tương tự. Hãy suy luận theo ngữ nghĩa gần nhất (VD: "uốn" -> tìm thời gian uốn, giá uốn).

## QUY TẮC TRẢ LỜI (BẮT BUỘC):
1. Bắt đầu câu bằng chữ "Dạ...".
2. Trả lời ngắn gọn, tự nhiên, mang tính tư vấn nhiệt tình. CHỈ tập trung trả lời câu hỏi MỚI NHẤT của khách, tuyệt đối KHÔNG tự ý lật lại hoặc trả lời bù các câu hỏi cũ trong lịch sử nếu khách không nhắc tới.
3. Nếu dịch vụ có khoảng giá hoặc khoảng thời gian, PHẢI nêu rõ toàn bộ khoảng đó nếu chưa biết độ dài tóc của khách.
4. NẾU GIÁ/THỜI GIAN PHỤ THUỘC ĐỘ DÀI TÓC (Size S, M, L, XL): 
   - HÃY KIỂM TRA LỊCH SỬ xem khách đã cung cấp độ dài tóc hoặc size tóc chưa. 
   - Nếu ĐÃ BIẾT (ví dụ khách vừa hỏi size L, hoặc bảo tóc qua vai): BẮT BUỘC BÁO MỨC GIÁ CHÍNH XÁC cho size đó, KHÔNG báo khoảng giá chung chung nữa.
   - Nếu CHƯA BIẾT: Hãy báo khoảng giá trước, sau đó hỏi: "Tóc mình đang dài ngang đâu (ngắn/ngang vai/dài/rất dài) để em tư vấn giá chính xác hơn ạ?".
5. Cần tổng hợp thông tin từ nhiều nguồn (FAQ, bảng giá) nếu cần thiết để có câu trả lời đầy đủ.

## XỬ LÝ KHI THỰC SỰ KHÔNG CÓ THÔNG TIN (FALLBACK):
- CHỈ KHI BẠN ĐÃ TÌM KỸ và CHẮC CHẮN 100% không có bất kỳ dữ liệu nào liên quan đến CÂU HỎI MỚI NHẤT, bạn mới được phép trả lời:
  "Dạ hiện tại em chưa có thông tin chính xác, mình cho em xin thêm thông tin để em hỗ trợ kỹ hơn nha."

## VĂN PHONG VÀ THÁI ĐỘ
- ${toneGuide[context.tone] || toneGuide.friendly}
- Lịch sự, chuyên nghiệp, tự nhiên. Luôn xưng "em" và gọi khách là "chị" hoặc "bạn".
- ${context.language !== "auto" ? `Luôn trả lời bằng ngôn ngữ: ${context.language}` : "Trả lời theo đúng ngôn ngữ khách hàng đang dùng."}

## LỊCH SỬ & CONTEXT HỘI THOẠI
- Kênh liên hệ: ${context.channel}
${context.customerName !== "Unknown" ? `- Tên khách hàng: ${context.customerName}` : ""}
- Lịch sử tương tác của khách:
${context.customerHistory.length > 0 ? context.customerHistory.map(h => `  * ${h}`).join("\n") : "  => Đây là lần đầu khách hàng liên hệ."}

---
## KHO KIẾN THỨC / KNOWLEDGE BASE
${knowledgeSection}`;
}

async function getKnowledgeBase(query?: string): Promise<KnowledgeItem[]> {
  if (query) {
    const results = await searchKnowledgeBase(query, 10);
    return results.map(r => ({
      category: r.category,
      title: r.title,
      content: r.content,
      priority: r.score * 100,
    }));
  }

  const entries = await prisma.knowledgeEntry.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { priority: "desc" },
    take: 10,
  });

  return entries.map(
    (e: { category: { name: string }; title: string; content: string; priority: number }) => ({
      category: e.category.name,
      title: e.title,
      content: e.content,
      priority: e.priority,
    })
  );
}

async function getAIConfig(): Promise<AIConfig & ConversationContext> {
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        id: "default",
        aiProvider: GEMINI_PROVIDER,
        aiModel: DEFAULT_GEMINI_MODEL,
      },
    });
  }

  return {
    provider: normalizeAIProvider(settings.aiProvider),
    model: normalizeAIModel(settings.aiModel || DEFAULT_GEMINI_MODEL),
    apiKey: settings.aiApiKey,
    maxTokens: settings.maxTokens,
    temperature: settings.temperature,
    businessName: settings.businessName,
    businessDesc: settings.businessDesc,
    welcomeMessage: settings.welcomeMessage,
    tone: settings.tone,
    language: settings.language,
    knowledgeBase: [],
    customerName: "",
    customerHistory: [],
    channel: "",
  };
}

async function getCustomerProfileContext(customerId?: string | null): Promise<string[]> {
  if (!customerId) return [];

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      hairHistory: true,
      hairCondition: true,
      profileNotes: true,
      bleachHistory: true,
      previousStylist: true,
      preferences: true,
    },
  });

  if (!customer) return [];

  const profile: string[] = [];

  if (customer.hairHistory) {
    profile.push(`- Lịch sử làm tóc: ${customer.hairHistory}`);
  }
  if (customer.hairCondition) {
    profile.push(`- Tình trạng tóc đã lưu: ${customer.hairCondition}`);
  }
  if (customer.bleachHistory !== "unknown") {
    profile.push(`- Tóc đã từng tẩy: ${customer.bleachHistory === "yes" ? "có" : "chưa"}`);
  }
  if (customer.previousStylist) {
    profile.push(`- Stylist cũ: ${customer.previousStylist}`);
  }
  if (customer.preferences) {
    profile.push(`- Sở thích: ${customer.preferences}`);
  }
  if (customer.profileNotes) {
    profile.push(`- Ghi chú hồ sơ: ${customer.profileNotes}`);
  }

  return profile;
}

export async function chat(conversationId: string, userMessage: string): Promise<string> {
  const config = await getAIConfig();

  if (!config.apiKey) {
    return "AI chưa được cấu hình. Vui lòng thêm API key tại Cài đặt > Cấu hình AI.";
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 50 },
    },
  });

  if (!conversation) {
    return "Không tìm thấy hội thoại.";
  }

  const knowledgeBase = await getKnowledgeBase(userMessage);
  const customerProfile = await getCustomerProfileContext(conversation.customerId);

  const context: ConversationContext = {
    ...config,
    knowledgeBase,
    customerName: conversation.customerName,
    channel: conversation.channel,
    customerHistory: customerProfile,
  };

  // Build message history
  const messages: AIMessage[] = [{ role: "system", content: buildSystemPrompt(context) }];

  for (const msg of conversation.messages) {
    if (msg.role === "customer") {
      messages.push({ role: "user", content: msg.content });
    } else if (msg.role === "assistant") {
      messages.push({ role: "assistant", content: msg.content });
    }
  }

  messages.push({ role: "user", content: userMessage });

  // Guardrails: check if human approval needed
  const approval = requiresHumanApproval(userMessage);
  if (approval.required) {
    const sentiment = analyzeSentiment(userMessage);
    const intent = detectIntent(userMessage);

    // Store metadata for dashboard visibility
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: {
          escalationReason: approval.reason,
          sentiment: sentiment.sentiment,
          intent: intent.intent,
        },
      },
    });
  }

  // Save user message
  await prisma.message.create({
    data: {
      conversationId,
      role: "customer",
      content: userMessage,
    },
  });

  const matchedAutomationRules = await evaluateRules(
    {
      content: userMessage,
      channel: conversation.channel,
      customerName: conversation.customerName,
    },
    {
      id: conversationId,
      channel: conversation.channel,
      customerName: conversation.customerName,
    }
  );

  const automationResult = await executeAutomationRules(
    conversationId,
    matchedAutomationRules,
    userMessage
  );

  if (automationResult.autoReplyMessages.length > 0) {
    const automatedReply = automationResult.autoReplyMessages.join("\n\n");
    const savedAutomatedReply = await prisma.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: automatedReply,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    emitNewMessage(conversationId, {
      id: savedAutomatedReply.id,
      role: "assistant",
      content: automatedReply,
    });

    return automatedReply;
  }

  // Call AI
  const response = await callAI(config, messages, conversationId);

  // Save assistant message
  const savedMessage = await prisma.message.create({
    data: {
      conversationId,
      role: "assistant",
      content: response,
    },
  });

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Confidence scoring
  const confidence = estimateConfidence(response, knowledgeBase.length, false);
  if (confidence.shouldEscalate) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: "escalated" },
    });
  }

  emitNewMessage(conversationId, { id: savedMessage.id, role: "assistant", content: response });

  return response;
}

async function callAI(
  config: AIConfig,
  messages: AIMessage[],
  conversationId: string,
  depth = 0
): Promise<string> {
  if (depth > 5) {
    return "Xin lỗi, tôi đang gặp khó khăn khi xử lý yêu cầu này. Tôi sẽ chuyển bạn tới nhân viên hỗ trợ.";
  }

  const client = createGeminiClient(config.apiKey);
  const requestPayload = {
    model: config.model,
    messages: messages as OpenAI.ChatCompletionMessageParam[],
    max_tokens: config.maxTokens,
    temperature: config.temperature,
  };

  const delay = (ms: number) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  const shouldRetry = (error: unknown) => {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    return (
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("quota") ||
      message.includes("timeout") ||
      message.includes("overloaded") ||
      message.includes("503") ||
      message.includes("500")
    );
  };

  let response: OpenAI.Chat.Completions.ChatCompletion | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await client.chat.completions.create({
        ...requestPayload,
        tools: owlyTools as OpenAI.ChatCompletionTool[],
      });
      break;
    } catch (error) {
      lastError = error;
      logger.error("Gemini chat completion with tools failed:", error, {
        conversationId,
        attempt: attempt + 1,
      });

      if (!shouldRetry(error) || attempt === 1) {
        break;
      }

      await delay(1200);
    }
  }

  if (!response) {
    try {
      response = await client.chat.completions.create(requestPayload);
      logger.warn("Gemini fallback without tools succeeded", { conversationId });
    } catch (fallbackError) {
      logger.error("Gemini fallback without tools failed:", fallbackError, {
        conversationId,
        previousError:
          lastError instanceof Error ? lastError.message : String(lastError ?? ""),
      });
      return "Hiện tôi chưa thể xử lý yêu cầu này. Vui lòng thử lại sau ít phút, hoặc tôi có thể chuyển bạn tới nhân viên hỗ trợ.";
    }
  }

  const choice = response.choices[0];

  if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
    // Process tool calls
    const toolCalls = choice.message.tool_calls as Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }>;

    messages.push({
      role: "assistant",
      content: choice.message.content || "",
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    });

    for (const toolCall of toolCalls) {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (error) {
        logger.error("Failed to parse tool arguments:", error, {
          conversationId,
          toolName: toolCall.function.name,
          rawArguments: toolCall.function.arguments,
        });
        continue;
      }

      const result = await executeToolCall(toolCall.function.name, args, conversationId);

      messages.push({
        role: "tool",
        content: result,
        tool_call_id: toolCall.id,
      });
    }

    // Continue the conversation with tool results
    return callAI(config, messages, conversationId, depth + 1);
  }

  return choice.message.content || "Xin lỗi, tôi chưa thể tạo phản hồi lúc này.";
}

export async function createNewConversation(
  channel: string,
  customerName: string,
  customerContact: string,
  customerId?: string
) {
  return prisma.conversation.create({
    data: {
      channel,
      customerName,
      customerContact,
      ...(customerId && { customerId }),
    },
  });
}
