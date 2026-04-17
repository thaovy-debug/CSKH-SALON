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
  createdAt: string;
  updatedAt: string;
}

const channelIcons: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
};

const channelColors: Record<string, string> = {
  whatsapp: "text-green-600 bg-green-50",
  email: "text-blue-600 bg-blue-50",
  phone: "text-purple-600 bg-purple-50",
};

const channels = [
  { value: "all", label: "Tất cả kênh" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Điện thoại" },
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
                              {conv.customerName}
                            </p>
                            <span className="text-xs text-owly-text-light flex-shrink-0 ml-2">
                              {formatRelativeTime(conv.updatedAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-owly-text-light">
                              {getChannelLabel(conv.channel)}
                            </span>
                            <span className="text-xs text-owly-text-light">
                              --
                            </span>
                            <span className="text-xs text-owly-text-light">
                              {conv._count.messages} tin nhắn
                            </span>
                          </div>
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
              <div className="h-16 border-b border-owly-border bg-owly-surface px-4 md:px-6 flex items-center justify-between flex-shrink-0">
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
                        {selectedConversation.customerName}
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
                    <div className="flex items-center gap-2 text-xs text-owly-text-light">
                      <span>
                        {getChannelLabel(selectedConversation.channel)}
                      </span>
                      {selectedConversation.customerContact && (
                        <>
                          <span>--</span>
                          <span>{selectedConversation.customerContact}</span>
                        </>
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
                                : selectedConversation.customerName}
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
