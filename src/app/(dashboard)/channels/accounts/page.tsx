"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Plus,
  Save,
  TestTube,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";

interface ChannelAccountData {
  id: string;
  type: string;
  displayName: string;
  externalAccountId: string;
  isActive: boolean;
  isDefault: boolean;
  config: Record<string, unknown>;
  status: string;
}

type AccountFormState = {
  type: string;
  displayName: string;
  externalAccountId: string;
  verifyToken: string;
  accessToken: string;
  refreshToken: string;
  appSecret: string;
  graphVersion: string;
  oaId: string;
  cookiesInput: string;
  relaySecret: string;
  pythonCommand: string;
  scriptPath: string;
  partnerId: string;
  partnerKey: string;
  webhookSecret: string;
  apiBaseUrl: string;
  authBaseUrl: string;
  sendMessagePath: string;
  isDefault: boolean;
  isActive: boolean;
};

const ACCOUNT_TYPE_OPTIONS = ["facebook", "instagram", "zalo", "shopee", "tiktok_shop"];

function getChannelLabel(type: string): string {
  if (type === "facebook") return "Facebook";
  if (type === "instagram") return "Instagram";
  if (type === "zalo") return "Zalo";
  if (type === "shopee") return "Shopee";
  if (type === "tiktok_shop") return "TikTok Shop";
  return type;
}

function getAccountIdLabel(type: string) {
  if (type === "facebook") return "Page ID";
  if (type === "instagram") return "Business Account ID";
  if (type === "zalo") return "Account/OA ID";
  if (type === "shopee") return "Shop ID";
  if (type === "tiktok_shop") return "Shop/Seller ID";
  return "Account ID";
}

function getAccountConfigString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === "string" ? value : "";
}

function createEmptyAccountForm(type = "facebook"): AccountFormState {
  return {
    type,
    displayName: "",
    externalAccountId: "",
    verifyToken: "",
    accessToken: "",
    refreshToken: "",
    appSecret: "",
    graphVersion: "v25.0",
    oaId: "",
    cookiesInput: "",
    relaySecret: "",
    pythonCommand: "python3",
    scriptPath: "zalo_bot.py",
    partnerId: "",
    partnerKey: "",
    webhookSecret: "",
    apiBaseUrl: type === "tiktok_shop" ? "https://open-api.tiktokglobalshop.com" : "https://partner.shopeemobile.com",
    authBaseUrl: type === "tiktok_shop" ? "https://services.tiktokshop.com" : "https://partner.shopeemobile.com",
    sendMessagePath: type === "tiktok_shop" ? "" : "/api/v2/sellerchat/send_message",
    isDefault: false,
    isActive: true,
  };
}

function loadAccountForm(account: ChannelAccountData): AccountFormState {
  const config = account.config || {};
  return {
    ...createEmptyAccountForm(account.type),
    displayName: account.displayName || "",
    externalAccountId: account.externalAccountId || "",
    verifyToken: getAccountConfigString(config, "verifyToken"),
    oaId: getAccountConfigString(config, "oaId"),
    graphVersion: getAccountConfigString(config, "graphVersion") || "v25.0",
    pythonCommand: getAccountConfigString(config, "pythonCommand") || "python3",
    scriptPath: getAccountConfigString(config, "scriptPath") || "zalo_bot.py",
    partnerId: getAccountConfigString(config, "partnerId") || getAccountConfigString(config, "appKey") || getAccountConfigString(config, "clientKey"),
    apiBaseUrl: getAccountConfigString(config, "apiBaseUrl") || (account.type === "tiktok_shop" ? "https://open-api.tiktokglobalshop.com" : "https://partner.shopeemobile.com"),
    authBaseUrl: getAccountConfigString(config, "authBaseUrl") || (account.type === "tiktok_shop" ? "https://services.tiktokshop.com" : "https://partner.shopeemobile.com"),
    sendMessagePath: getAccountConfigString(config, "sendMessagePath") || (account.type === "tiktok_shop" ? "" : "/api/v2/sellerchat/send_message"),
    isDefault: account.isDefault,
    isActive: account.isActive,
  };
}

