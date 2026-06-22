import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "LinhKienLed1000 API",
    description:
      "AI-powered customer support agent API. Multi-channel support for WhatsApp, Email, Phone, Facebook Messenger, and Instagram Direct Messaging with autonomous AI actions.",
    version: "2026-04-07",
    contact: {
      name: "Hesper Labs",
      url: "https://github.com/Hesper-Labs/owly",
    },
    license: {
      name: "MIT",
      url: "https://github.com/Hesper-Labs/owly/blob/main/LICENSE",
    },
  },
  servers: [{ url: "/api", description: "Current server" }],
  tags: [
    { name: "Auth", description: "Authentication and setup" },
    { name: "Conversations", description: "Customer conversation management" },
    { name: "Messages", description: "Conversation messages" },
    { name: "Tickets", description: "Support ticket management" },
    { name: "Customers", description: "Customer CRM" },
    { name: "Knowledge", description: "Knowledge base management" },
    { name: "Team", description: "Team members and departments" },
    { name: "Automation", description: "Automation rules engine" },
    { name: "Webhooks", description: "Webhook management and delivery" },
    {
      name: "Meta Shared Webhook",
      description: "Shared Meta webhook callback for Facebook Messenger and Instagram Direct Messaging",
    },
    {
      name: "Facebook Messenger",
      description: "Facebook Page Messenger setup, payload mapping, and channel config",
    },
    {
      name: "Instagram Direct Messaging",
      description:
        "Instagram Direct Messaging API / Instagram API with Instagram Login setup, payload mapping, and channel config",
    },
    { name: "Chat", description: "AI chat inference" },
    { name: "Settings", description: "System configuration" },
    { name: "Admin", description: "User and API key management" },
    { name: "Analytics", description: "Statistics and analytics" },
    { name: "System", description: "Health check and system info" },
  ],
  paths: {
    "/auth": {
      get: {
        tags: ["Auth"],
        summary: "Check auth status",
        responses: { "200": { description: "Auth status with user info or setup requirement" } },
      },
      post: {
        tags: ["Auth"],
        summary: "Login, setup, or logout",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["login", "setup", "logout"] },
                  username: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Success with auth token cookie" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/conversations": {
      get: {
        tags: ["Conversations"],
        summary: "List conversations (paginated)",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
          {
            name: "channel",
            in: "query",
            schema: {
              type: "string",
              enum: ["whatsapp", "email", "phone", "facebook", "instagram", "api"],
            },
          },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["active", "resolved", "closed", "escalated"] },
          },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated conversation list" } },
      },
      post: {
        tags: ["Conversations"],
        summary: "Create a conversation",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["channel"],
                properties: {
                  channel: { type: "string" },
                  customerName: { type: "string" },
                  customerContact: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created conversation" } },
      },
    },
    "/conversations/{id}": {
      get: {
        tags: ["Conversations"],
        summary: "Get conversation detail with messages, customer, tickets, and tags",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Conversation detail" },
          "404": { description: "Not found" },
        },
      },
      put: {
        tags: ["Conversations"],
        summary: "Update conversation",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Updated conversation" } },
      },
      delete: {
        tags: ["Conversations"],
        summary: "Delete conversation",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Deleted" } },
      },
    },
    "/conversations/{id}/messages": {
      get: {
        tags: ["Messages"],
        summary: "List messages in conversation",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Message list" } },
      },
      post: {
        tags: ["Messages"],
        summary: "Add message to conversation",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "201": { description: "Created message" } },
      },
    },
    "/tickets": {
      get: {
        tags: ["Tickets"],
        summary: "List tickets (paginated)",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "priority", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated ticket list" } },
      },
      post: {
        tags: ["Tickets"],
        summary: "Create a ticket",
        responses: { "201": { description: "Created ticket" } },
      },
    },
    "/customers": {
      get: {
        tags: ["Customers"],
        summary: "List customers (paginated)",
        responses: { "200": { description: "Paginated customer list" } },
      },
      post: {
        tags: ["Customers"],
        summary: "Create a customer",
        responses: { "201": { description: "Created customer" } },
      },
    },
    "/customers/{id}": {
      get: {
        tags: ["Customers"],
        summary: "Get customer detail with cross-channel conversations",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Customer with conversations" } },
      },
      put: {
        tags: ["Customers"],
        summary: "Update customer",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Updated" } },
      },
      delete: {
        tags: ["Customers"],
        summary: "Delete customer",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Deleted" } },
      },
    },
    "/customers/{id}/conversations": {
      get: {
        tags: ["Customers"],
        summary: "Unified cross-channel conversation timeline for a customer",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "channel", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated conversation list across all channels" } },
      },
    },
    "/chat": {
      post: {
        tags: ["Chat"],
        summary: "Send a message and get AI response",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: {
                  message: { type: "string", maxLength: 10000 },
                  conversationId: { type: "string" },
                  channel: { type: "string" },
                  customerName: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "AI response with conversation ID" } },
      },
    },
    "/knowledge/entries": {
      get: {
        tags: ["Knowledge"],
        summary: "List knowledge entries (paginated)",
        responses: { "200": { description: "Paginated entries" } },
      },
      post: {
        tags: ["Knowledge"],
        summary: "Create knowledge entry",
        responses: { "201": { description: "Created entry" } },
      },
    },
    "/knowledge/categories": {
      get: {
        tags: ["Knowledge"],
        summary: "List categories (paginated)",
        responses: { "200": { description: "Paginated categories" } },
      },
      post: {
        tags: ["Knowledge"],
        summary: "Create category",
        responses: { "201": { description: "Created" } },
      },
    },
    "/automation": {
      get: {
        tags: ["Automation"],
        summary: "List automation rules (paginated)",
        responses: { "200": { description: "Paginated rules" } },
      },
      post: {
        tags: ["Automation"],
        summary: "Create automation rule",
        responses: { "201": { description: "Created rule" } },
      },
    },
    "/webhooks": {
      get: {
        tags: ["Webhooks"],
        summary: "List webhooks (paginated)",
        responses: { "200": { description: "Paginated webhooks" } },
      },
      post: {
        tags: ["Webhooks"],
        summary: "Create webhook",
        responses: { "201": { description: "Created webhook" } },
      },
    },
    "/webhooks/meta": {
      get: {
        tags: ["Meta Shared Webhook"],
        summary: "Verify shared Meta webhook",
        description:
          "Verifies the shared callback for Facebook Messenger and Instagram Direct Messaging. If hub.mode=subscribe and hub.verify_token matches Channels > Accounts > Facebook/Instagram or META_VERIFY_TOKEN, the route returns hub.challenge as text/plain.",
        security: [],
        parameters: [
          {
            name: "hub.mode",
            in: "query",
            required: true,
            description:
              "Always use subscribe. Meta sends this value when verifying the webhook callback.",
            schema: { type: "string", default: "subscribe", example: "subscribe" },
          },
          {
            name: "hub.verify_token",
            in: "query",
            required: true,
            schema: { type: "string", example: "my-verify-token" },
          },
          {
            name: "hub.challenge",
            in: "query",
            required: true,
            description: "Challenge string returned as text when verification succeeds.",
            schema: { type: "string", default: "hello123", example: "hello123" },
          },
        ],
        responses: {
          "200": { description: "Plain text challenge string" },
          "403": { description: "Invalid verify token" },
          "500": { description: "Verify token is not configured" },
        },
      },
      post: {
        tags: ["Meta Shared Webhook"],
        summary: "Receive shared Meta webhook events",
        description:
          "Receives Meta webhook events, maps object=page to channel=facebook and object=instagram to channel=instagram, stores customer contacts as facebook:<psid> or instagram:<sender_id>, runs the existing chat pipeline, and replies through Meta Send API. Current phase handles text messages only; non-text, delivery/read, reaction, and echo events are ignored.",
        security: [],
        parameters: [
          {
            name: "x-hub-signature-256",
            in: "header",
            required: false,
            schema: { type: "string" },
            description:
              "Required when META_APP_SECRET or a channel appSecret is configured.",
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { oneOf: [{ $ref: "#/components/schemas/MetaFacebookWebhookPayload" }, { $ref: "#/components/schemas/MetaInstagramWebhookPayload" }] },
              examples: {
                facebook: {
                  value: {
                    object: "page",
                    entry: [
                      {
                        messaging: [
                          {
                            sender: { id: "USER_PSID" },
                            recipient: { id: "PAGE_ID" },
                            message: { text: "Hello" },
                          },
                        ],
                      },
                    ],
                  },
                },
                instagram: {
                  value: {
                    object: "instagram",
                    entry: [
                      {
                        messaging: [
                          {
                            sender: { id: "IG_SENDER_ID" },
                            recipient: { id: "IG_BUSINESS_ID" },
                            message: { text: "Hello" },
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Accepted or ignored valid payload" },
          "400": { description: "Invalid JSON payload" },
          "401": { description: "Invalid signature" },
        },
      },
    },
    "/channels": {
      get: {
        tags: ["Facebook Messenger", "Instagram Direct Messaging", "Settings"],
        summary: "List channels with sanitized Meta config",
        description:
          "Lists configured channels, including facebook and instagram. GET responses never return raw access tokens or app secrets; they expose flags such as hasPageAccessToken, hasAccessToken, and hasAppSecret.",
        responses: { "200": { description: "Channel list with sanitized config" } },
      },
      post: {
        tags: ["Facebook Messenger", "Instagram Direct Messaging", "Settings"],
        summary: "Create or update a channel config",
        description:
          "Creates or updates channel config. For Meta channels, DB config takes priority over .env fallback. If token/appSecret fields are blank or masked on save, the existing secret is preserved.",
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChannelConfigRequest" },
              examples: {
                facebook: {
                  value: {
                    type: "facebook",
                    isActive: true,
                    config: {
                      verifyToken: "my-verify-token",
                      pageAccessToken: "YOUR_FACEBOOK_PAGE_ACCESS_TOKEN",
                      pageId: "OPTIONAL_PAGE_ID",
                      graphVersion: "v25.0",
                      appSecret: "YOUR_META_APP_SECRET",
                    },
                  },
                },
                instagram: {
                  value: {
                    type: "instagram",
                    isActive: true,
                    config: {
                      verifyToken: "my-verify-token",
                      accessToken: "YOUR_INSTAGRAM_ACCESS_TOKEN",
                      businessAccountId: "OPTIONAL_INSTAGRAM_BUSINESS_ACCOUNT_ID",
                      graphVersion: "v25.0",
                      appSecret: "YOUR_META_APP_SECRET",
                    },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Saved channel with sanitized config" } },
      },
    },
    "/channels/{type}": {
      get: {
        tags: ["Facebook Messenger", "Instagram Direct Messaging", "Settings"],
        summary: "Get one channel config",
        parameters: [
          {
            name: "type",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: ["facebook", "instagram", "whatsapp", "email", "phone", "zalo"],
              default: "facebook",
              example: "facebook",
            },
          },
        ],
        responses: { "200": { description: "One channel with sanitized config" } },
      },
      put: {
        tags: ["Facebook Messenger", "Instagram Direct Messaging", "Settings"],
        summary: "Update one channel config",
        description:
          "Use type=facebook for Facebook Page Messenger and type=instagram for Instagram Direct Messaging. Page ID and Instagram Business Account ID are optional metadata; sending replies depends on a valid access token.",
        parameters: [
          {
            name: "type",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: ["facebook", "instagram", "whatsapp", "email", "phone", "zalo"],
              default: "instagram",
              example: "instagram",
            },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChannelConfigRequest" },
            },
          },
        },
        responses: { "200": { description: "Updated channel with sanitized config" } },
      },
      post: {
        tags: ["Settings"],
        summary: "Connect, disconnect, or test a channel",
        parameters: [
          {
            name: "type",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["facebook", "instagram", "whatsapp", "email", "phone", "zalo"] },
          },
        ],
        responses: { "200": { description: "Channel action result" } },
      },
    },
    "/webhooks/{id}/deliveries": {
      get: {
        tags: ["Webhooks"],
        summary: "List webhook deliveries with retry status",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["pending", "delivered", "failed"] },
          },
        ],
        responses: { "200": { description: "Paginated delivery list" } },
      },
      post: {
        tags: ["Webhooks"],
        summary: "Retry a failed delivery",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Retry result" } },
      },
    },
    "/settings": {
      get: {
        tags: ["Settings"],
        summary: "Get settings (secrets masked)",
        responses: { "200": { description: "Settings with masked sensitive fields" } },
      },
      put: {
        tags: ["Settings"],
        summary: "Update settings",
        responses: { "200": { description: "Updated settings" } },
      },
    },
    "/stats": {
      get: {
        tags: ["Analytics"],
        summary: "Get summary statistics",
        responses: { "200": { description: "Stats overview" } },
      },
    },
    "/analytics": {
      get: {
        tags: ["Analytics"],
        summary: "Get detailed analytics",
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["7d", "30d", "90d"] } },
        ],
        responses: { "200": { description: "Analytics data" } },
      },
    },
    "/export": {
      get: {
        tags: ["Analytics"],
        summary: "Export data (CSV/JSON)",
        parameters: [
          {
            name: "type",
            in: "query",
            schema: {
              type: "string",
              enum: ["conversations", "tickets", "customers", "knowledge"],
            },
          },
          { name: "format", in: "query", schema: { type: "string", enum: ["json", "csv"] } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 50000 } },
        ],
        responses: { "200": { description: "Exported data" } },
      },
    },
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check with service status",
        security: [],
        responses: {
          "200": { description: "Service health including database, Gemini, memory, uptime" },
        },
      },
    },
    "/openapi.json": {
      get: {
        tags: ["System"],
        summary: "OpenAPI specification",
        security: [],
        parameters: [
          {
            name: "lang",
            in: "query",
            required: false,
            description: "Language for API documentation text. Use vi for Vietnamese or en for English.",
            schema: { type: "string", enum: ["en", "vi"], default: "en" },
          },
        ],
        responses: { "200": { description: "This document" } },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "linhkienled1000-token" },
    },
    schemas: {
      PaginatedResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: {} },
          pagination: {
            type: "object",
            properties: {
              page: { type: "integer" },
              limit: { type: "integer" },
              total: { type: "integer" },
              totalPages: { type: "integer" },
            },
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              requestId: { type: "string" },
              details: {},
            },
          },
        },
      },
      ChannelConfigRequest: {
        type: "object",
        required: ["type"],
        properties: {
          type: {
            type: "string",
            enum: ["facebook", "instagram", "whatsapp", "email", "phone", "zalo"],
          },
          isActive: { type: "boolean" },
          config: {
            oneOf: [
              { $ref: "#/components/schemas/FacebookChannelConfig" },
              { $ref: "#/components/schemas/InstagramChannelConfig" },
            ],
          },
        },
      },
      FacebookChannelConfig: {
        type: "object",
        properties: {
          verifyToken: {
            type: "string",
            description: "Webhook verify token used by Meta webhook verification.",
          },
          pageAccessToken: {
            type: "string",
            description: "Secret token used to send replies through the Facebook Page.",
          },
          pageId: {
            type: "string",
            description:
              "Optional Facebook Page ID for notes/config checks. This is not the app ID and not a customer PSID.",
          },
          graphVersion: { type: "string", example: "v25.0" },
          appSecret: {
            type: "string",
            description:
              "Optional in dev, recommended in production to verify x-hub-signature-256.",
          },
        },
      },
      InstagramChannelConfig: {
        type: "object",
        properties: {
          verifyToken: {
            type: "string",
            description: "Webhook verify token used by Meta webhook verification.",
          },
          accessToken: {
            type: "string",
            description: "Secret token used to send replies through Instagram Direct Messaging.",
          },
          businessAccountId: {
            type: "string",
            description: "Optional Instagram Business/Professional account ID.",
          },
          graphVersion: { type: "string", example: "v25.0" },
          appSecret: {
            type: "string",
            description:
              "Optional in dev, recommended in production to verify x-hub-signature-256.",
          },
        },
      },
      MetaFacebookWebhookPayload: {
        type: "object",
        properties: {
          object: { type: "string", example: "page" },
          entry: { type: "array", items: { type: "object" } },
        },
      },
      MetaInstagramWebhookPayload: {
        type: "object",
        properties: {
          object: { type: "string", example: "instagram" },
          entry: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }],
};

