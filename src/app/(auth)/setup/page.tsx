"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AI_PROVIDER_OPTIONS,
  DEFAULT_GEMINI_MODEL,
  GEMINI_PROVIDER,
} from "@/lib/ai/catalog";
import {
  Bot,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  MessageCircleMore,
  ShieldAlert,
  UserRound,
} from "lucide-react";

const STEPS = [
  "Tài khoản quản trị",
  "Hồ sơ salon",
  "Luồng CSKH",
  "Cấu hình AI",
  "Hoàn tất",
];

const TONE_OPTIONS = [
  { value: "friendly", label: "Thân thiện", desc: "Nhẹ nhàng, dễ gần và dễ chốt lịch" },
  { value: "professional", label: "Chuyên nghiệp", desc: "Rõ ràng, lịch sự và chỉn chu" },
  { value: "formal", label: "Trang trọng", desc: "Nghiêm túc hơn cho thương hiệu cao cấp" },
  { value: "technical", label: "Giải thích kỹ", desc: "Phù hợp tư vấn nhiều nghiệp vụ, kỹ thuật" },
] as const;

const PROVIDER_OPTIONS = AI_PROVIDER_OPTIONS;

const TRAINING_FORMATS = [
  { label: "PDF", icon: FileText },
  { label: "DOC / DOCX", icon: FileText },
  { label: "XLS / XLSX", icon: FileSpreadsheet },
];

const BOT_RESPONSIBILITIES = [
  "Trả lời câu hỏi phổ biến về dịch vụ, giá khoảng và quy trình làm tóc.",
  "Tư vấn ban đầu, hỏi thêm thông tin còn thiếu và gợi ý lịch hẹn.",
  "Dùng dữ liệu từ bảng giá, FAQ, quy trình và chính sách để trả lời nhất quán.",
];

const HUMAN_HANDOFF_CASES = [
  "Khách yêu cầu tư vấn quá sâu hoặc tình huống không có đủ dữ liệu.",
  "Các ca complain, khiếu nại, hoàn tiền, bảo hành hoặc phản hồi tiêu cực.",
  "Các trường hợp cần người thật chốt phương án cuối cùng hoặc trấn an khách.",
];

