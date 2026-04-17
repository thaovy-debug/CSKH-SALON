import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { OnboardingChecklist } from "@/components/ui/onboarding-checklist";
import { prisma } from "@/lib/prisma";
import {
  MessageSquare,
  Ticket,
  Phone,
  Mail,
  MessageCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { formatRelativeTime, getChannelLabel, getStatusColor } from "@/lib/utils";

async function getStats() {
  const [
    totalConversations,
    activeConversations,
    totalTickets,
    openTickets,
    totalMessages,
    recentConversations,
  ] = await Promise.all([
    prisma.conversation.count(),
    prisma.conversation.count({ where: { status: "active" } }),
    prisma.ticket.count(),
    prisma.ticket.count({ where: { status: "open" } }),
    prisma.message.count(),
    prisma.conversation.findMany({
      take: 10,
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { take: 1, orderBy: { createdAt: "desc" } },
        _count: { select: { messages: true } },
      },
    }),
  ]);

  const resolvedConversations = await prisma.conversation.count({
    where: { status: "resolved" },
  });

  const resolutionRate =
    totalConversations > 0
      ? Math.round((resolvedConversations / totalConversations) * 100)
      : 0;

  return {
    totalConversations,
    activeConversations,
    totalTickets,
    openTickets,
    totalMessages,
    resolutionRate,
    recentConversations,
  };
}

const channelIcons: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
};

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <>
      <Header
        title="Tổng quan"
        description="Theo dõi nhanh toàn bộ hoạt động chăm sóc khách hàng của bạn"
      />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <OnboardingChecklist />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Tổng hội thoại"
            value={stats.totalConversations}
            icon={MessageSquare}
          />
          <StatCard
            title="Đang xử lý"
            value={stats.activeConversations}
            icon={Clock}
            iconColor="bg-green-50 text-green-600"
          />
          <StatCard
            title="Phiếu đang mở"
            value={stats.openTickets}
            icon={Ticket}
            iconColor="bg-orange-50 text-orange-600"
          />
          <StatCard
            title="Tỷ lệ xử lý"
            value={`${stats.resolutionRate}%`}
            icon={CheckCircle}
            iconColor="bg-blue-50 text-blue-600"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-owly-border bg-owly-surface">
            <div className="border-b border-owly-border px-5 py-4">
              <h3 className="font-semibold text-owly-text">Hội thoại gần đây</h3>
            </div>
            <div className="divide-y divide-owly-border">
              {stats.recentConversations.length === 0 ? (
                <div className="px-5 py-12 text-center text-owly-text-light">
                  <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-40" />
                  <p className="font-medium">Chưa có hội thoại nào</p>
                  <p className="mt-1 text-sm">
                    Hội thoại sẽ xuất hiện tại đây khi khách hàng bắt đầu liên hệ
                  </p>
                </div>
              ) : (
                stats.recentConversations.map((conv) => {
                  const ChannelIcon =
                    channelIcons[conv.channel] || MessageSquare;
                  const lastMessage = conv.messages[0];

                  return (
                    <div
                      key={conv.id}
                      className="cursor-pointer px-5 py-3.5 transition-colors hover:bg-owly-primary-50/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-lg bg-owly-primary-50 p-2 text-owly-primary">
                          <ChannelIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="truncate text-sm font-medium text-owly-text">
                              {conv.customerName}
                            </p>
                            <span className="ml-2 shrink-0 text-xs text-owly-text-light">
                              {formatRelativeTime(conv.updatedAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-owly-text-light">
                            {getChannelLabel(conv.channel)} - {conv._count.messages} tin nhắn
                          </p>
                          {lastMessage && (
                            <p className="mt-1 truncate text-sm text-owly-text-light">
                              {lastMessage.content}
                            </p>
                          )}
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(conv.status)}`}
                        >
                          {conv.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-owly-border bg-owly-surface">
              <div className="border-b border-owly-border px-5 py-4">
                <h3 className="font-semibold text-owly-text">Tổng quan kênh</h3>
              </div>
              <div className="space-y-4 p-5">
                {[
                  {
                    name: "WhatsApp",
                    icon: MessageCircle,
                    color: "text-green-600",
                  },
                  { name: "Email", icon: Mail, color: "text-blue-600" },
                  { name: "Điện thoại", icon: Phone, color: "text-purple-600" },
                ].map((channel) => (
                  <div
                    key={channel.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <channel.icon className={`h-4 w-4 ${channel.color}`} />
                      <span className="text-sm font-medium">{channel.name}</span>
                    </div>
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                      Chưa kết nối
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-owly-border bg-owly-surface">
              <div className="border-b border-owly-border px-5 py-4">
                <h3 className="font-semibold text-owly-text">Chỉ số nhanh</h3>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex justify-between text-sm">
                  <span className="text-owly-text-light">Tổng tin nhắn</span>
                  <span className="font-medium">{stats.totalMessages}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-owly-text-light">Tổng phiếu hỗ trợ</span>
                  <span className="font-medium">{stats.totalTickets}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-owly-text-light">Tỷ lệ xử lý trung bình</span>
                  <span className="font-medium">{stats.resolutionRate}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