const openApiViText: Record<string, string> = {
  "LinhKienLed1000 API": "API LinhKienLed1000",
  "AI-powered customer support agent API. Multi-channel support for WhatsApp, Email, Phone, Facebook Messenger, and Instagram Direct Messaging with autonomous AI actions.":
    "API trợ lý chăm sóc khách hàng dùng AI. Hỗ trợ đa kênh cho WhatsApp, Email, Điện thoại, Facebook Messenger và Instagram Direct Messaging cùng các hành động AI tự động.",
  "Current server": "Server hiện tại",
  "Authentication and setup": "Xác thực và thiết lập",
  "Customer conversation management": "Quản lý hội thoại khách hàng",
  "Conversation messages": "Tin nhắn trong hội thoại",
  "Support ticket management": "Quản lý ticket hỗ trợ",
  "Customer CRM": "CRM khách hàng",
  "Knowledge base management": "Quản lý Kho kiến thức",
  "Team members and departments": "Thành viên và phòng ban",
  "Automation rules engine": "Bộ máy quy tắc tự động hóa",
  "Webhook management and delivery": "Quản lý và gửi webhook",
  "Shared Meta webhook callback for Facebook Messenger and Instagram Direct Messaging":
    "Callback webhook Meta dùng chung cho Facebook Messenger và Instagram Direct Messaging",
  "Facebook Page Messenger setup, payload mapping, and channel config":
    "Cấu hình Facebook Page Messenger, mapping payload và cấu hình kênh",
  "Instagram Direct Messaging API / Instagram API with Instagram Login setup, payload mapping, and channel config":
    "Cấu hình Instagram Direct Messaging API / Instagram API with Instagram Login, mapping payload và cấu hình kênh",
  "AI chat inference": "Suy luận chat AI",
  "System configuration": "Cấu hình hệ thống",
  "User and API key management": "Quản lý người dùng và API key",
  "Statistics and analytics": "Thống kê và phân tích",
  "Health check and system info": "Kiểm tra sức khỏe hệ thống và thông tin hệ thống",
  "Check auth status": "Kiểm tra trạng thái xác thực",
  "Auth status with user info or setup requirement":
    "Trạng thái xác thực kèm thông tin người dùng hoặc yêu cầu thiết lập",
  "Login, setup, or logout": "Đăng nhập, thiết lập hoặc đăng xuất",
  "Success with auth token cookie": "Thành công kèm cookie auth token",
  "Invalid credentials": "Credential không hợp lệ",
  "List conversations (paginated)": "Liệt kê hội thoại (phân trang)",
  "Paginated conversation list": "Danh sách hội thoại phân trang",
  "Create a conversation": "Tạo hội thoại",
  "Created conversation": "Hội thoại đã tạo",
  "Get conversation detail with messages, customer, tickets, and tags":
    "Lấy chi tiết hội thoại kèm tin nhắn, khách hàng, ticket và tag",
  "Conversation detail": "Chi tiết hội thoại",
  "Not found": "Không tìm thấy",
  "Update conversation": "Cập nhật hội thoại",
  "Updated conversation": "Hội thoại đã cập nhật",
  "Delete conversation": "Xóa hội thoại",
  Deleted: "Đã xóa",
  "List messages in conversation": "Liệt kê tin nhắn trong hội thoại",
  "Message list": "Danh sách tin nhắn",
  "Add message to conversation": "Thêm tin nhắn vào hội thoại",
  "Created message": "Tin nhắn đã tạo",
  "List tickets (paginated)": "Liệt kê ticket (phân trang)",
  "Paginated ticket list": "Danh sách ticket phân trang",
  "Create a ticket": "Tạo ticket",
  "Created ticket": "Ticket đã tạo",
  "List customers (paginated)": "Liệt kê khách hàng (phân trang)",
  "Paginated customer list": "Danh sách khách hàng phân trang",
  "Create a customer": "Tạo khách hàng",
  "Created customer": "Khách hàng đã tạo",
  "Get customer detail with cross-channel conversations":
    "Lấy chi tiết khách hàng kèm hội thoại đa kênh",
  "Customer with conversations": "Khách hàng kèm hội thoại",
  "Update customer": "Cập nhật khách hàng",
  Updated: "Đã cập nhật",
  "Delete customer": "Xóa khách hàng",
  "Unified cross-channel conversation timeline for a customer":
    "Timeline hội thoại đa kênh hợp nhất của một khách hàng",
  "Paginated conversation list across all channels":
    "Danh sách hội thoại phân trang trên tất cả kênh",
  "Send a message and get AI response": "Gửi tin nhắn và nhận phản hồi AI",
  "AI response with conversation ID": "Phản hồi AI kèm ID hội thoại",
  "List knowledge entries (paginated)": "Liệt kê mục kiến thức (phân trang)",
  "Paginated entries": "Danh sách mục phân trang",
  "Create knowledge entry": "Tạo mục kiến thức",
  "Created entry": "Mục đã tạo",
  "List categories (paginated)": "Liệt kê danh mục (phân trang)",
  "Paginated categories": "Danh sách danh mục phân trang",
  "Create category": "Tạo danh mục",
  Created: "Đã tạo",
  "List automation rules (paginated)": "Liệt kê quy tắc tự động hóa (phân trang)",
  "Paginated rules": "Danh sách quy tắc phân trang",
  "Create automation rule": "Tạo quy tắc tự động hóa",
  "Created rule": "Quy tắc đã tạo",
  "List webhooks (paginated)": "Liệt kê webhook (phân trang)",
  "Paginated webhooks": "Danh sách webhook phân trang",
  "Create webhook": "Tạo webhook",
  "Created webhook": "Webhook đã tạo",
  "Verify shared Meta webhook": "Xác minh webhook Meta dùng chung",
  "Verifies the shared callback for Facebook Messenger and Instagram Direct Messaging. If hub.mode=subscribe and hub.verify_token matches Channels > Accounts > Facebook/Instagram or META_VERIFY_TOKEN, the route returns hub.challenge as text/plain.":
    "Xác minh callback dùng chung cho Facebook Messenger và Instagram Direct Messaging. Nếu hub.mode=subscribe và hub.verify_token khớp với Kênh liên hệ > Tài khoản > Facebook/Instagram hoặc META_VERIFY_TOKEN, route trả hub.challenge dạng text/plain.",
  "Always use subscribe. Meta sends this value when verifying the webhook callback.":
    "Luôn dùng subscribe. Meta gửi giá trị này khi xác minh webhook callback.",
  "Challenge string returned as text when verification succeeds.":
    "Chuỗi challenge được trả về dạng text khi xác minh thành công.",
  "Plain text challenge string": "Chuỗi challenge dạng plain text",
  "Invalid verify token": "Verify token không hợp lệ",
  "Verify token is not configured": "Verify token chưa được cấu hình",
  "Receive shared Meta webhook events": "Nhận event webhook Meta dùng chung",
  "Receives Meta webhook events, maps object=page to channel=facebook and object=instagram to channel=instagram, stores customer contacts as facebook:<psid> or instagram:<sender_id>, runs the existing chat pipeline, and replies through Meta Send API. Current phase handles text messages only; non-text, delivery/read, reaction, and echo events are ignored.":
    "Nhận event webhook Meta, map object=page thành channel=facebook và object=instagram thành channel=instagram, lưu contact khách dưới dạng facebook:<psid> hoặc instagram:<sender_id>, chạy pipeline chat hiện có và trả lời qua Meta Send API. Phase hiện tại chỉ xử lý tin nhắn text; non-text, delivery/read, reaction và echo bị bỏ qua.",
  "Required when META_APP_SECRET or a channel appSecret is configured.":
    "Bắt buộc khi META_APP_SECRET hoặc appSecret của kênh được cấu hình.",
  "Accepted or ignored valid payload": "Payload hợp lệ đã được nhận hoặc bỏ qua",
  "Invalid JSON payload": "Payload JSON không hợp lệ",
  "Invalid signature": "Chữ ký không hợp lệ",
  "List channels with sanitized Meta config": "Liệt kê kênh với cấu hình Meta đã sanitize",
  "Lists configured channels, including facebook and instagram. GET responses never return raw access tokens or app secrets; they expose flags such as hasPageAccessToken, hasAccessToken, and hasAppSecret.":
    "Liệt kê các kênh đã cấu hình, gồm facebook và instagram. Phản hồi GET không bao giờ trả raw access token hoặc app secret; chỉ trả các cờ như hasPageAccessToken, hasAccessToken và hasAppSecret.",
  "Channel list with sanitized config": "Danh sách kênh với cấu hình đã sanitize",
  "Create or update a channel config": "Tạo hoặc cập nhật cấu hình kênh",
  "Creates or updates channel config. For Meta channels, DB config takes priority over .env fallback. If token/appSecret fields are blank or masked on save, the existing secret is preserved.":
    "Tạo hoặc cập nhật cấu hình kênh. Với kênh Meta, cấu hình DB ưu tiên hơn fallback .env. Nếu token/appSecret để trống hoặc ở dạng mask khi lưu, secret hiện có sẽ được giữ nguyên.",
  "Saved channel with sanitized config": "Kênh đã lưu với cấu hình đã sanitize",
  "Get one channel config": "Lấy cấu hình một kênh",
  "One channel with sanitized config": "Một kênh với cấu hình đã sanitize",
  "Update one channel config": "Cập nhật cấu hình một kênh",
  "Use type=facebook for Facebook Page Messenger and type=instagram for Instagram Direct Messaging. Page ID and Instagram Business Account ID are optional metadata; sending replies depends on a valid access token.":
    "Dùng type=facebook cho Facebook Page Messenger và type=instagram cho Instagram Direct Messaging. Page ID và Instagram Business Account ID là metadata tùy chọn; việc gửi trả lời phụ thuộc access token hợp lệ.",
  "Updated channel with sanitized config": "Kênh đã cập nhật với cấu hình đã sanitize",
  "Connect, disconnect, or test a channel": "Kết nối, ngắt kết nối hoặc test một kênh",
  "Channel action result": "Kết quả thao tác kênh",
  "List webhook deliveries with retry status": "Liệt kê webhook delivery kèm trạng thái retry",
  "Paginated delivery list": "Danh sách delivery phân trang",
  "Retry a failed delivery": "Retry một delivery thất bại",
  "Retry result": "Kết quả retry",
  "Get settings (secrets masked)": "Lấy settings (secret được mask)",
  "Settings with masked sensitive fields": "Settings với các field nhạy cảm đã được mask",
  "Update settings": "Cập nhật settings",
  "Updated settings": "Settings đã cập nhật",
  "Get summary statistics": "Lấy thống kê tổng quan",
  "Stats overview": "Tổng quan thống kê",
  "Get detailed analytics": "Lấy analytics chi tiết",
  "Analytics data": "Dữ liệu analytics",
  "Export data (CSV/JSON)": "Xuất dữ liệu (CSV/JSON)",
  "Exported data": "Dữ liệu đã xuất",
  "Health check with service status": "Kiểm tra sức khỏe kèm trạng thái dịch vụ",
  "Service health including database, Gemini, memory, uptime":
    "Sức khỏe dịch vụ gồm database, Gemini, memory và uptime",
  "OpenAPI specification": "Đặc tả OpenAPI",
  "This document": "Tài liệu này",
  "Language for API documentation text. Use vi for Vietnamese or en for English.":
    "Ngôn ngữ cho nội dung tài liệu API. Dùng vi cho tiếng Việt hoặc en cho tiếng Anh.",
  "Webhook verify token used by Meta webhook verification.":
    "Webhook verify token dùng cho xác minh webhook Meta.",
  "Secret token used to send replies through the Facebook Page.":
    "Secret token dùng để gửi phản hồi qua Facebook Page.",
  "Optional Facebook Page ID for notes/config checks. This is not the app ID and not a customer PSID.":
    "Facebook Page ID tùy chọn cho ghi chú/kiểm tra cấu hình. Đây không phải app ID và không phải PSID của khách.",
  "Optional in dev, recommended in production to verify x-hub-signature-256.":
    "Tùy chọn trong dev, khuyến nghị trong production để xác minh x-hub-signature-256.",
  "Secret token used to send replies through Instagram Direct Messaging.":
    "Secret token dùng để gửi phản hồi qua Instagram Direct Messaging.",
  "Optional Instagram Business/Professional account ID.":
    "Instagram Business/Professional account ID tùy chọn.",
};

function localizeOpenApiText(value: string, language: "en" | "vi") {
  if (language === "en") return value;
  return openApiViText[value] || value;
}

function localizeOpenApiSpec(value: unknown, language: "en" | "vi"): unknown {
  if (language === "en") return value;
  if (Array.isArray(value)) return value.map((item) => localizeOpenApiSpec(item, language));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if ((key === "summary" || key === "description" || key === "title") && typeof entry === "string") {
        return [key, localizeOpenApiText(entry, language)];
      }

      return [key, localizeOpenApiSpec(entry, language)];
    })
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const language = url.searchParams.get("lang") === "vi" ? "vi" : "en";
  const responseSpec = localizeOpenApiSpec(spec, language);

  return NextResponse.json(responseSpec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "Content-Language": language,
    },
  });
}