const CHAT_PREVIEW = [
  { role: "customer", time: "20:52", content: "mình có đưa data training cho nó được không" },
  { role: "customer", time: "21:07", content: "phải là file pdf, doc, excel á" },
  {
    role: "assistant",
    time: "21:08",
    content:
      "Dạ được chị nhé. Mình có thể chuẩn hóa nội dung từ file PDF, Word, Excel để làm nguồn tri thức cho bot tư vấn khách hàng. Những ca khó hoặc các trường hợp complain thì hệ thống sẽ ưu tiên chuyển nhân viên hỗ trợ xử lý.",
  },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  // Step 1 - Admin account
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2 - Business profile
  const [businessName, setBusinessName] = useState("");
  const [businessDesc, setBusinessDesc] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState(
    "Xin chào! Chào mừng bạn đến với Luna Women's Hair Studio. Bạn cần tư vấn bảng giá, tình trạng tóc hay đặt lịch làm tóc?"
  );
  const [tone, setTone] = useState<(typeof TONE_OPTIONS)[number]["value"]>("friendly");

  // Step 4 - AI configuration
  const [aiProvider, setAiProvider] = useState(GEMINI_PROVIDER);
  const [aiModel, setAiModel] = useState(DEFAULT_GEMINI_MODEL);
  const [aiApiKey, setAiApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  // Summary
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch("/api/auth");
        const data = await res.json();
        if (!data.setupRequired) {
          router.replace("/login");
          return;
        }
      } catch {
        // Allow setup page to render
      }
      setChecking(false);
    }

    checkSetup();
  }, [router]);

  function currentModels() {
    return PROVIDER_OPTIONS.find((provider) => provider.value === aiProvider)?.models || [];
  }

  async function handleNext() {
    setError("");
    setLoading(true);

    try {
      if (step === 0) {
        if (!name.trim() || !username.trim() || !password) {
          setError("Vui lòng nhập đầy đủ các trường bắt buộc.");
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError("Mật khẩu phải có ít nhất 6 ký tự.");
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError("Mật khẩu xác nhận không khớp.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "setup", name, username, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Thiết lập thất bại.");
          setLoading(false);
          return;
        }

        setCompletedSteps((prev) => [...new Set([...prev, 0])]);
        setStep(1);
      } else if (step === 1) {
        const body: Record<string, string> = { tone };

        if (businessName.trim()) body.businessName = businessName.trim();
        if (businessDesc.trim()) body.businessDesc = businessDesc.trim();
        if (welcomeMessage.trim()) body.welcomeMessage = welcomeMessage.trim();

        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Không thể lưu hồ sơ salon.");
          setLoading(false);
          return;
        }

        setCompletedSteps((prev) => [...new Set([...prev, 1])]);
        setStep(2);
      } else if (step === 2) {
        setCompletedSteps((prev) => [...new Set([...prev, 2])]);
        setStep(3);
      } else if (step === 3) {
        const body: Record<string, string> = {
          aiProvider,
          aiModel,
        };

        if (aiApiKey.trim()) body.aiApiKey = aiApiKey.trim();

        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Không thể lưu cấu hình AI.");
          setLoading(false);
          return;
        }

        setCompletedSteps((prev) => [...new Set([...prev, 3])]);
        setStep(4);
      }
    } catch {
      setError("Đã xảy ra lỗi ngoài dự kiến. Vui lòng thử lại.");
    }

    setLoading(false);
  }

  function handleBack() {
    setError("");
    setStep((currentStep) => Math.max(0, currentStep - 1));
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-owly-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-owly-border bg-owly-surface shadow-lg">
      <div className="border-b border-owly-border bg-owly-primary-50 px-8 pb-4 pt-6">
        <div className="mb-5 flex items-center gap-3">
          <Image src="/salondesk-logo.svg" alt="SalonDesk" width={40} height={40} />
          <div>
            <h1 className="text-lg font-bold text-owly-text">Thiết lập SalonDesk</h1>
            <p className="text-xs text-owly-text-light">
              Bước {step + 1} / {STEPS.length}
            </p>
          </div>
        </div>

        <div className="flex gap-1.5">
          {STEPS.map((_, index) => (
            <div
              key={index}
              className="h-1.5 flex-1 rounded-full transition-colors duration-300"
              style={{
                backgroundColor:
                  index <= step ? "var(--owly-primary)" : "var(--owly-border)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="px-8 py-6">
        <h2 className="mb-1 text-xl font-bold text-owly-text">{STEPS[step]}</h2>

        {step === 0 && (
          <>
            <p className="mb-6 text-sm text-owly-text-light">
              Tạo tài khoản quản trị để bắt đầu cấu hình hệ thống CSKH.
            </p>

            <div className="space-y-4">
              <Field
                id="name"
                label="Họ và tên"
                value={name}
                onChange={setName}
                placeholder="Nhập họ và tên"
                autoComplete="name"
              />
              <Field
                id="username"
                label="Tên đăng nhập"
                value={username}
                onChange={setUsername}
                placeholder="Chọn tên đăng nhập"
                autoComplete="username"
              />
              <Field
                id="password"
                label="Mật khẩu"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Ít nhất 6 ký tự"
                autoComplete="new-password"
              />
              <Field
                id="confirmPassword"
                label="Xác nhận mật khẩu"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Nhập lại mật khẩu"
                autoComplete="new-password"
              />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="mb-6 text-sm text-owly-text-light">
              Cung cấp thông tin salon để AI giữ đúng giọng điệu và ngữ cảnh khi tư vấn.
            </p>

            <div className="space-y-4">
              <Field
                id="businessName"
                label="Tên salon"
                value={businessName}
                onChange={setBusinessName}
                placeholder="Ví dụ: Luna Women's Hair Studio"
              />

              <div>
                <label
                  htmlFor="businessDesc"
                  className="mb-1.5 block text-sm font-medium text-owly-text"
                >
                  Mô tả doanh nghiệp
                </label>
                <textarea
                  id="businessDesc"
                  rows={3}
                  value={businessDesc}
                  onChange={(event) => setBusinessDesc(event.target.value)}
                  placeholder="Mô tả ngắn về dịch vụ, phong cách và nhóm khách hàng bạn phục vụ"
                  className="w-full resize-none rounded-lg border border-owly-border bg-owly-bg px-3.5 py-2.5 text-sm text-owly-text placeholder:text-owly-text-light transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-owly-primary"
                />
              </div>

              <Field
                id="welcomeMessage"
                label="Lời chào mở đầu"
                value={welcomeMessage}
                onChange={setWelcomeMessage}
                placeholder="Tin nhắn đầu tiên khách hàng sẽ nhìn thấy"
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-owly-text">
                  Tông giọng trả lời
                </label>
                <div className="grid gap-2 md:grid-cols-2">
                  {TONE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTone(option.value)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        tone === option.value
                          ? "border-owly-primary bg-owly-primary-50 ring-1 ring-owly-primary"
                          : "border-owly-border bg-owly-bg hover:border-owly-primary-light"
                      }`}
                    >
                      <div className="text-sm font-medium text-owly-text">{option.label}</div>
                      <div className="text-xs text-owly-text-light">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <p className="text-sm text-owly-text-light">
              Đây là kịch bản vận hành bot theo đúng nhu cầu của bạn: có nguồn dữ liệu để bot
              tư vấn khách hàng, nhưng các ca khó và complain vẫn chuyển cho nhân viên.
            </p>

            <div className="grid gap-4 xl:grid-cols-3">
              <InfoCard
                icon={Bot}
                title="Bot xử lý trước"
                description="Bot tiếp nhận các câu hỏi lặp lại và tư vấn cơ bản trước khi cần người thật."
              >
                {BOT_RESPONSIBILITIES.map((item) => (
                  <FeatureRow key={item} text={item} />
                ))}
              </InfoCard>

              <InfoCard
                icon={FileText}
                title="Nguồn dữ liệu training"
                description="Nội dung tư vấn có thể được chuẩn hóa từ các tài liệu nghiệp vụ và bảng giá."
              >
                <div className="flex flex-wrap gap-2">
                  {TRAINING_FORMATS.map((format) => {
                    const Icon = format.icon;
                    return (
                      <span
                        key={format.label}
                        className="inline-flex items-center gap-2 rounded-full border border-owly-border bg-owly-bg px-3 py-1.5 text-xs font-medium text-owly-text"
                      >
                        <Icon className="h-3.5 w-3.5 text-owly-primary" />
                        {format.label}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs leading-5 text-owly-text-light">
                  Phù hợp để gom FAQ, bảng giá, quy trình, chính sách bảo hành và nội dung tư
                  vấn chuẩn cho bot.
                </p>
              </InfoCard>

              <InfoCard
                icon={ShieldAlert}
                title="Chuyển người thật"
                description="Những tình huống cần xử lý khéo hoặc có rủi ro sẽ không để bot tự chốt."
              >
                {HUMAN_HANDOFF_CASES.map((item) => (
                  <FeatureRow key={item} text={item} />
                ))}
              </InfoCard>
            </div>

            <div className="rounded-2xl border border-owly-border bg-owly-bg p-5">
              <div className="mb-4 flex items-center gap-2">
                <MessageCircleMore className="h-4 w-4 text-owly-primary" />
                <h3 className="text-sm font-semibold text-owly-text">Preview hội thoại</h3>
              </div>

              <div className="space-y-3">
                {CHAT_PREVIEW.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${
                      message.role === "assistant" ? "justify-start" : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-xl rounded-2xl px-4 py-3 shadow-sm ${
                        message.role === "assistant"
                          ? "border border-owly-border bg-white text-owly-text"
                          : "bg-[#f5f7fb] text-owly-text"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        {message.role === "assistant" ? (
                          <Bot className="h-4 w-4 text-owly-primary" />
                        ) : (
                          <UserRound className="h-4 w-4 text-owly-text-light" />
                        )}
                        <span className="text-[11px] font-medium uppercase tracking-wide text-owly-text-light">
                          {message.role === "assistant" ? "Bot" : "Khách"}
                        </span>
                      </div>
                      <p className="text-sm leading-6">{message.content}</p>
                      <p className="mt-2 text-[11px] text-owly-text-light">{message.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <>
            <p className="mb-6 text-sm text-owly-text-light">
              Chọn model AI dùng để trả lời khách hàng và kết hợp với luồng chuyển người thật ở
              bước trước.
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="aiProvider"
                  className="mb-1.5 block text-sm font-medium text-owly-text"
                >
                  Nhà cung cấp AI
                </label>
                <select
                  id="aiProvider"
                  value={aiProvider}
                  onChange={(event) => {
                    const provider = event.target.value;
                    const models =
                      PROVIDER_OPTIONS.find((option) => option.value === provider)?.models || [];

                    setAiProvider(provider);
                    setAiModel(models[0] || "");
                  }}
                  className="w-full rounded-lg border border-owly-border bg-owly-bg px-3.5 py-2.5 text-sm text-owly-text transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-owly-primary"
                >
                  {PROVIDER_OPTIONS.map((provider) => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="aiModel"
                  className="mb-1.5 block text-sm font-medium text-owly-text"
                >
                  Mô hình
                </label>
                <select
                  id="aiModel"
                  value={aiModel}
                  onChange={(event) => setAiModel(event.target.value)}
                  className="w-full rounded-lg border border-owly-border bg-owly-bg px-3.5 py-2.5 text-sm text-owly-text transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-owly-primary"
                >
                  {currentModels().map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="aiApiKey"
                  className="mb-1.5 block text-sm font-medium text-owly-text"
                >
                  API key
                </label>
                <div className="relative">
                  <input
                    id="aiApiKey"
                    type={showApiKey ? "text" : "password"}
                    value={aiApiKey}
                    onChange={(event) => setAiApiKey(event.target.value)}
                    placeholder="Nhập API key"
                    className="w-full rounded-lg border border-owly-border bg-owly-bg px-3.5 py-2.5 pr-16 text-sm text-owly-text placeholder:text-owly-text-light transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-owly-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((visible) => !visible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-owly-primary transition-colors hover:bg-owly-primary-50"
                  >
                    {showApiKey ? "Ẩn" : "Hiện"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <p className="mb-6 text-sm text-owly-text-light">
              Không gian làm việc SalonDesk của bạn đã sẵn sàng để bắt đầu vận hành.
            </p>

            <div className="mb-6 space-y-3">
              <SummaryRow
                done={completedSteps.includes(0)}
                label="Đã tạo tài khoản quản trị"
                detail={username || "Chưa có dữ liệu"}
              />
              <SummaryRow
                done={completedSteps.includes(1)}
                label="Đã cấu hình hồ sơ salon"
                detail={businessName || "Dùng cấu hình mặc định"}
              />
              <SummaryRow
                done={completedSteps.includes(2)}
                label="Đã xác nhận luồng CSKH"
                detail="Bot tư vấn case phổ biến, case khó và complain chuyển người thật"
              />
              <SummaryRow
                done={completedSteps.includes(3)}
                label="Đã cấu hình nhà cung cấp AI"
                detail={`${PROVIDER_OPTIONS.find((provider) => provider.value === aiProvider)?.label || aiProvider} / ${aiModel}`}
              />
            </div>
          </>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-owly-danger">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-owly-border px-8 py-4">
        {step > 0 && step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleBack}
            disabled={loading}
            className="rounded-lg border border-owly-border bg-white px-4 py-2 text-sm font-medium text-owly-text transition-colors hover:bg-owly-bg disabled:opacity-60"
          >
            Quay lại
          </button>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={loading}
            className="rounded-lg bg-owly-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-owly-primary-dark focus:outline-none focus:ring-2 focus:ring-owly-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Đang lưu...
              </span>
            ) : step === STEPS.length - 2 ? (
              "Hoàn tất thiết lập"
            ) : (
              "Tiếp theo"
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="rounded-lg bg-owly-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-owly-primary-dark focus:outline-none focus:ring-2 focus:ring-owly-primary focus:ring-offset-2"
          >
            Vào trang tổng quan
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-owly-text">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-owly-border bg-owly-bg px-3.5 py-2.5 text-sm text-owly-text placeholder:text-owly-text-light transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-owly-primary"
      />
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-owly-border bg-white p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-owly-primary-50 p-2 text-owly-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-owly-text">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-owly-text-light">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FeatureRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-owly-primary" />
      <p className="text-sm leading-6 text-owly-text">{text}</p>
    </div>
  );
}

function SummaryRow({
  done,
  label,
  detail,
}: {
  done: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-owly-border bg-owly-bg px-4 py-3">
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-owly-success text-white" : "bg-owly-border text-owly-text-light"
        }`}
      >
        {done ? (
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span>-</span>
        )}
      </div>
      <div>
        <div className="text-sm font-medium text-owly-text">{label}</div>
        <div className="text-xs text-owly-text-light">{detail}</div>
      </div>
    </div>
  );
}
