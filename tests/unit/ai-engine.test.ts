import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

// Mock Gemini compatibility client
const mockOpenAICreateFn = vi.fn();
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockOpenAICreateFn,
        },
      };
    },
  };
});

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

describe("AI Engine", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    mockOpenAICreateFn.mockReset();

    // Default settings
    mockPrisma.settings.findFirst.mockResolvedValue({
      id: "default",
      businessName: "Test Biz",
      businessDesc: "A test business",
      welcomeMessage: "Hello!",
      tone: "friendly",
      language: "auto",
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
      aiApiKey: "sk-test",
      maxTokens: 1000,
      temperature: 0.7,
    });

    mockPrisma.settings.create.mockResolvedValue({
      id: "default",
      aiApiKey: "",
    });

    // Default knowledge base
    mockPrisma.knowledgeEntry.findMany.mockResolvedValue([]);
    mockPrisma.automationRule.findMany.mockResolvedValue([]);

    // Default conversation
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: "conv-1",
      channel: "whatsapp",
      customerName: "John",
      customerContact: "+1555",
      status: "active",
      messages: [{ role: "customer", content: "Hi", createdAt: new Date() }],
    });

    // Default message creation
    mockPrisma.message.create.mockResolvedValue({ id: "msg-new" });
    mockPrisma.conversation.update.mockResolvedValue({});
  });

  it("should return fallback when AI API key is not configured", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({
      id: "default",
      aiApiKey: "",
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
      maxTokens: 1000,
      temperature: 0.7,
      businessName: "Test",
      businessDesc: "",
      welcomeMessage: "",
      tone: "friendly",
      language: "auto",
    });

    const { chat } = await import("@/lib/ai/engine");
    const response = await chat("conv-1", "Hello");

    expect(response).toContain("AI chưa được cấu hình");
  });

  it("should return error when conversation not found", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(null);

    const { chat } = await import("@/lib/ai/engine");
    const response = await chat("nonexistent", "Hello");

    expect(response).toBe("Không tìm thấy hội thoại.");
  });

  it("should call Gemini with correct parameters", async () => {
    mockOpenAICreateFn.mockResolvedValue({
      choices: [
        {
          finish_reason: "stop",
          message: { content: "Hello! How can I help?" },
        },
      ],
    });

    const { chat } = await import("@/lib/ai/engine");
    const response = await chat("conv-1", "I need help");

    expect(response).toBe("Hello! How can I help?");
    expect(mockOpenAICreateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.5-flash",
        max_tokens: 1000,
        temperature: 0.7,
      })
    );
  });

  it("should try fallback Gemini chat models when configured model is rate limited", async () => {
    mockOpenAICreateFn
      .mockRejectedValueOnce(new Error("429 status code (no body)"))
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "Dạ LED1000 có thể hỗ trợ bạn." },
          },
        ],
      });

    const { chat } = await import("@/lib/ai/engine");
    const response = await chat("conv-1", "hello");

    expect(response).toBe("Dạ LED1000 có thể hỗ trợ bạn.");
    expect(mockOpenAICreateFn).toHaveBeenCalledTimes(2);
    expect(mockOpenAICreateFn.mock.calls[0][0]).toEqual(
      expect.objectContaining({ model: "gemini-2.5-flash" })
    );
    expect(mockOpenAICreateFn.mock.calls[1][0]).toEqual(
      expect.objectContaining({ model: "gemini-3.5-flash" })
    );
  });

  it("should save user and assistant messages", async () => {
    mockOpenAICreateFn.mockResolvedValue({
      choices: [
        {
          finish_reason: "stop",
          message: { content: "I can help with that." },
        },
      ],
    });

    const { chat } = await import("@/lib/ai/engine");
    await chat("conv-1", "Help me");

    // User message saved
    expect(mockPrisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: "conv-1",
          role: "customer",
          content: "Help me",
        }),
      })
    );

    // Assistant message saved
    expect(mockPrisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: "conv-1",
          role: "assistant",
          content: "I can help with that.",
        }),
      })
    );
  });

  it("should include knowledge base in system prompt", async () => {
    mockPrisma.knowledgeEntry.findMany.mockResolvedValue([
      {
        category: { name: "FAQ" },
        title: "Return Policy",
        content: "30-day returns allowed",
        priority: 10,
      },
    ]);

    mockOpenAICreateFn.mockResolvedValue({
      choices: [
        {
          finish_reason: "stop",
          message: { content: "Our return policy..." },
        },
      ],
    });

    const { chat } = await import("@/lib/ai/engine");
    await chat("conv-1", "What is your return policy?");

    const callArgs = mockOpenAICreateFn.mock.calls[0][0];
    const systemMessage = callArgs.messages[0];
    expect(systemMessage.content).toContain("Return Policy");
    expect(systemMessage.content).toContain("30-day returns allowed");
  });

  it("should build a LinhKienLed1000-aware system prompt", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({
      id: "default",
      businessName: "LED1000 / Linh Kiện LED1000",
      businessDesc: "Chuyên đèn LED, nguồn điện, linh kiện LED và phụ kiện chiếu sáng.",
      welcomeMessage: "Xin chào! LED1000 hỗ trợ chọn sản phẩm phù hợp.",
      tone: "technical",
      language: "vi",
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
      aiApiKey: "sk-test",
      maxTokens: 1000,
      temperature: 0.7,
    });

    mockOpenAICreateFn.mockResolvedValue({
      choices: [
        {
          finish_reason: "stop",
          message: { content: "Dạ LED1000 có thể hỗ trợ." },
        },
      ],
    });

    const { chat } = await import("@/lib/ai/engine");
    await chat("conv-1", "Tôi cần adapter 12V");

    const callArgs = mockOpenAICreateFn.mock.calls[0][0];
    const systemMessage = callArgs.messages[0];
    expect(systemMessage.content).toContain("trợ lý CSKH/tư vấn sản phẩm của LED1000");
    expect(systemMessage.content).toContain("điện áp 5V/12V/24V/48V/220V");
    expect(systemMessage.content).toContain("Không tự bịa giá, tồn kho, bảo hành, khuyến mãi");
    expect(systemMessage.content).toContain("nguồn điện");
    expect(systemMessage.content).toContain("LED dây");
  });

  it("should inject LinhKienLed1000 customer profile fields into prompt", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: "conv-1",
      channel: "whatsapp",
      customerName: "Lan",
      customerContact: "+1555",
      customerId: "customer-1",
      status: "active",
      messages: [],
    });
    mockPrisma.customer.findUnique.mockResolvedValue({
      phone: "0909003082",
      email: "lan@example.com",
      whatsapp: "",
      tags: "VIP",
      profileNotes: "Thường mua LED dây ngoài trời",
      preferences: "Ưu tiên ánh sáng vàng",
      purchaseContext: "Lắp bảng hiệu ngoài trời",
      technicalNeeds: "LED dây 12V chống nước",
      quoteStatus: "yes",
      previousAdvisor: "Kỹ thuật LED1000",
    });
    mockOpenAICreateFn.mockResolvedValue({
      choices: [
        {
          finish_reason: "stop",
          message: { content: "Dạ em đã ghi nhận." },
        },
      ],
    });

    const { chat } = await import("@/lib/ai/engine");
    await chat("conv-1", "Bạn còn nhớ nhu cầu của tôi không?");

    const callArgs = mockOpenAICreateFn.mock.calls[0][0];
    const systemMessage = callArgs.messages[0];
    expect(systemMessage.content).toContain("Thường mua LED dây ngoài trời");
    expect(systemMessage.content).toContain("Ưu tiên ánh sáng vàng");
    expect(systemMessage.content).toContain("Lắp bảng hiệu ngoài trời");
    expect(systemMessage.content).toContain("LED dây 12V chống nước");
    expect(systemMessage.content).toContain("Kỹ thuật LED1000");
  });

  it("should handle tool calls and recurse", async () => {
    // First call returns tool_calls
    mockOpenAICreateFn
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: "",
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: {
                    name: "get_customer_history",
                    arguments: JSON.stringify({ customerContact: "+1555" }),
                  },
                },
              ],
            },
          },
        ],
      })
      // Second call returns final response
      .mockResolvedValueOnce({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: "Based on your history, I can see...",
            },
          },
        ],
      });

    // Mock the customer history tool
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    const { chat } = await import("@/lib/ai/engine");
    const response = await chat("conv-1", "Do you know me?");

    expect(response).toBe("Based on your history, I can see...");
    expect(mockOpenAICreateFn).toHaveBeenCalledTimes(2);
  });

  it("should return fallback message when content is empty", async () => {
    mockOpenAICreateFn.mockResolvedValue({
      choices: [
        {
          finish_reason: "stop",
          message: { content: "" },
        },
      ],
    });

    const { chat } = await import("@/lib/ai/engine");
    const response = await chat("conv-1", "Hello");

    expect(response).toContain("chưa thể tạo phản hồi");
  });
});
