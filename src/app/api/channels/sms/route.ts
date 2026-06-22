import { NextRequest, NextResponse } from "next/server";
import { handleIncomingSms } from "@/lib/channels/sms";
import { validateTwilioSignature, getTwilioAuthToken } from "@/lib/twilio-verify";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    // Validate Twilio signature
    const authToken = await getTwilioAuthToken();
    if (authToken) {
      const signature = request.headers.get("x-twilio-signature") || "";
      if (!validateTwilioSignature(authToken, signature, request.url, params)) {
        logger.warn("[SMS] Invalid Twilio signature");
        return new NextResponse("Forbidden", { status: 403 });
      }
    } else if (process.env.NODE_ENV === "production") {
      logger.warn("[SMS] Missing Twilio auth token in production");
      return new NextResponse("Twilio auth token is not configured", { status: 503 });
    }

    const from = params.From || "";
    const to = params.To || "";
    const messageSid = params.MessageSid || "";
    const body = params.Body || "";

    const response = await handleIncomingSms(from, body, { to, messageSid });

    // Return TwiML response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${response}</Message></Response>`;

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    logger.error("[SMS] Failed to handle incoming SMS:", error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>An error occurred.</Message></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}