function buildAccountConfig(form: AccountFormState): Record<string, unknown> {
  const base = {
    displayName: form.displayName,
    externalAccountId: form.externalAccountId,
  };

  if (form.type === "facebook") {
    return {
      ...base,
      pageId: form.externalAccountId,
      verifyToken: form.verifyToken,
      pageAccessToken: form.accessToken,
      appSecret: form.appSecret,
      graphVersion: form.graphVersion || "v25.0",
    };
  }

  if (form.type === "instagram") {
    return {
      ...base,
      businessAccountId: form.externalAccountId,
      verifyToken: form.verifyToken,
      accessToken: form.accessToken,
      appSecret: form.appSecret,
      graphVersion: form.graphVersion || "v25.0",
    };
  }

  if (form.type === "zalo") {
    return {
      ...base,
      accountId: form.externalAccountId,
      cookiesInput: form.cookiesInput,
      relaySecret: form.relaySecret,
      pythonCommand: form.pythonCommand || "python3",
      scriptPath: form.scriptPath || "zalo_bot.py",
    };
  }

  if (form.type === "tiktok_shop") {
    return {
      ...base,
      shopId: form.externalAccountId,
      sellerId: form.externalAccountId,
      appKey: form.partnerId,
      clientKey: form.partnerId,
      accessToken: form.accessToken,
      refreshToken: form.refreshToken,
      appSecret: form.partnerKey,
      webhookSecret: form.webhookSecret,
      apiBaseUrl: form.apiBaseUrl || "https://open-api.tiktokglobalshop.com",
      authBaseUrl: form.authBaseUrl || "https://services.tiktokshop.com",
      sendMessagePath: form.sendMessagePath,
    };
  }

  return {
    ...base,
    shopId: form.externalAccountId,
    partnerId: form.partnerId,
    accessToken: form.accessToken,
    refreshToken: form.refreshToken,
    partnerKey: form.partnerKey,
    webhookSecret: form.webhookSecret,
    apiBaseUrl: form.apiBaseUrl || "https://partner.shopeemobile.com",
    authBaseUrl: form.authBaseUrl || "https://partner.shopeemobile.com",
    sendMessagePath: form.sendMessagePath || "/api/v2/sellerchat/send_message",
  };
}

const MARKETPLACE_AUTHORIZED_STATUSES = new Set([
  "authorized",
  "webhook_verified",
  "chat_receive_verified",
  "chat_send_verified",
  "production_ready",
]);

function getStatusView(status: string) {
  switch (status) {
    case "connected":
      return { label: "Đã kết nối", tone: "success" as const, description: "Trạng thái legacy cho kênh cũ." };
    case "config_saved":
      return { label: "Đã lưu cấu hình", tone: "neutral" as const, description: "Đã lưu shop/config, chưa bắt đầu hoặc chưa hoàn tất ủy quyền marketplace." };
    case "authorization_required":
      return { label: "Cần ủy quyền", tone: "warning" as const, description: "Cần mở trang ủy quyền marketplace để chủ shop approve Partner App." };
    case "authorized":
      return { label: "Đã ủy quyền", tone: "info" as const, description: "Đã lưu token/shop id. Chưa đồng nghĩa bot đã production-ready." };
    case "webhook_verified":
      return { label: "Đã xác minh webhook", tone: "info" as const, description: "Webhook hợp lệ đã tới app. Vẫn cần test chat receive/send thật." };
    case "chat_receive_verified":
      return { label: "Đã nhận chat test", tone: "info" as const, description: "Đã parse được chat buyer và đưa vào normalized inbound flow." };
    case "chat_send_verified":
      return { label: "Đã gửi chat test", tone: "success" as const, description: "Đã gửi reply qua send adapter trong test thật/mock." };
    case "production_ready":
      return { label: "Sẵn sàng production", tone: "success" as const, description: "Chỉ dùng sau khi đã qua đủ go-live gate: auth, webhook, receive, send, refresh token, dedupe, rate-limit." };
    case "error":
      return { label: "Có lỗi", tone: "danger" as const, description: "Cần kiểm tra cấu hình/webhook/token; không xem là đã kết nối." };
    default:
      return { label: "Chưa kết nối", tone: "danger" as const, description: "Chưa có kết nối hoặc chưa có trạng thái xác minh." };
  }
}

