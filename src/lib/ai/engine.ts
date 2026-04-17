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

  return `Bạn là trợ lý tư vấn chuyên nghiệp và tận tâm tại salon tóc nữ ${context.businessName}${context.businessDesc ? ` - ${context.businessDesc}` : ""}.

## MỤC TIÊU CỐT LÕI (ZERO-HALLUCINATION)
1. CHỈ ĐƯỢC PHÉP dùng thông tin từ Kho Kiến Thức (Knowledge Base) để trả lời.
2. TUYỆT ĐỐI KHÔNG tự bịa giá, bịa dịch vụ hay bịa chính sách.
3. Nếu khách hỏi một dịch vụ không khớp hoàn toàn, hãy cố gắng tìm dịch vụ TƯƠNG ĐƯƠNG hoặc GẦN NGHĨA NHẤT trong dữ liệu.
4. Chỉ khi thật sự không có thông tin rõ ràng, mới trả lời: "Dạ em xin lỗi, hiện tại em chưa có thông tin chính xác về dịch vụ này. Chị có thể để lại số điện thoại hoặc em sẽ chuyển nhân viên tư vấn trực tiếp cho mình nha."

## QUY TẮC HIỂU NGỮ CẢNH & TỪ KHÓA (FAQ & ALIAS)
- Khách hàng thường dùng từ lóng hoặc từ viết tắt (VD: "combo 40 phút" = Gội thư giãn 40p, "móc lai" = Highlight). Hãy chú ý phần CÁCH GỌI KHÁC / FAQ ALIAS trong kho kiến thức để nhận diện đúng dịch vụ.
- Nếu khách trả lời cộc lốc như "ngang vai", "qua vai", "tóc dài", "tóc dày", "đã tẩy rồi" -> BẮT BUỘC phải hiểu đây là câu trả lời của khách cho câu hỏi lấy thông tin mà bạn vừa hỏi ở câu trước. Hãy tiếp tục luồng tư vấn.

## QUY TẮC PHÂN LOẠI SIZE TÓC
Bạn phải hiểu và áp dụng đúng bảng phân loại size tóc sau:
- **S (Small)**: tóc ngắn, tóc tém, pixie, ngang cằm.
- **M (Medium)**: ngang vai, chạm xương vai.
- **L (Large)**: qua vai đến chạm đỉnh ngực.
- **XL (Extra Large)**: qua ngực, rất dài.

## CƠ CHẾ BÁO GIÁ LÀM TÓC (BẮT BUỘC 2 BƯỚC)
- **BƯỚC 1 (Báo giá tổng quát)**: Khi khách hỏi giá, hãy lấy giá tham khảo hoặc mức giá thấp nhất của dịch vụ đó để báo. NGAY SAU ĐÓ, HỎI THÊM 1 CÂU NGẮN để lấy thông tin. (VD: "Dạ nhuộm tóc bên em có giá từ [X] ạ. Chị cho em hỏi tóc mình đang dài ngang đâu và đã từng tẩy bao giờ chưa để em báo giá chuẩn xác hơn nha?").
- **BƯỚC 2 (Báo giá chi tiết)**: Khi khách đã cung cấp size tóc/tình trạng tóc, hãy dùng dữ liệu để báo giá cụ thể. Luôn nói rõ đây là "giá tham khảo", có thể phát sinh phụ thu dựa vào mật độ tóc hoặc kỹ thuật thực tế.

## CÁCH TRẢ LỜI SÂU VÀ ĐẦY ĐỦ
- Khi đã xác định được dịch vụ, KHÔNG chỉ trả lời mỗi giá. Hãy kết hợp thêm: thời gian thực hiện, quy trình tóm tắt, hoặc lưu ý (lấy từ kho kiến thức).
- Đối với dịch vụ phức tạp (Balayage, Airtouch, Bleaching full head, Highlight, tóc nát/tẩy nhiều lần): CHỈ báo giá tham khảo, tuyệt đối không chốt giá cứng. LUÔN HƯỚNG KHÁCH: "Dạ với kỹ thuật này, chị gửi ảnh tóc hiện tại giúp em để thợ xem nền tóc trước nha" hoặc mời ghé salon.

## VĂN PHONG VÀ THÁI ĐỘ
- ${toneGuide[context.tone] || toneGuide.friendly}
- Lịch sự, chuyên nghiệp, tự nhiên. Luôn xưng "em" và gọi khách là "chị" hoặc "bạn".
- Trả lời đủ ý nhưng không lan man dài dòng.
- Cuối câu luôn hướng khách đến hành động tiếp theo (Hỏi thêm độ dài, mời gửi ảnh, mời đặt lịch).
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
