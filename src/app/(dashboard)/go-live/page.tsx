"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  Clock3,
  Radio,
  Settings,
  TriangleAlert,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";

interface SettingsData {
  aiProvider?: string;
  aiModel?: string;
  aiApiKey?: string;
}

interface ChannelData {
  type: string;
  isActive: boolean;
  status: string;
}

interface BusinessHoursData {
  enabled: boolean;
  lastCustomerTime?: string;
}

export default function GoLivePage() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHoursData>({
    enabled: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, channelsRes, businessHoursRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/channels"),
        fetch("/api/business-hours"),
      ]);

      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (channelsRes.ok) setChannels(await channelsRes.json());
      if (businessHoursRes.ok) setBusinessHours(await businessHoursRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeChannels = useMemo(
    () => channels.filter((channel) => channel.isActive),
    [channels]
  );

  const checks = [
    {
      id: "ai",
      title: "Bật AI",
      description: "Đảm bảo Gemini đang có model và API key hợp lệ trước khi khách nhắn thật.",
      done:
        !!settings.aiProvider &&
        !!settings.aiModel &&
        !!settings.aiApiKey &&
        settings.aiApiKey.length > 0,
      href: "/settings",
      icon: Settings,
    },
    {
      id: "channels",
      title: "Monitor chat",
      description: "Phải có ít nhất một kênh đang bật để theo dõi hội thoại thực tế của khách.",
      done: activeChannels.length > 0,
      href: "/conversations",
      icon: Radio,
    },
    {
      id: "hours",
      title: "Giờ vận hành",
      description: "Kiểm tra giờ mở cửa và giờ nhận khách cuối để auto-reply ngoài giờ chạy đúng.",
      done: businessHours.enabled && !!businessHours.lastCustomerTime,
      href: "/business-hours",
      icon: Clock3,
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header
        title="Go Live"
        description="Checklist vận hành trước khi để SalonDesk hỗ trợ khách hàng thật"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl space-y-6">
          <div className="bg-owly-surface border border-owly-border rounded-xl p-5">
            <h3 className="text-base font-semibold text-owly-text mb-4">
              Trạng thái nhanh
            </h3>
            {loading ? (
              <p className="text-sm text-owly-text-light">Đang tải...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {checks.map((check) => {
                  const Icon = check.icon;

                  return (
                    <Link
                      key={check.id}
                      href={check.href}
                      className={cn(
                        "rounded-xl border p-4 transition-colors",
                        check.done
                          ? "border-green-200 bg-green-50"
                          : "border-amber-200 bg-amber-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "p-2 rounded-lg",
                              check.done ? "bg-green-100" : "bg-amber-100"
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-4 w-4",
                                check.done ? "text-green-700" : "text-amber-700"
                              )}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-owly-text">
                              {check.title}
                            </p>
                            <p className="text-xs text-owly-text-light mt-1">
                              {check.description}
                            </p>
                          </div>
                        </div>
                        {check.done ? (
                          <CheckCircle className="h-5 w-5 text-green-700 flex-shrink-0" />
                        ) : (
                          <TriangleAlert className="h-5 w-5 text-amber-700 flex-shrink-0" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-owly-surface border border-owly-border rounded-xl p-5">
            <h3 className="text-base font-semibold text-owly-text mb-4">
              Việc nên làm khi chạy thật
            </h3>
            <div className="space-y-3">
              <div className="rounded-lg border border-owly-border bg-owly-bg p-4">
                <p className="text-sm font-semibold text-owly-text">1. Bật AI và kênh nhận tin</p>
                <p className="text-sm text-owly-text-light mt-1">
                  Kiểm tra Gemini key, model, widget web chat hoặc WhatsApp đang bật.
                </p>
              </div>
              <div className="rounded-lg border border-owly-border bg-owly-bg p-4">
                <p className="text-sm font-semibold text-owly-text">2. Theo dõi hội thoại trong ngày đầu</p>
                <p className="text-sm text-owly-text-light mt-1">
                  Vào mục Hội thoại để xem AI hỏi tóc, báo giá khoảng và chốt lịch có đúng ý không.
                </p>
              </div>
              <div className="rounded-lg border border-owly-border bg-owly-bg p-4">
                <p className="text-sm font-semibold text-owly-text">3. Chỉnh prompt hoặc kho kiến thức nếu sai</p>
                <p className="text-sm text-owly-text-light mt-1">
                  Nếu AI tư vấn chưa đúng nghiệp vụ salon, sửa ở Cài đặt hoặc Kho kiến thức rồi test lại ngay.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/settings"
              className="rounded-xl border border-owly-border bg-owly-surface p-4 hover:bg-owly-bg transition-colors"
            >
              <p className="text-sm font-semibold text-owly-text">Cấu hình AI</p>
              <p className="text-xs text-owly-text-light mt-1">
                Đổi provider, model, prompt và thông tin salon
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-owly-primary font-medium">
                Mở cài đặt <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link
              href="/knowledge"
              className="rounded-xl border border-owly-border bg-owly-surface p-4 hover:bg-owly-bg transition-colors"
            >
              <p className="text-sm font-semibold text-owly-text">Kho kiến thức</p>
              <p className="text-xs text-owly-text-light mt-1">
                Chỉnh giá, chính sách, FAQ và chăm sóc sau dịch vụ
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-owly-primary font-medium">
                Mở kho kiến thức <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link
              href="/testing"
              className="rounded-xl border border-owly-border bg-owly-surface p-4 hover:bg-owly-bg transition-colors"
            >
              <p className="text-sm font-semibold text-owly-text">Kiểm thử lại</p>
              <p className="text-xs text-owly-text-light mt-1">
                Chạy nhanh các câu test trước khi cho khách nhắn thật
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-owly-primary font-medium">
                Mở màn test <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
