import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/channels/normalized", () => ({
  processNormalizedInboundMessage: vi.fn().mockResolvedValue({
    conversationId: "conv-sms-1",
    response: "SMS AI response",
    customerId: "cust-sms-1",
  }),
}));

vi.mock("@/lib/twilio-verify", () => ({
  getTwilioAuthToken: vi.fn().mockResolvedValue(""),
  validateTwilioSignature: vi.fn().mockReturnValue(true),
}));

function createSmsRequest(params: Record<string, string>) {
  return new NextRequest("http://localhost:3000/api/channels/sms", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
}

describe("SMS channel route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps inbound Twilio SMS to the normalized channel processor", async () => {
    const { POST } = await import("@/app/api/channels/sms/route");
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");

    const response = await POST(
      createSmsRequest({
        From: "+84909003082",
        To: "+84972902525",
        Body: "Tư vấn nguồn LED 12V",
        MessageSid: "SM123",
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/xml");
    expect(await response.text()).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>SMS AI response</Message></Response>'
    );
    expect(processNormalizedInboundMessage).toHaveBeenCalledWith({
      channel: "sms",
      externalCustomerId: "+84909003082",
      customerContact: "+84909003082",
      externalConversationId: "SM123",
      platformMessageId: "SM123",
      customerName: "+84909003082",
      text: "Tư vấn nguồn LED 12V",
      metadata: {
        provider: "twilio",
        to: "+84972902525",
      },
    });
  });

  it("handles empty SMS body without calling the normalized processor", async () => {
    const { POST } = await import("@/app/api/channels/sms/route");
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");

    const response = await POST(
      createSmsRequest({
        From: "+84909003082",
        To: "+84972902525",
        Body: " ",
        MessageSid: "SM124",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Message>Please send a message and we'll be happy to help!</Message></Response>"
    );
    expect(processNormalizedInboundMessage).not.toHaveBeenCalled();
  });
});
