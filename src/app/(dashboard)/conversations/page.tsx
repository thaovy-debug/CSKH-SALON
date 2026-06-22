"use client";

import { Header } from "@/components/layout/header";
import {
  MessageCircle,
  Mail,
  Phone,
  MessageSquare,
  Search,
  Send,
  Inbox,
  ArrowLeft,
  Tag,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  cn,
  formatRelativeTime,
  getChannelLabel,
  getStatusColor,
} from "@/lib/utils";

interface MessageData {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  createdAt: string;
}

interface TagData {
  id: string;
  tag: {
    id: string;
    name: string;
    color: string;
  };
}

interface CustomerData {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
}

interface ChannelAccountData {
  id: string;
  type: string;
  displayName: string;
  externalAccountId: string;
  status: string;
  isActive: boolean;
}

interface ConversationData {
  id: string;
  channel: string;
  customerName: string;
  customerContact: string;
  status: string;
  summary: string;
  messages: MessageData[];
  _count: { messages: number };
  tags: TagData[];
  customer?: CustomerData | null;
  channelAccount?: ChannelAccountData | null;
  createdAt: string;
  updatedAt: string;
}

const channelIcons: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  facebook: MessageCircle,
  instagram: MessageCircle,
  zalo: MessageCircle,
  shopee: MessageCircle,
  tiktok_shop: MessageCircle,
  email: Mail,
  phone: Phone,
  sms: MessageSquare,
  telegram: MessageCircle,
  api: MessageSquare,
};

const channelColors: Record<string, string> = {
  whatsapp: "text-green-600 bg-green-50",
  facebook: "text-blue-700 bg-blue-50",
  instagram: "text-pink-700 bg-pink-50",
  zalo: "text-sky-700 bg-sky-50",
  shopee: "text-orange-700 bg-orange-50",
  tiktok_shop: "text-slate-800 bg-slate-100",
  email: "text-blue-600 bg-blue-50",
  phone: "text-purple-600 bg-purple-50",
  sms: "text-indigo-700 bg-indigo-50",
  telegram: "text-cyan-700 bg-cyan-50",
  api: "text-slate-700 bg-slate-100",
};

const channels = [
  { value: "all", label: "Tất cả kênh" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "zalo", label: "Zalo" },
  { value: "shopee", label: "Shopee" },
  { value: "tiktok_shop", label: "TikTok Shop" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Điện thoại" },
  { value: "sms", label: "SMS" },
  { value: "telegram", label: "Telegram" },
  { value: "api", label: "API" },
];

const statuses = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "active", label: "Đang xử lý" },
  { value: "resolved", label: "Đã xử lý" },
  { value: "escalated", label: "Cần ưu tiên" },
  { value: "closed", label: "Đã đóng" },
];

function getStatusLabel(status: string) {
  return (
    statuses.find((item) => item.value === status)?.label ||
    status
  );
}

const genericCustomerNames = new Set([
  "unknown",
  "facebook user",
  "instagram user",
  "zalo user",
  "khách zalo",
]);

function isGenericCustomerName(name?: string | null) {
  const normalized = name?.trim().toLowerCase();
  return !normalized || genericCustomerNames.has(normalized);
}

function parseScopedContact(channel: string, contact?: string | null) {
  const value = contact?.trim() || "";
  const parts = value.split(":").filter(Boolean);

  if (
    ["facebook", "instagram", "zalo", "shopee", "tiktok_shop"].includes(channel) &&
    parts.length >= 3
  ) {
    return {
      accountExternalId: parts[1],
      customerExternalId: parts.slice(2).join(":"),
      isScoped: true,
    };
  }

  if (
    ["facebook", "instagram", "zalo", "shopee", "tiktok_shop", "telegram"].includes(
      channel
    ) &&
    parts.length === 2
  ) {
    return {
      accountExternalId: "",
      customerExternalId: parts[1],
      isScoped: true,
    };
  }

  return {
    accountExternalId: "",
    customerExternalId: value,
    isScoped: false,
  };
}