function StatusBadge({ status }: { status: string }) {
  const view = getStatusView(status);
  return (
    <span
      title={view.description}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        view.tone === "success" && "bg-owly-success/10 text-owly-success",
        view.tone === "info" && "bg-owly-primary-50 text-owly-primary",
        view.tone === "warning" && "bg-amber-50 text-amber-700",
        view.tone === "danger" && "bg-owly-danger/10 text-owly-danger",
        view.tone === "neutral" && "bg-owly-bg text-owly-text-light"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          view.tone === "success" && "bg-owly-success",
          view.tone === "info" && "bg-owly-primary",
          view.tone === "warning" && "bg-amber-500",
          view.tone === "danger" && "bg-owly-danger",
          view.tone === "neutral" && "bg-owly-text-light"
        )}
      />
      {view.label}
    </span>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  isSecret = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isSecret?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-owly-text-light">{label}</label>
      <div className="relative">
        <input
          type={isSecret && !visible ? "password" : "text"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-owly-border bg-owly-bg px-3 py-2 text-sm text-owly-text placeholder:text-owly-text-light/50 focus:border-owly-primary focus:outline-none focus:ring-2 focus:ring-owly-primary/30"
        />
        {isSecret ? (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-owly-text-light hover:text-owly-text"
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SecretHint({ shown }: { shown: boolean }) {
  if (!shown) return null;
  return <p className="mt-1 text-[11px] text-owly-text-light">Để trống để giữ secret hiện có.</p>;
}


function AccountReadinessPanel({ issues, warnings }: { issues: string[]; warnings: string[] }) {
  if (issues.length === 0 && warnings.length === 0) {
    return (
      <div className="rounded-lg border border-owly-success/20 bg-owly-success/10 p-3 text-xs text-owly-success">
        Đủ cấu hình cơ bản để lưu và kiểm tra bước hiện tại.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      {issues.length ? (
        <div>
          <p className="font-semibold">Cần bổ sung trước khi kiểm tra:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {warnings.length ? (
        <div>
          <p className="font-semibold">Lưu ý trước go-live:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function getMarketplaceReadiness(form: AccountFormState, config: Record<string, unknown>, isEditing: boolean) {
  const hasStoredAccessToken = isEditing && Boolean(config.hasAccessToken);
  const hasStoredRefreshToken = isEditing && Boolean(config.hasRefreshToken);
  const hasStoredShopeePartnerKey = isEditing && Boolean(config.hasPartnerKey);
  const hasStoredTikTokAppSecret = isEditing && Boolean(config.hasAppSecret);
  const hasStoredWebhookSecret = isEditing && Boolean(config.hasWebhookSecret);
  const hasSecretValue = (value: string, stored: boolean) => value.trim().length > 0 || stored;
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!form.externalAccountId.trim()) {
    issues.push(form.type === "tiktok_shop" ? "Thiếu Shop/Seller ID." : "Thiếu Shop ID.");
  }
  if (!form.partnerId.trim()) {
    issues.push(form.type === "tiktok_shop" ? "Thiếu App/Client key." : "Thiếu Partner ID.");
  }
  if (!hasSecretValue(form.partnerKey, form.type === "tiktok_shop" ? hasStoredTikTokAppSecret : hasStoredShopeePartnerKey)) {
    issues.push(form.type === "tiktok_shop" ? "Thiếu App secret." : "Thiếu Partner key.");
  }

  if (!hasSecretValue(form.accessToken, hasStoredAccessToken)) {
    warnings.push("Chưa có access token; chỉ lưu cấu hình, chưa thể xem là đã ủy quyền đầy đủ.");
  }
  if (!hasSecretValue(form.refreshToken, hasStoredRefreshToken)) {
    warnings.push("Chưa có refresh token; chưa thể kiểm tra vòng đời token.");
  }
  if (!hasSecretValue(form.webhookSecret, hasStoredWebhookSecret)) {
    warnings.push("Webhook secret chưa có; nên bật trước production để xác minh request đến từ nền tảng.");
  }
  if (form.type === "tiktok_shop" && !form.sendMessagePath.trim()) {
    warnings.push("Send message path chưa cấu hình; outbound reply TikTok Shop đang bị giữ ở trạng thái cần xác minh Partner Center.");
  }

  return { issues, warnings };
}function MarketplaceDebugSummary({ type, config }: { type: string; config: Record<string, unknown> }) {
  const parseStatus = getAccountConfigString(config, "lastWebhookParseStatus");
  const lastWebhookAt = getAccountConfigString(config, "lastWebhookAt");
  if (!parseStatus && !lastWebhookAt) return null;

  const payloadKeys = Array.isArray(config.lastWebhookPayloadKeys)
    ? config.lastWebhookPayloadKeys.filter((value): value is string => typeof value === "string")
    : [];

  return (
    <div className="mt-3 rounded-lg border border-owly-border bg-owly-bg p-3 text-[11px] text-owly-text-light">
      <p className="font-medium text-owly-text">{getChannelLabel(type)} webhook debug an toàn</p>
      <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        <span>Parse: {parseStatus || "--"}</span>
        <span>Event: {getAccountConfigString(config, "lastWebhookEventType") || "--"}</span>
        <span>Webhook: {lastWebhookAt || "--"}</span>
        <span>Receive: {getAccountConfigString(config, "lastChatReceiveAt") || "--"}</span>
        <span>Send: {getAccountConfigString(config, "lastChatSendAt") || "--"}</span>
        <span>Message ID: {getAccountConfigString(config, "lastWebhookMessageId") || "--"}</span>
        <span>Conversation ID: {getAccountConfigString(config, "lastWebhookConversationId") || "--"}</span>
        <span>Buyer ID: {config.lastWebhookBuyerIdPresent === true ? "có" : "chưa thấy"}</span>
        <span>Text: {config.lastWebhookTextPresent === true ? "có" : "chưa thấy"}</span>
        <span>Idempotency: {getAccountConfigString(config, type === "tiktok_shop" ? "lastTikTokShopIdempotencyKey" : "lastShopeeIdempotencyKey") || "--"}</span>
      </div>
      {payloadKeys.length ? <p className="mt-2 break-words">Payload keys: {payloadKeys.join(", ")}</p> : null}
      {getAccountConfigString(config, "lastWebhookError") ? (
        <p className="mt-2 text-owly-danger">Lỗi gần nhất: {getAccountConfigString(config, "lastWebhookError")}</p>
      ) : null}
    </div>
  );
}

export default function ChannelAccountsPage() {
  const [accounts, setAccounts] = useState<ChannelAccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormState>(() => createEmptyAccountForm());
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/channel-accounts");
      if (!response.ok) throw new Error("Không tải được tài khoản kết nối");
      setAccounts(await response.json());
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không tải được tài khoản kết nối", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const resetForm = (nextType = form.type) => {
    setEditingId(null);
    setForm(createEmptyAccountForm(nextType));
    setFormOpen(false);
  };

  const updateForm = <K extends keyof AccountFormState>(key: K, value: AccountFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const startAdd = () => {
    setEditingId(null);
    setForm(createEmptyAccountForm(form.type));
    setFormOpen(true);
  };

  const startEdit = (account: ChannelAccountData) => {
    setEditingId(account.id);
    setForm(loadAccountForm(account));
    setFormOpen(true);
  };

  const handleSave = async () => {
    const externalAccountId = form.externalAccountId.trim();
    if (!externalAccountId) return;

    const displayName = form.displayName.trim() || externalAccountId;
    const payload = {
      type: form.type,
      displayName,
      externalAccountId,
      isActive: form.isActive,
      isDefault: form.isDefault || (!editingId && accounts.every((account) => account.type !== form.type)),
      config: buildAccountConfig({ ...form, displayName, externalAccountId }),
    };

    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/channel-accounts/${editingId}` : "/api/channel-accounts", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Không lưu được tài khoản");
      }
      const account = await response.json();
      setAccounts((current) =>
        editingId
          ? current.map((item) => (item.id === account.id ? account : item))
          : [account, ...current.filter((item) => item.id !== account.id)]
      );
      showToast(editingId ? "Đã cập nhật tài khoản" : "Đã thêm tài khoản");
      resetForm(form.type);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không lưu được tài khoản", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      const response = await fetch(`/api/channel-accounts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Không xử lý được tài khoản");
      }
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      await fetchAccounts();
      showToast(data.message || "Đã cập nhật trạng thái tài khoản");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không xử lý được tài khoản", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/channel-accounts/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Không xóa được tài khoản");
      setAccounts((current) => current.filter((account) => account.id !== id));
      showToast("Đã xóa tài khoản");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không xóa được tài khoản", "error");
    }
  };

  const selectedAccount = editingId ? accounts.find((account) => account.id === editingId) : null;
  const selectedConfig = selectedAccount?.config || {};
  const isEditing = Boolean(editingId);
  const hasAccessToken = Boolean(selectedConfig.hasPageAccessToken || selectedConfig.hasAccessToken);
  const hasAppSecret = Boolean(selectedConfig.hasAppSecret);
  const hasCookiesInput = Boolean(selectedConfig.hasCookiesInput);
  const hasRelaySecret = Boolean(selectedConfig.hasRelaySecret);
  const hasMarketplaceAccessToken = Boolean(selectedConfig.hasAccessToken);
  const hasMarketplaceRefreshToken = Boolean(selectedConfig.hasRefreshToken);
  const hasMarketplacePartnerKey = Boolean(selectedConfig.hasPartnerKey || selectedConfig.hasAppSecret);
  const marketplaceReadiness = getMarketplaceReadiness(form, selectedConfig, isEditing);

  return (
    <>
      <Header title="Tài khoản kết nối" description="Quản lý nhiều Facebook Page, Instagram, Zalo account, Shopee shop và TikTok Shop" />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-owly-primary" />
          </div>
        ) : (
          <div className="max-w-7xl space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Link
                href="/channels"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-owly-text-light hover:text-owly-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại kênh liên hệ
              </Link>
              <button
                type="button"
                onClick={startAdd}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-owly-primary px-4 py-2 text-sm font-medium text-white hover:bg-owly-primary-dark"
              >
                <Plus className="h-4 w-4" />
                Thêm tài khoản
              </button>
            </div>

            {formOpen ? (
              <section className="rounded-xl border border-owly-border bg-owly-surface p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-owly-text">
                      {isEditing ? "Cập nhật tài khoản" : "Thêm tài khoản"}
                    </h2>
                    <p className="mt-1 text-sm text-owly-text-light">
                      Chỉ nhập secret mới khi cần thay đổi. Để trống để giữ secret cũ.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="text-sm font-medium text-owly-text-light hover:text-owly-primary"
                  >
                    Đóng
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-owly-text-light">Kênh</label>
                      <select
                        value={form.type}
                        disabled={isEditing}
                        onChange={(event) => setForm(createEmptyAccountForm(event.target.value))}
                        className="w-full rounded-lg border border-owly-border bg-owly-bg px-3 py-2 text-sm text-owly-text focus:outline-none focus:ring-2 focus:ring-owly-primary/30 disabled:opacity-60"
                      >
                        {ACCOUNT_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {getChannelLabel(option)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <FieldInput label="Tên hiển thị" value={form.displayName} onChange={(value) => updateForm("displayName", value)} placeholder="LED1000 HCM" />
                    <FieldInput label={getAccountIdLabel(form.type)} value={form.externalAccountId} onChange={(value) => updateForm("externalAccountId", value)} placeholder="ID tài khoản" />
                    {(form.type === "facebook" || form.type === "instagram") ? (
                      <FieldInput label="Verify token" value={form.verifyToken} onChange={(value) => updateForm("verifyToken", value)} isSecret />
                    ) : null}
                  </div>

                  {(form.type === "facebook" || form.type === "instagram") ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <FieldInput label={form.type === "facebook" ? "Page access token" : "Access token"} value={form.accessToken} onChange={(value) => updateForm("accessToken", value)} isSecret />
                        <SecretHint shown={isEditing && hasAccessToken} />
                      </div>
                      <div>
                        <FieldInput label="App secret" value={form.appSecret} onChange={(value) => updateForm("appSecret", value)} isSecret />
                        <SecretHint shown={isEditing && hasAppSecret} />
                      </div>
                      <FieldInput label="Graph version" value={form.graphVersion} onChange={(value) => updateForm("graphVersion", value)} placeholder="v25.0" />
                    </div>
                  ) : null}

                  {form.type === "zalo" ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <FieldInput label="Cookies" value={form.cookiesInput} onChange={(value) => updateForm("cookiesInput", value)} isSecret />
                        <SecretHint shown={isEditing && hasCookiesInput} />
                      </div>
                      <div>
                        <FieldInput label="Relay secret" value={form.relaySecret} onChange={(value) => updateForm("relaySecret", value)} isSecret />
                        <SecretHint shown={isEditing && hasRelaySecret} />
                      </div>
                      <FieldInput label="Python command" value={form.pythonCommand} onChange={(value) => updateForm("pythonCommand", value)} placeholder="python3" />
                      <FieldInput label="Script path" value={form.scriptPath} onChange={(value) => updateForm("scriptPath", value)} placeholder="zalo_bot.py" />
                    </div>
                  ) : null}

                  {(form.type === "shopee" || form.type === "tiktok_shop") ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <FieldInput label={form.type === "tiktok_shop" ? "App/Client key" : "Partner ID"} value={form.partnerId} onChange={(value) => updateForm("partnerId", value)} />
                        <div>
                          <FieldInput label="Access token" value={form.accessToken} onChange={(value) => updateForm("accessToken", value)} isSecret />
                          <SecretHint shown={isEditing && hasMarketplaceAccessToken} />
                        </div>
                        <div>
                          <FieldInput label="Refresh token" value={form.refreshToken} onChange={(value) => updateForm("refreshToken", value)} isSecret />
                          <SecretHint shown={isEditing && hasMarketplaceRefreshToken} />
                        </div>
                        <div>
                          <FieldInput label={form.type === "tiktok_shop" ? "App secret" : "Partner key"} value={form.partnerKey} onChange={(value) => updateForm("partnerKey", value)} isSecret />
                          <SecretHint shown={isEditing && hasMarketplacePartnerKey} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <FieldInput label="Webhook secret" value={form.webhookSecret} onChange={(value) => updateForm("webhookSecret", value)} isSecret />
                        <FieldInput label="API base URL" value={form.apiBaseUrl} onChange={(value) => updateForm("apiBaseUrl", value)} />
                        <FieldInput label="Auth base URL" value={form.authBaseUrl} onChange={(value) => updateForm("authBaseUrl", value)} />
                        <FieldInput label="Send message path" value={form.sendMessagePath} onChange={(value) => updateForm("sendMessagePath", value)} />
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        {form.type === "tiktok_shop" ? "Dùng TikTok Shop Seller hợp lệ đã do khách sở hữu/quản trị. App hiện lưu cấu hình và nhận webhook test qua normalized flow; URL ủy quyền, scope Customer Service API và send adapter cần xác minh trong TikTok Shop Partner Center trước khi production." : "Dùng shop Shopee Seller hợp lệ đã do khách sở hữu/quản trị. Nếu Shopee yêu cầu xác minh người bán, thuế hoặc thông tin doanh nghiệp thì phải hoàn tất bên ngoài hệ thống này; app không tạo shop và không bỏ qua bước xác minh. Sau khi lưu Partner ID và Partner key, bấm Ủy quyền shop để chủ shop cấp quyền. Trạng thái Đã ủy quyền chưa có nghĩa là webhook/gửi chat đã sẵn sàng production."}
                      </div>
                      <AccountReadinessPanel issues={marketplaceReadiness.issues} warnings={marketplaceReadiness.warnings} />
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-owly-border pt-4">
                    <div className="flex flex-wrap items-center gap-4 text-sm text-owly-text-light">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm("isActive", event.target.checked)} />
                        Đang hoạt động
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={form.isDefault} onChange={(event) => updateForm("isDefault", event.target.checked)} />
                        Đặt làm mặc định cho kênh
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={saving || !form.externalAccountId.trim()}
                      onClick={handleSave}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-owly-primary px-4 py-2 text-sm font-medium text-white hover:bg-owly-primary-dark disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {isEditing ? "Lưu thay đổi" : "Thêm tài khoản"}
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {accounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-owly-border bg-owly-surface p-6 text-sm text-owly-text-light">
                  Chưa có tài khoản kết nối riêng.
                </div>
              ) : (
                accounts.map((account) => (
                  <div key={account.id} className="rounded-xl border border-owly-border bg-owly-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-owly-text">{account.displayName || account.externalAccountId}</p>
                          {account.isDefault ? <span className="rounded bg-owly-primary-50 px-1.5 py-0.5 text-[11px] text-owly-primary">mặc định</span> : null}
                          {!account.isActive ? <span className="rounded bg-owly-danger/10 px-1.5 py-0.5 text-[11px] text-owly-danger">tắt</span> : null}
                        </div>
                        <p className="mt-1 text-xs text-owly-text-light">
                          {getChannelLabel(account.type)} • {account.externalAccountId}
                        </p>
                        <div className="mt-3">
                          <StatusBadge status={account.status} />
                        </div>
                        {(account.type === "shopee" || account.type === "tiktok_shop") ? <MarketplaceDebugSummary type={account.type} config={account.config || {}} /> : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => startEdit(account)} className="rounded-lg border border-owly-border p-2 text-owly-text-light hover:bg-owly-primary-50 hover:text-owly-primary" title="Sửa">
                          <Key className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleAction(account.id, "test")} className="rounded-lg border border-owly-border p-2 text-owly-text-light hover:bg-owly-primary-50 hover:text-owly-primary" title="Kiểm tra">
                          <TestTube className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const isAuthorizedMarketplace = (account.type === "shopee" || account.type === "tiktok_shop") && MARKETPLACE_AUTHORIZED_STATUSES.has(account.status);
                            handleAction(account.id, account.status === "connected" || isAuthorizedMarketplace ? "disconnect" : "connect");
                          }}
                          className="rounded-lg border border-owly-border p-2 text-owly-text-light hover:bg-owly-primary-50 hover:text-owly-primary"
                          title={
                            account.status === "connected" || ((account.type === "shopee" || account.type === "tiktok_shop") && MARKETPLACE_AUTHORIZED_STATUSES.has(account.status))
                              ? "Ngắt kết nối"
                              : (account.type === "shopee" || account.type === "tiktok_shop")
                                ? "Ủy quyền shop"
                                : "Kết nối"
                          }
                        >
                          {account.status === "connected" || ((account.type === "shopee" || account.type === "tiktok_shop") && MARKETPLACE_AUTHORIZED_STATUSES.has(account.status)) ? (
                            <WifiOff className="h-4 w-4" />
                          ) : (
                            <Wifi className="h-4 w-4" />
                          )}
                        </button>
                        <button type="button" onClick={() => handleDelete(account.id)} className="rounded-lg border border-owly-border p-2 text-owly-danger hover:bg-owly-danger/10" title="Xóa">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>

      {toast ? (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg",
            toast.type === "success" ? "bg-owly-success" : "bg-owly-danger"
          )}
        >
          {toast.type === "success" ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      ) : null}
    </>
  );
}

