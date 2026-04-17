"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Contact,
  MessageSquare,
  Settings,
  Radio,
  Ticket,
  BarChart3,
  ScrollText,
  Timer,
  Zap,
  Workflow,
  Clock,
  Shield,
  FileCode,
  Webhook,
  ChevronLeft,
  ChevronRight,
  Beaker,
} from "lucide-react";
import { useState, useEffect } from "react";

interface NavSection {
  title?: string;
  items: { name: string; href: string; icon: React.ElementType }[];
}

const sections: NavSection[] = [
  {
    items: [
      { name: "Tổng quan", href: "/", icon: LayoutDashboard },
      { name: "Hội thoại", href: "/conversations", icon: MessageSquare },
      { name: "Khách hàng", href: "/customers", icon: Contact },
      { name: "Phiếu hỗ trợ", href: "/tickets", icon: Ticket },
    ],
  },
  {
    title: "Kiến thức",
    items: [
      { name: "Kho kiến thức", href: "/knowledge", icon: BookOpen },
      { name: "Mẫu trả lời", href: "/canned-responses", icon: Zap },
      { name: "Tự động hóa", href: "/automation", icon: Workflow },
      { name: "Giờ làm việc", href: "/business-hours", icon: Clock },
    ],
  },
  {
    title: "Đội ngũ",
    items: [
      { name: "Nhân sự", href: "/team", icon: Users },
      { name: "Quy tắc SLA", href: "/sla", icon: Timer },
    ],
  },
  {
    title: "Kênh",
    items: [
      { name: "Kênh liên hệ", href: "/channels", icon: Radio },
      { name: "Webhooks", href: "/webhooks", icon: Webhook },
    ],
  },
  {
    title: "Phân tích",
    items: [
      { name: "Báo cáo", href: "/analytics", icon: BarChart3 },
      { name: "Nhật ký hoạt động", href: "/activity", icon: ScrollText },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { name: "Quản trị", href: "/admin", icon: Shield },
      { name: "Tài liệu API", href: "/api-docs", icon: FileCode },
      { name: "Kiểm thử AI", href: "/testing", icon: Beaker },
      { name: "Cài đặt", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logo, setLogo] = useState("/owly.png");
  const [name, setName] = useState("MinhHyHair");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.logoUrl) setLogo(data.logoUrl);
        if (data.businessName) setName(data.businessName);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleToggle = () => setMobileOpen((p) => !p);
    window.addEventListener("toggle-sidebar", handleToggle);
    return () => window.removeEventListener("toggle-sidebar", handleToggle);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "flex flex-col bg-owly-sidebar text-white transition-all duration-300",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "fixed inset-y-0 left-0 z-50 translate-x-0" : "hidden md:flex"
        )}
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        {logo.startsWith("data:") || logo.startsWith("http") ? (
          <img
            src={logo}
            alt={name}
            className="w-8 h-8 rounded-lg flex-shrink-0 object-cover bg-white"
          />
        ) : (
          <img
            src={logo}
            alt={name}
            className="w-8 h-8 rounded-lg flex-shrink-0 object-cover bg-white"
          />
        )}
        {!collapsed && (
          <div className="overflow-hidden flex-1">
            <h1 className="text-base font-bold tracking-tight truncate" title={name}>{name}</h1>
            <p className="text-[10px] text-white/50 truncate">Chăm sóc khách hàng AI</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-3">
        {sections.map((section, si) => (
          <div key={si}>
            {section.title && !collapsed && (
              <p className="px-3 mb-1 text-[10px] uppercase tracking-wider text-white/40 font-medium">
                {section.title}
              </p>
            )}
            {collapsed && si > 0 && (
              <div className="mx-3 mb-2 border-t border-white/10" />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-owly-sidebar-active text-white"
                        : "text-white/65 hover:bg-owly-sidebar-hover hover:text-white"
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="hidden md:block px-2 py-2 border-t border-white/10">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-1.5 rounded-md text-white/40 hover:text-white hover:bg-owly-sidebar-hover transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
    </>
  );
}
