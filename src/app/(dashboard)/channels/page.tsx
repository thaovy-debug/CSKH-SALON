"use client";

import { Header } from "@/components/layout/header";
import Link from "next/link";
import {
  MessageCircle,
  Mail,
  Phone,
  Wifi,
  WifiOff,
  Save,
  Loader2,
  QrCode,
  Key,
  TestTube,
  PhoneCall,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChannelData {
  id: string | null;
  type: string;
  isActive: boolean;
  config: Record<string, unknown>;
  status: string;
  qr?: string | null;
}

interface ChannelAccountData {
  id: string;
  type: string;
  displayName: string;
  externalAccountId: string;
  isActive: boolean;
  isDefault: boolean;
  config: Record<string, unknown>;
  status: string;
  lastError?: string;
}

type WhatsAppMode = "web" | "api";
const CHANNEL_PAGE_ORDER = ["facebook", "instagram", "zalo", "shopee", "tiktok_shop", "whatsapp", "email", "phone"];
const ACCOUNT_MANAGED_CHANNEL_TYPES = ["facebook", "instagram", "shopee", "tiktok_shop"];
const MARKETPLACE_CHANNEL_TYPES = ["shopee", "tiktok_shop"];
const MARKETPLACE_CONNECTED_STATUSES = new Set([
  "connected",
  "authorized",
  "webhook_verified",
  "chat_receive_verified",
  "chat_send_verified",
  "production_ready",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const isConnected = status === "connected";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
        isConnected
          ? "bg-owly-success/10 text-owly-success"
          : "bg-owly-danger/10 text-owly-danger"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isConnected ? "bg-owly-success" : "bg-owly-danger"
        )}
      />
      {isConnected ? "Đã kết nối" : "Chưa kết nối"}
    </span>
  );
}

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:ring-offset-2",
        enabled ? "bg-owly-primary" : "bg-owly-border"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          enabled ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  isSecret = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  isSecret?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="block text-xs font-medium text-owly-text-light mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type={isSecret && !visible ? "password" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-owly-border rounded-lg bg-owly-bg text-owly-text placeholder:text-owly-text-light/50 focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary transition-colors"
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-owly-text-light hover:text-owly-text transition-colors"
          >
            {visible ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function SecretHint({ shown }: { shown: boolean }) {
  if (!shown) return null;
  return <p className="mt-1 text-[11px] text-owly-text-light">Để trống để giữ secret hiện có.</p>;
}

function getChannelLabel(type: string): string {
  if (type === "facebook") return "Facebook";
  if (type === "instagram") return "Instagram";
  if (type === "zalo") return "Zalo";
  if (type === "shopee") return "Shopee";
  if (type === "tiktok_shop") return "TikTok Shop";
  if (type === "whatsapp") return "WhatsApp";
  if (type === "email") return "Email";
  if (type === "phone") return "Điện thoại";
  return type;
}

function getChannelDescription(type: string): string {
  if (type === "facebook") return "Tin nhắn từ Facebook Page";
  if (type === "instagram") return "Tin nhắn Instagram Direct";
  if (type === "zalo") return "Tài khoản Zalo đang vận hành";
  if (type === "shopee") return "Shopee Seller Chat";
  if (type === "tiktok_shop") return "TikTok Shop Seller Chat";
  if (type === "whatsapp") return "WhatsApp Web hoặc API";
  if (type === "email") return "SMTP và IMAP";
  if (type === "phone") return "Twilio và cuộc gọi";
  return "Kênh liên hệ";
}

function getChannelAccent(type: string): string {
  if (type === "facebook") return "bg-blue-50 text-blue-600";
  if (type === "instagram") return "bg-pink-50 text-pink-600";
  if (type === "zalo") return "bg-cyan-50 text-cyan-600";
  if (type === "shopee") return "bg-orange-50 text-orange-600";
  if (type === "tiktok_shop") return "bg-slate-100 text-slate-700";
  if (type === "whatsapp") return "bg-green-50 text-green-600";
  if (type === "email") return "bg-sky-50 text-sky-600";
  if (type === "phone") return "bg-purple-50 text-purple-600";
  return "bg-owly-primary-50 text-owly-primary";
}

function isMarketplaceChannel(type: string): boolean {
  return MARKETPLACE_CHANNEL_TYPES.includes(type);
}

function isAccountManagedChannel(type: string): boolean {
  return ACCOUNT_MANAGED_CHANNEL_TYPES.includes(type);
}

function isMarketplaceAccountReady(status: string): boolean {
  return MARKETPLACE_CONNECTED_STATUSES.has(status);
}

function isChannelAccountReady(type: string, status: string): boolean {
  return isMarketplaceChannel(type)
    ? isMarketplaceAccountReady(status)
    : status === "connected";
}

function ChannelIcon({ type }: { type: string }) {
  if (type === "email") return <Mail className="h-4 w-4" />;
  if (type === "phone") return <Phone className="h-4 w-4" />;
  return <MessageCircle className="h-4 w-4" />;
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function hasSecret(existingSecret: boolean, currentValue: string): boolean {
  return existingSecret || hasText(currentValue);
}

function ConfigReadiness({
  issues,
  warnings = [],
  isActive,
}: {
  issues: string[];
  warnings?: string[];
  isActive: boolean;
}) {
  if (issues.length === 0 && warnings.length === 0) {
    return (
      <div className="rounded-lg border border-owly-success/20 bg-owly-success/10 p-3 text-sm text-owly-success">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>{isActive ? "Đủ thông tin để lưu và bật kênh." : "Đủ thông tin cơ bản, có thể lưu nháp hoặc bật khi cần."}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm",
        issues.length > 0 && isActive
          ? "border-amber-300 bg-amber-50 text-amber-800"
          : "border-owly-border bg-owly-bg text-owly-text-light"
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="space-y-2">
          {issues.length > 0 && (
            <div>
              <p className="font-medium text-owly-text">
                {isActive
                  ? "Chưa thể lưu khi kênh đang bật. Cần bổ sung:"
                  : "Có thể lưu nháp khi kênh đang tắt, nhưng cần bổ sung trước khi bật:"}
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <p className="font-medium text-owly-text">Khuyến nghị kiểm tra thêm:</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelOverview({
  channels,
  accounts,
  selectedType,
  onSelect,
}: {
  channels: ChannelData[];
  accounts: ChannelAccountData[];
  selectedType: string;
  onSelect: (type: string) => void;
}) {
  const connectedChannelCount = channels.filter(
    (channel) => !isAccountManagedChannel(channel.type) && channel.status === "connected"
  ).length;
  const activeChannelCount = channels.filter(
    (channel) => !isAccountManagedChannel(channel.type) && channel.isActive
  ).length;
  const connectedAccountManagedCount = ACCOUNT_MANAGED_CHANNEL_TYPES.filter((type) => {
    const channelAccounts = accounts.filter((account) => account.type === type);
    if (channelAccounts.length > 0) {
      return channelAccounts.some((account) => isChannelAccountReady(type, account.status));
    }
    return channels.find((channel) => channel.type === type)?.status === "connected";
  }).length;
  const activeAccountManagedCount = ACCOUNT_MANAGED_CHANNEL_TYPES.filter((type) => {
    const channelAccounts = accounts.filter((account) => account.type === type);
    if (channelAccounts.length > 0) {
      return channelAccounts.some((account) => account.isActive);
    }
    return Boolean(channels.find((channel) => channel.type === type)?.isActive);
  }).length;
  const connectedCount = connectedChannelCount + connectedAccountManagedCount;
  const activeCount = activeChannelCount + activeAccountManagedCount;

  return (
    <section className="w-full space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-base font-semibold text-owly-text">Tổng quan kênh</h2>
          <p className="mt-1 text-sm text-owly-text-light">
            Chọn một kênh để xem trạng thái và cấu hình mặc định.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
          <span className="rounded-full border border-owly-border bg-owly-surface px-3 py-1 text-xs text-owly-text-light">{connectedCount} đang kết nối</span>
          <span className="rounded-full border border-owly-border bg-owly-surface px-3 py-1 text-xs text-owly-text-light">{activeCount} đang bật</span>
          <Link
            href="/channels/accounts"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-owly-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-owly-primary-dark"
          >
            <Key className="h-4 w-4" />
            Quản lý {accounts.length} tài khoản
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {CHANNEL_PAGE_ORDER.map((type) => {
          const channel = channels.find((item) => item.type === type);
          const channelAccounts = accounts.filter((account) => account.type === type);
          const accountCount = channelAccounts.length;
          const isSelected = selectedType === type;
          const isAccountManaged = isAccountManagedChannel(type);
          const isConnected = isAccountManaged && accountCount > 0
            ? channelAccounts.some((account) => isChannelAccountReady(type, account.status))
            : channel?.status === "connected";
          const isActive = isAccountManaged && accountCount > 0
            ? channelAccounts.some((account) => account.isActive)
            : Boolean(channel?.isActive);
          const statusText = isAccountManaged && accountCount === 0
            ? "Chưa có account"
            : isConnected
              ? "Đã kết nối"
              : isActive
                ? "Đã khai báo"
                : "Chưa bật";

          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className={cn(
                "text-left rounded-lg border bg-owly-surface p-4 transition-colors",
                isSelected
                  ? "border-owly-primary ring-2 ring-owly-primary/15"
                  : "border-owly-border hover:border-owly-primary/40 hover:bg-owly-primary-50/30"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn("rounded-lg p-2", getChannelAccent(type))}>
                    <ChannelIcon type={type} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-owly-text">
                      {getChannelLabel(type)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-owly-text-light">
                      {getChannelDescription(type)}
                    </span>
                  </span>
                </div>
                <span
                  className={cn(
                    "mt-1 h-2 w-2 rounded-full",
                    isConnected ? "bg-owly-success" : isActive ? "bg-amber-500" : "bg-owly-border"
                  )}
                />
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className={isConnected ? "text-owly-success" : "text-owly-text-light"}>
                  {statusText}
                </span>
                <span className="text-owly-text-light">
                  {accountCount} account
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp Card
// ---------------------------------------------------------------------------

function WhatsAppCard({
  channel,
  onSave,
  onAction,
  saving,
}: {
  channel: ChannelData;
  onSave: (type: string, config: Record<string, unknown>, isActive: boolean) => void;
  onAction: (type: string, action: string) => void;
  saving: boolean;
}) {
  const cfg = channel.config as Record<string, string | boolean>;
  const [isActive, setIsActive] = useState(channel.isActive);
  const [mode, setMode] = useState<WhatsAppMode>(
    (String(cfg.mode || "web") as WhatsAppMode)
  );
  const [apiKey, setApiKey] = useState(String(cfg.apiKey || ""));
  const [phoneNumber, setPhoneNumber] = useState(String(cfg.phoneNumber || ""));
  const isConnected = channel.status === "connected";
  const hasApiKey = Boolean(cfg.hasApiKey);
  const readinessIssues =
    mode === "api"
      ? [
          !hasSecret(hasApiKey, apiKey) ? "Thiếu WhatsApp API key." : "",
          !hasText(phoneNumber) ? "Thiếu số điện thoại WhatsApp dùng để gửi/nhận." : "",
        ].filter(Boolean)
      : [];
  const readinessWarnings =
    mode === "web" && isActive && !isConnected
      ? ["WhatsApp Web cần bấm Kết nối và quét QR để nhận tin nhắn thực tế."]
      : [];
  const saveDisabled = saving || (isActive && readinessIssues.length > 0);

  return (
    <div className="bg-owly-surface rounded-xl border border-owly-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-owly-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-green-50 text-green-600">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-owly-text">WhatsApp</h3>
              <p className="text-xs text-owly-text-light mt-0.5">
                Nhận và gửi tin nhắn qua WhatsApp Web hoặc API
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={channel.status} />
            <Toggle enabled={isActive} onChange={setIsActive} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Mode selector */}
        <div>
          <label className="block text-xs font-medium text-owly-text-light mb-2">
            Phương thức kết nối
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("web")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                mode === "web"
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-owly-border bg-owly-bg text-owly-text-light hover:bg-owly-primary-50 hover:text-owly-text"
              )}
            >
              <QrCode className="h-4 w-4" />
              WhatsApp Web
            </button>
            <button
              type="button"
              onClick={() => setMode("api")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                mode === "api"
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-owly-border bg-owly-bg text-owly-text-light hover:bg-owly-primary-50 hover:text-owly-text"
              )}
            >
              <Key className="h-4 w-4" />
              API
            </button>
          </div>
        </div>

        {mode === "web" ? (
          <div>
            {isConnected ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    Phiên đang hoạt động
                  </span>
                </div>
                {phoneNumber && (
                  <p className="text-sm text-green-600">
                    Số điện thoại: {phoneNumber}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onAction("whatsapp", "disconnect")}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <WifiOff className="h-3.5 w-3.5" />
                  Ngắt kết nối
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-owly-border bg-owly-bg p-6 flex flex-col items-center">
                <div className="w-40 h-40 bg-white border-2 border-dashed border-owly-border rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                  {channel.qr ? (
                    <img src={channel.qr} alt="WhatsApp QR Code" className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="text-center">
                      <QrCode className="h-10 w-10 text-owly-text-light/40 mx-auto mb-1" />
                      <p className="text-xs text-owly-text-light/60">QR Code</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-owly-text-light text-center max-w-[220px]">
                  {channel.qr ? "Quét mã QR này bằng WhatsApp để kết nối." : "Bấm Kết nối để tạo mã QR."}
                </p>
                <button
                  type="button"
                  onClick={() => onAction("whatsapp", "connect")}
                  className="mt-3 flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Wifi className="h-4 w-4" />
                  Kết nối
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <FieldInput
              label="API Key"
              value={apiKey}
              onChange={setApiKey}
              placeholder="Nhập API key WhatsApp"
              isSecret
            />
            <FieldInput
              label="Số điện thoại"
              value={phoneNumber}
              onChange={setPhoneNumber}
              placeholder="+1234567890"
            />
            {isConnected && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">
                  API đã kết nối - Số: {phoneNumber || "N/A"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="space-y-3 border-t border-owly-border bg-owly-bg/50 px-5 py-3">
        <ConfigReadiness
          issues={readinessIssues}
          warnings={readinessWarnings}
          isActive={isActive}
        />
        <button
          type="button"
          disabled={saveDisabled}
          onClick={() =>
            onSave(
              "whatsapp",
              { mode, apiKey, phoneNumber },
              isActive
            )
          }
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-owly-primary rounded-lg hover:bg-owly-primary-dark disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Lưu
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email Card
// ---------------------------------------------------------------------------

function EmailCard({
  channel,
  onSave,
  onAction,
  saving,
}: {
  channel: ChannelData;
  onSave: (type: string, config: Record<string, unknown>, isActive: boolean) => void;
  onAction: (type: string, action: string) => void;
  saving: boolean;
}) {
  const cfg = channel.config as Record<string, string | boolean>;
  const [isActive, setIsActive] = useState(channel.isActive);

  const [smtpHost, setSmtpHost] = useState(String(cfg.smtpHost || ""));
  const [smtpPort, setSmtpPort] = useState(String(cfg.smtpPort || "587"));
  const [smtpUser, setSmtpUser] = useState(String(cfg.smtpUser || ""));
  const [smtpPass, setSmtpPass] = useState(String(cfg.smtpPass || ""));
  const [smtpFrom, setSmtpFrom] = useState(String(cfg.smtpFrom || ""));

  const [imapHost, setImapHost] = useState(String(cfg.imapHost || ""));
  const [imapPort, setImapPort] = useState(String(cfg.imapPort || "993"));
  const [imapUser, setImapUser] = useState(String(cfg.imapUser || ""));
  const [imapPass, setImapPass] = useState(String(cfg.imapPass || ""));

  const [testResult, setTestResult] = useState<string | null>(null);
  const hasSmtpPass = Boolean(cfg.hasSmtpPass);
  const hasImapPass = Boolean(cfg.hasImapPass);
  const readinessIssues = [
    !hasText(smtpHost) ? "Thiếu SMTP host để gửi email." : "",
    !hasText(smtpPort) ? "Thiếu SMTP port." : "",
    !hasText(smtpUser) ? "Thiếu tài khoản SMTP." : "",
    !hasSecret(hasSmtpPass, smtpPass) ? "Thiếu mật khẩu SMTP." : "",
    !hasText(smtpFrom) ? "Thiếu email gửi đi." : "",
    !hasText(imapHost) ? "Thiếu IMAP host để nhận email." : "",
    !hasText(imapPort) ? "Thiếu IMAP port." : "",
    !hasText(imapUser) ? "Thiếu tài khoản IMAP." : "",
    !hasSecret(hasImapPass, imapPass) ? "Thiếu mật khẩu IMAP." : "",
  ].filter(Boolean);
  const saveDisabled = saving || (isActive && readinessIssues.length > 0);

  const handleTest = async () => {
    setTestResult(null);
    onAction("email", "test");
    setTestResult("Đã bắt đầu kiểm tra - xem log server để biết kết quả");
    setTimeout(() => setTestResult(null), 4000);
  };

  return (
    <div className="bg-owly-surface rounded-xl border border-owly-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-owly-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-owly-text">Email</h3>
              <p className="text-xs text-owly-text-light mt-0.5">
                Gửi và nhận email qua SMTP / IMAP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={channel.status} />
            <Toggle enabled={isActive} onChange={setIsActive} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* SMTP */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-owly-text-light mb-3">
            SMTP (gửi đi)
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              label="Host"
              value={smtpHost}
              onChange={setSmtpHost}
              placeholder="smtp.example.com"
            />
            <FieldInput
              label="Port"
              value={smtpPort}
              onChange={setSmtpPort}
              placeholder="587"
              type="text"
            />
            <FieldInput
              label="Tài khoản"
              value={smtpUser}
              onChange={setSmtpUser}
              placeholder="user@example.com"
            />
            <FieldInput
              label="Mật khẩu"
              value={smtpPass}
              onChange={setSmtpPass}
              placeholder="Mật khẩu"
              isSecret
            />
          </div>
          <div className="mt-3">
            <FieldInput
              label="Email gửi đi"
              value={smtpFrom}
              onChange={setSmtpFrom}
              placeholder="noreply@example.com"
            />
          </div>
        </div>

        {/* IMAP */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-owly-text-light mb-3">
            IMAP (nhận vào)
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              label="Host"
              value={imapHost}
              onChange={setImapHost}
              placeholder="imap.example.com"
            />
            <FieldInput
              label="Port"
              value={imapPort}
              onChange={setImapPort}
              placeholder="993"
              type="text"
            />
            <FieldInput
              label="Tài khoản"
              value={imapUser}
              onChange={setImapUser}
              placeholder="user@example.com"
            />
            <FieldInput
              label="Mật khẩu"
              value={imapPass}
              onChange={setImapPass}
              placeholder="Mật khẩu"
              isSecret
            />
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-700">{testResult}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="space-y-3 border-t border-owly-border bg-owly-bg/50 px-5 py-3">
        <ConfigReadiness issues={readinessIssues} isActive={isActive} />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saveDisabled}
            onClick={() =>
              onSave(
                "email",
                {
                  smtpHost,
                  smtpPort,
                  smtpUser,
                  smtpPass,
                  smtpFrom,
                  imapHost,
                  imapPort,
                  imapUser,
                  imapPass,
                },
                isActive
              )
            }
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-owly-primary rounded-lg hover:bg-owly-primary-dark disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lưu
          </button>
          <button
            type="button"
            disabled={readinessIssues.length > 0}
            onClick={handleTest}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            <TestTube className="h-4 w-4" />
            Kiểm tra kết nối
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phone Card
// ---------------------------------------------------------------------------

function PhoneCard({
  channel,
  onSave,
  onAction,
  saving,
}: {
  channel: ChannelData;
  onSave: (type: string, config: Record<string, unknown>, isActive: boolean) => void;
  onAction: (type: string, action: string) => void;
  saving: boolean;
}) {
  const cfg = channel.config as Record<string, string | boolean>;
  const [isActive, setIsActive] = useState(channel.isActive);

  const [twilioSid, setTwilioSid] = useState(String(cfg.twilioSid || ""));
  const [twilioToken, setTwilioToken] = useState(String(cfg.twilioToken || ""));
  const [twilioPhone, setTwilioPhone] = useState(String(cfg.twilioPhone || ""));

  const [elevenLabsKey, setElevenLabsKey] = useState(String(cfg.elevenLabsKey || ""));
  const [elevenLabsVoice, setElevenLabsVoice] = useState(
    String(cfg.elevenLabsVoice || "")
  );

  const voiceOptions = [
    { id: "", label: "Chọn giọng đọc..." },
    { id: "rachel", label: "Rachel - Calm, professional" },
    { id: "drew", label: "Drew - Friendly, warm" },
    { id: "clyde", label: "Clyde - Authoritative" },
    { id: "domi", label: "Domi - Energetic, upbeat" },
    { id: "bella", label: "Bella - Soft, gentle" },
  ];

  const [testResult, setTestResult] = useState<string | null>(null);
  const hasTwilioToken = Boolean(cfg.hasTwilioToken);
  const hasElevenLabsKey = Boolean(cfg.hasElevenLabsKey);
  const readinessIssues = [
    !hasText(twilioSid) ? "Thiếu Twilio Account SID." : "",
    !hasSecret(hasTwilioToken, twilioToken) ? "Thiếu Twilio Auth Token." : "",
    !hasText(twilioPhone) ? "Thiếu số điện thoại Twilio để gọi/gửi SMS." : "",
  ].filter(Boolean);
  const readinessWarnings = [
    !hasSecret(hasElevenLabsKey, elevenLabsKey)
      ? "Chưa có ElevenLabs API key; luồng thoại có thể không tổng hợp được giọng nói."
      : "",
    !hasText(elevenLabsVoice)
      ? "Chưa chọn giọng đọc ElevenLabs; cần chọn nếu dùng trả lời thoại tự động."
      : "",
  ].filter(Boolean);
  const saveDisabled = saving || (isActive && readinessIssues.length > 0);

  const handleTestCall = () => {
    setTestResult(null);
    onAction("phone", "test");
    setTestResult("Đã bắt đầu gọi thử - kiểm tra Twilio để xem trạng thái");
    setTimeout(() => setTestResult(null), 4000);
  };

  return (
    <div className="bg-owly-surface rounded-xl border border-owly-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-owly-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-owly-text">Phone</h3>
              <p className="text-xs text-owly-text-light mt-0.5">
                Cuộc gọi thoại qua Twilio và ElevenLabs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={channel.status} />
            <Toggle enabled={isActive} onChange={setIsActive} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* Twilio */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-owly-text-light mb-3">
            Twilio
          </h4>
          <div className="space-y-3">
            <FieldInput
              label="Account SID"
              value={twilioSid}
              onChange={setTwilioSid}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            <FieldInput
              label="Auth Token"
              value={twilioToken}
              onChange={setTwilioToken}
              placeholder="Your Twilio auth token"
              isSecret
            />
            <FieldInput
              label="Số điện thoại"
              value={twilioPhone}
              onChange={setTwilioPhone}
              placeholder="+1234567890"
            />
          </div>
        </div>

        {/* ElevenLabs */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-owly-text-light mb-3">
            ElevenLabs Voice
          </h4>
          <div className="space-y-3">
            <FieldInput
              label="API Key"
              value={elevenLabsKey}
              onChange={setElevenLabsKey}
              placeholder="Your ElevenLabs API key"
              isSecret
            />
            <div>
              <label className="block text-xs font-medium text-owly-text-light mb-1">
                Giọng đọc
              </label>
              <select
                value={elevenLabsVoice}
                onChange={(e) => setElevenLabsVoice(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-owly-border rounded-lg bg-owly-bg text-owly-text focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary transition-colors"
              >
                {voiceOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-purple-600" />
            <span className="text-sm text-purple-700">{testResult}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="space-y-3 border-t border-owly-border bg-owly-bg/50 px-5 py-3">
        <ConfigReadiness
          issues={readinessIssues}
          warnings={readinessWarnings}
          isActive={isActive}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saveDisabled}
            onClick={() =>
              onSave(
                "phone",
                {
                  twilioSid,
                  twilioToken,
                  twilioPhone,
                  elevenLabsKey,
                  elevenLabsVoice,
                },
                isActive
              )
            }
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-owly-primary rounded-lg hover:bg-owly-primary-dark disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lưu
          </button>
          <button
            type="button"
            disabled={readinessIssues.length > 0}
            onClick={handleTestCall}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
          >
            <PhoneCall className="h-4 w-4" />
            Gọi thử
          </button>
        </div>
      </div>
    </div>
  );
}

function ZaloCard({
  channel,
  onSave,
  onAction,
  saving,
}: {
  channel: ChannelData;
  onSave: (type: string, config: Record<string, unknown>, isActive: boolean) => void;
  onAction: (type: string, action: string) => void;
  saving: boolean;
}) {
  const cfg = channel.config as Record<string, string | boolean>;
  const [isActive, setIsActive] = useState(channel.isActive);
  const [pythonCommand, setPythonCommand] = useState(String(cfg.pythonCommand || "python3"));
  const [scriptPath, setScriptPath] = useState(String(cfg.scriptPath || "zalo_bot.py"));
  const [cookiesInput, setCookiesInput] = useState(String(cfg.cookiesInput || ""));
  const [relaySecret, setRelaySecret] = useState("");
  const isConnected = channel.status === "connected";
  const hasCookiesInput = Boolean(cfg.hasCookiesInput);
  const hasRelaySecret = Boolean(cfg.hasRelaySecret);
  const readinessIssues = [
    !hasText(pythonCommand) ? "Thiếu Python command để chạy Zalo relay." : "",
    !hasText(scriptPath) ? "Thiếu đường dẫn script Zalo relay." : "",
    !hasSecret(hasCookiesInput, cookiesInput) ? "Thiếu cookies/session Zalo." : "",
  ].filter(Boolean);
  const readinessWarnings = [
    !hasSecret(hasRelaySecret, relaySecret)
      ? "Chưa có relay secret; endpoint incoming sẽ không xác thực header bí mật riêng cho relay này."
      : "",
  ].filter(Boolean);
  const saveDisabled = saving || (isActive && readinessIssues.length > 0);

  return (
    <div className="bg-owly-surface rounded-xl border border-owly-border overflow-hidden">
      <div className="px-5 py-4 border-b border-owly-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-cyan-50 text-cyan-600">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-owly-text">Zalo</h3>
              <p className="text-xs text-owly-text-light mt-0.5">
                Listener cho chatbot và gửi tin nhắn qua Zalo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={channel.status} />
            <Toggle enabled={isActive} onChange={setIsActive} />
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FieldInput
            label="Python Command"
            value={pythonCommand}
            onChange={setPythonCommand}
            placeholder="python3"
          />
          <FieldInput
            label="Script Path"
            value={scriptPath}
            onChange={setScriptPath}
            placeholder="zalo_bot.py"
          />
          <div>
            <FieldInput
              label="Relay secret"
              value={relaySecret}
              onChange={setRelaySecret}
              isSecret
            />
            <SecretHint shown={hasRelaySecret} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-owly-text-light mb-1">
            Cookies
          </label>
          <textarea
            value={cookiesInput}
            onChange={(e) => setCookiesInput(e.target.value)}
            rows={6}
            placeholder='{"cookies": {...}, "imei": "...", "userAgent": "..."}'
            className="w-full px-3 py-2 text-sm border border-owly-border rounded-lg bg-owly-bg text-owly-text placeholder:text-owly-text-light/50 focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary transition-colors resize-none"
          />
          <SecretHint shown={hasCookiesInput} />
        </div>

        {isConnected ? (
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-cyan-600" />
            <span className="text-sm text-cyan-700">
              Zalo listener đang chạy
            </span>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-owly-border bg-owly-bg/50 px-5 py-3">
        <ConfigReadiness
          issues={readinessIssues}
          warnings={readinessWarnings}
          isActive={isActive}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saveDisabled}
            onClick={() =>
              onSave(
                "zalo",
                { pythonCommand, scriptPath, cookiesInput, relaySecret },
                isActive
              )
            }
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-owly-primary rounded-lg hover:bg-owly-primary-dark disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lưu
          </button>
          <button
            type="button"
            disabled={!isConnected && readinessIssues.length > 0}
            onClick={() => onAction("zalo", isConnected ? "disconnect" : "connect")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50",
              isConnected
                ? "text-red-600 bg-red-50 border border-red-200 hover:bg-red-100"
                : "text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100"
            )}
          >
            {isConnected ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
            {isConnected ? "Ngắt kết nối" : "Kết nối"}
          </button>
          <button
            type="button"
            disabled={readinessIssues.length > 0}
            onClick={() => onAction("zalo", "test")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 disabled:opacity-50 transition-colors"
          >
            <TestTube className="h-4 w-4" />
            Kiểm tra
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountManagedChannelPanel({
  type,
  accounts,
}: {
  type: string;
  accounts: ChannelAccountData[];
}) {
  const channelAccounts = accounts.filter((account) => account.type === type);
  const activeCount = channelAccounts.filter((account) => account.isActive).length;
  const readyCount = channelAccounts.filter((account) => isChannelAccountReady(type, account.status)).length;
  const webhookPath = type === "tiktok_shop" ? "/api/webhooks/tiktok-shop" : isMarketplaceChannel(type) ? "/api/webhooks/shopee" : "/api/webhooks/meta";
  const platformName = getChannelLabel(type);

  return (
    <div className="rounded-xl border border-owly-border bg-owly-surface p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className={cn("rounded-lg p-2", getChannelAccent(type))}>
              <ChannelIcon type={type} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-owly-text">{platformName}</h3>
              <p className="text-sm text-owly-text-light">
                Kênh này dùng mô hình nhiều account. Token, secret và cấu hình gửi nhận được quản lý tại trang Tài khoản kết nối.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-owly-border bg-owly-bg/50 px-3 py-2 font-mono text-xs text-owly-text break-all">
            Webhook: {webhookPath}
          </div>
        </div>

        <Link
          href="/channels/accounts"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-owly-primary px-4 py-2 text-sm font-semibold text-white hover:bg-owly-primary-dark"
        >
          <Key className="h-4 w-4" />
          Quản lý tài khoản
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-owly-border bg-owly-bg/40 p-3">
          <p className="text-xs text-owly-text-light">Tổng account</p>
          <p className="mt-1 text-xl font-semibold text-owly-text">{channelAccounts.length}</p>
        </div>
        <div className="rounded-lg border border-owly-border bg-owly-bg/40 p-3">
          <p className="text-xs text-owly-text-light">Đang bật</p>
          <p className="mt-1 text-xl font-semibold text-owly-text">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-owly-border bg-owly-bg/40 p-3">
          <p className="text-xs text-owly-text-light">Sẵn sàng</p>
          <p className="mt-1 text-xl font-semibold text-owly-text">{readyCount}</p>
        </div>
      </div>

      {channelAccounts.length === 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Chưa có account nào cho {platformName}. Hãy thêm account trước, sau đó chạy kiểm tra kết nối và webhook.
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [accounts, setAccounts] = useState<ChannelAccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedChannelType, setSelectedChannelType] = useState(CHANNEL_PAGE_ORDER[0]);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/channels");
      const accountRes = await fetch("/api/channel-accounts");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (accountRes.ok) setAccounts(await accountRes.json());
      const [whatsappRes, zaloRes] = await Promise.all([
        fetch("/api/channels/whatsapp"),
        fetch("/api/channels/zalo"),
      ]);
      const whatsappLive = whatsappRes.ok ? await whatsappRes.json() : null;
      const zaloLive = zaloRes.ok ? await zaloRes.json() : null;

      setChannels(
        data.map((channel: ChannelData) =>
          channel.type === "whatsapp" && whatsappLive
            ? { ...channel, status: whatsappLive.status, qr: whatsappLive.qr }
            : channel.type === "zalo" && zaloLive
              ? { ...channel, status: zaloLive.status }
            : channel
        )
      );
    } catch {
      showToast("Failed to load channels", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Poll channel live status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [waRes, zaloRes] = await Promise.all([
          fetch("/api/channels/whatsapp"),
          fetch("/api/channels/zalo"),
        ]);

        if (waRes.ok) {
          const live = await waRes.json();
          setChannels(prev => {
            const wa = prev.find(ch => ch.type === "whatsapp");
            if (wa?.status === "connected" && live.status === "connected") return prev;
            return prev.map(ch => 
              ch.type === "whatsapp" 
                ? { ...ch, status: live.status, qr: live.qr }
                : ch
            );
          });
        }

        if (zaloRes.ok) {
          const live = await zaloRes.json();
          setChannels((prev) =>
            prev.map((ch) =>
              ch.type === "zalo" ? { ...ch, status: live.status } : ch
            )
          );
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async (
    type: string,
    config: Record<string, unknown>,
    isActive: boolean
  ) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/channels/${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, isActive }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setChannels((prev) =>
        prev.map((ch) => (ch.type === type ? updated : ch))
      );
      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} settings saved`);
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (type: string, action: string) => {
    try {
      const res = await fetch(`/api/channels/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }
      const data = await res.json();
      await fetchChannels();
      showToast(data.message || "Action completed");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Action failed",
        "error"
      );
    }
  };

  const getChannel = (type: string): ChannelData =>
    channels.find((ch) => ch.type === type) || {
      id: null,
      type,
      isActive: false,
      config: {},
      status: "disconnected",
    };

  const renderChannelCard = (type: string) => {
    if (isAccountManagedChannel(type)) {
      return (
        <AccountManagedChannelPanel
          key={type}
          type={type}
          accounts={accounts}
        />
      );
    }

    if (type === "whatsapp") {
      return (
        <WhatsAppCard
          key={type}
          channel={getChannel("whatsapp")}
          onSave={handleSave}
          onAction={handleAction}
          saving={saving}
        />
      );
    }

    if (type === "email") {
      return (
        <EmailCard
          key={type}
          channel={getChannel("email")}
          onSave={handleSave}
          onAction={handleAction}
          saving={saving}
        />
      );
    }

    if (type === "phone") {
      return (
        <PhoneCard
          key={type}
          channel={getChannel("phone")}
          onSave={handleSave}
          onAction={handleAction}
          saving={saving}
        />
      );
    }

    if (type === "zalo") {
      return (
        <ZaloCard
          key={type}
          channel={getChannel("zalo")}
          onSave={handleSave}
          onAction={handleAction}
          saving={saving}
        />
      );
    }

    return null;
  };

  return (
    <>
      <Header
        title="Kênh liên hệ"
        description="Theo dõi trạng thái kênh và cấu hình mặc định"
      />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-owly-primary" />
          </div>
        ) : (
          <div className="w-full max-w-screen-2xl space-y-6">
            <ChannelOverview
              channels={channels}
              accounts={accounts}
              selectedType={selectedChannelType}
              onSelect={setSelectedChannelType}
            />

            <section className="space-y-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold text-owly-text">
                  {isAccountManagedChannel(selectedChannelType)
                    ? `Tài khoản kết nối: ${getChannelLabel(selectedChannelType)}`
                    : `Cấu hình mặc định: ${getChannelLabel(selectedChannelType)}`}
                </h2>
                <p className="text-sm text-owly-text-light">
                  {isMarketplaceChannel(selectedChannelType)
                    ? "Marketplace được quản lý theo từng shop/account, không dùng cấu hình mặc định ở trang này."
                    : isAccountManagedChannel(selectedChannelType)
                      ? "Facebook và Instagram được quản lý theo từng Page/Business account tại trang Tài khoản kết nối."
                    : "Dùng cho trạng thái kênh và tương thích các luồng cấu hình cũ."}
                </p>
              </div>
              <div className="w-full max-w-5xl">
                {renderChannelCard(selectedChannelType)}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-in slide-in-from-bottom-4 duration-300",
            toast.type === "success"
              ? "bg-owly-success text-white"
              : "bg-owly-danger text-white"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {toast.message}
        </div>
      )}
    </>
  );
}