function getConversationIdentity(conversation: ConversationData) {
  const scoped = parseScopedContact(conversation.channel, conversation.customerContact);
  const accountExternalId = conversation.channelAccount?.externalAccountId || scoped.accountExternalId;
  const accountName =
    conversation.channelAccount?.displayName ||
    (accountExternalId ? `TK ${accountExternalId}` : "");
  const rawName = conversation.customer?.name || conversation.customerName;
  const displayName = isGenericCustomerName(rawName) ? "Khách chưa định danh" : rawName;
  const directContact =
    conversation.customer?.phone ||
    conversation.customer?.whatsapp ||
    conversation.customer?.email ||
    (!scoped.isScoped ? conversation.customerContact : "");
  const customerCode = scoped.customerExternalId || directContact;

  return {
    displayName,
    platformLabel: getChannelLabel(conversation.channel),
    accountName,
    accountExternalId,
    customerCode,
    customerCodeLabel: ["facebook", "instagram", "zalo", "shopee", "tiktok_shop", "telegram"].includes(conversation.channel)
      ? "Mã khách"
      : "Liên hệ",
  };
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (channelFilter !== "all") params.set("channel", channelFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/conversations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const convList = Array.isArray(data) ? data : (data.conversations ?? data.data ?? []);
        setConversations(convList);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [channelFilter, statusFilter, searchQuery]);

  const fetchConversationDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedConversation(data);
      }
    } catch (error) {
      console.error("Failed to fetch conversation detail:", error);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedId) {
      fetchConversationDetail(selectedId);
    }
  }, [selectedId, fetchConversationDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation?.messages]);

  const handleSelectConversation = (id: string) => {
    setSendError("");
    setSelectedId(id);
    setMobileShowDetail(true);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedId || sending) return;
    setSendError("");
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim(), role: "admin" }),
      });
      if (res.ok) {
        setReplyText("");
        fetchConversationDetail(selectedId);
        fetchConversations();
      } else {
        const data = await res.json().catch(() => null);
        setSendError(data?.error || "Không thể gửi tin nhắn đến khách hàng.");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setSendError("Không thể gửi tin nhắn đến khách hàng.");
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/conversations/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchConversationDetail(selectedId);
        fetchConversations();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const selectedIdentity = selectedConversation
    ? getConversationIdentity(selectedConversation)
    : null;

  return (
    <>
      <Header
        title="Hội thoại"
        description="Quản lý toàn bộ tương tác với khách hàng"
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Conversation List */}
        <div
          className={cn(
            "w-full flex-col bg-owly-surface",
            mobileShowDetail ? "hidden" : "flex"
          )}
        >
          {/* Filters */}
          <div className="p-3 border-b border-owly-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-owly-text-light" />
              <input
                type="text"
                placeholder="Tìm kiếm hội thoại..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-owly-border rounded-lg bg-owly-bg focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="flex-1 text-xs px-2 py-1.5 border border-owly-border rounded-lg bg-owly-bg focus:outline-none focus:ring-2 focus:ring-owly-primary/30 text-owly-text"
              >
                {channels.map((ch) => (
                  <option key={ch.value} value={ch.value}>
                    {ch.label}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 text-xs px-2 py-1.5 border border-owly-border rounded-lg bg-owly-bg focus:outline-none focus:ring-2 focus:ring-owly-primary/30 text-owly-text"
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="text-sm text-owly-text-light">Đang tải...</div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
                <div className="p-4 rounded-full bg-owly-primary-50 mb-4">
                  <Inbox className="h-8 w-8 text-owly-primary" />
                </div>
                <p className="font-medium text-owly-text">
                  Không tìm thấy hội thoại
                </p>
                <p className="text-sm text-owly-text-light mt-1">
                  Hội thoại sẽ xuất hiện tại đây khi khách hàng liên hệ
                </p>
              </div>
            ) : (
              <div className="divide-y divide-owly-border">
                {conversations.map((conv) => {
                  const ChannelIcon =
                    channelIcons[conv.channel] || MessageSquare;
                  const lastMessage = conv.messages[0];
                  const isSelected = selectedId === conv.id;
                  const identity = getConversationIdentity(conv);

                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={cn(
                        "w-full px-4 py-3.5 text-left hover:bg-owly-primary-50/50 transition-colors",
                        isSelected && "bg-owly-primary-50 border-l-2 border-l-owly-primary"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "p-2 rounded-lg mt-0.5 flex-shrink-0",
                            channelColors[conv.channel] ||
                              "text-owly-primary bg-owly-primary-50"
                          )}
                        >
                          <ChannelIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-medium text-sm text-owly-text truncate">
                              {identity.displayName}
                            </p>
                            <span className="text-xs text-owly-text-light flex-shrink-0 ml-2">
                              {formatRelativeTime(conv.updatedAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-owly-text-light min-w-0">
                            <span>{identity.platformLabel}</span>
                            {identity.accountName && (
                              <>
                                <span>•</span>
                                <span className="truncate">{identity.accountName}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{conv._count.messages} tin nhắn</span>
                          </div>
                          {identity.customerCode && (
                            <p className="text-[11px] text-owly-text-light mt-1 truncate">
                              {identity.customerCodeLabel}: {identity.customerCode}
                            </p>
                          )}
                          {lastMessage && (
                            <p className="text-sm text-owly-text-light mt-1 truncate">
                              {lastMessage.role === "admin" && (
                                <span className="text-owly-primary font-medium">
                                  Bạn:{" "}
                                </span>
                              )}
                              {lastMessage.content}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-medium",
                                getStatusColor(conv.status)
                              )}
                            >
                              {getStatusLabel(conv.status)}
                            </span>
                            {conv.tags.slice(0, 2).map((ct) => (
                              <span
                                key={ct.id}
                                className="px-1.5 py-0.5 rounded text-xs font-medium bg-owly-primary-50 text-owly-primary"
                              >
                                {ct.tag.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Conversation Detail */}
        <div
          className={cn(
            "flex-1 flex-col bg-owly-bg",
            !mobileShowDetail ? "hidden" : "flex"
          )}
        >
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="p-5 rounded-full bg-owly-surface border border-owly-border mb-4">
                <MessageSquare className="h-10 w-10 text-owly-text-light" />
              </div>
              <p className="font-semibold text-lg text-owly-text">
                Chọn một hội thoại
              </p>
              <p className="text-sm text-owly-text-light mt-1 max-w-sm">
                Chọn hội thoại từ danh sách để xem toàn bộ nội dung và trả lời khách hàng
              </p>
            </div>
          ) : detailLoading && !selectedConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-sm text-owly-text-light">Đang tải...</div>
            </div>
          ) : selectedConversation ? (
            <>
              {/* Conversation Header */}
              <div className="min-h-[88px] border-b border-owly-border bg-owly-surface px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setMobileShowDetail(false);
                      setSelectedId(null);
                      setSelectedConversation(null);
                    }}
                    className="mr-1 p-1.5 hover:bg-owly-primary-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <ArrowLeft className="h-5 w-5 text-owly-text" />
                  </button>
                  <div
                    className={cn(
                      "p-2 rounded-lg flex-shrink-0",
                      channelColors[selectedConversation.channel] ||
                        "text-owly-primary bg-owly-primary-50"
                    )}
                  >
                    {(() => {
                      const Icon =
                        channelIcons[selectedConversation.channel] ||
                        MessageSquare;
                      return <Icon className="h-4 w-4" />;
                    })()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-owly-text truncate">
                        {selectedIdentity?.displayName}
                      </h3>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          getStatusColor(selectedConversation.status)
                        )}
                      >
                        {getStatusLabel(selectedConversation.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-owly-text-light mt-1">
                      <span className="px-2 py-0.5 rounded-full bg-owly-bg border border-owly-border">
                        Nền tảng: {selectedIdentity?.platformLabel}
                      </span>
                      {selectedIdentity?.accountName && (
                        <span className="px-2 py-0.5 rounded-full bg-owly-bg border border-owly-border">
                          Tài khoản: {selectedIdentity.accountName}
                        </span>
                      )}
                      {selectedIdentity?.customerCode && (
                        <span className="px-2 py-0.5 rounded-full bg-owly-bg border border-owly-border">
                          {selectedIdentity.customerCodeLabel}: {selectedIdentity.customerCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <select
                    value={selectedConversation.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="text-xs px-2 py-1.5 border border-owly-border rounded-lg bg-owly-bg focus:outline-none focus:ring-2 focus:ring-owly-primary/30 text-owly-text"
                  >
                    {statuses
                      .filter((s) => s.value !== "all")
                      .map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Tags Bar */}
              {selectedConversation.tags.length > 0 && (
                <div className="px-4 md:px-6 py-2 bg-owly-surface border-b border-owly-border flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-owly-text-light" />
                  {selectedConversation.tags.map((ct) => (
                    <span
                      key={ct.id}
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: ct.tag.color + "20",
                        color: ct.tag.color,
                      }}
                    >
                      {ct.tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Messages Thread */}
              <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
                {selectedConversation.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare className="h-8 w-8 text-owly-text-light opacity-40 mb-2" />
                    <p className="text-sm text-owly-text-light">
                      Chưa có tin nhắn nào trong hội thoại này
                    </p>
                  </div>
                ) : (
                  selectedConversation.messages.map((msg) => {
                    const isAdmin =
                      msg.role === "admin" || msg.role === "assistant";
                    const isSystem = msg.role === "system";

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="px-3 py-1.5 bg-owly-surface border border-owly-border rounded-full text-xs text-owly-text-light">
                            {msg.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          isAdmin ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5",
                            isAdmin
                              ? "bg-owly-primary text-white rounded-br-md"
                              : "bg-owly-surface border border-owly-border text-owly-text rounded-bl-md"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={cn(
                                "text-xs font-medium",
                                isAdmin
                                  ? "text-white/80"
                                  : "text-owly-text-light"
                              )}
                            >
                              {isAdmin
                                ? msg.role === "assistant"
                                  ? "Trợ lý AI"
                                  : "Nhân viên"
                                : selectedIdentity?.displayName}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                          <p
                            className={cn(
                              "text-xs mt-1",
                              isAdmin
                                ? "text-white/60"
                                : "text-owly-text-light"
                            )}
                          >
                            {formatRelativeTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input */}
              <div className="px-4 md:px-8 py-4 bg-owly-surface border-t border-owly-border">
                {sendError && (
                  <p className="mb-2 text-sm text-red-600">{sendError}</p>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Nhập phản hồi... (Enter để gửi, Shift+Enter để xuống dòng)"
                      rows={1}
                      className="w-full px-4 py-2.5 text-sm border border-owly-border rounded-xl bg-owly-bg focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary resize-none"
                      style={{
                        minHeight: "42px",
                        maxHeight: "120px",
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto";
                        target.style.height =
                          Math.min(target.scrollHeight, 120) + "px";
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sending}
                    className={cn(
                      "p-2.5 rounded-xl transition-colors flex-shrink-0",
                      replyText.trim() && !sending
                        ? "bg-owly-primary text-white hover:bg-owly-primary-dark"
                        : "bg-owly-border text-owly-text-light cursor-not-allowed"
                    )}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
