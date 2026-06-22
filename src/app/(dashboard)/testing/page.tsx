"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
} from "lucide-react";
import { Header } from "@/components/layout/header";

interface TestResult {
  status: "idle" | "running" | "success" | "error";
  prompt: string;
  response?: string;
  conversationId?: string;
  error?: string;
}

const samplePrompts = [
  "LED1000 bán những nhóm sản phẩm nào?",
  "Giá adapter 12V 5A bao nhiêu?",
  "Tôi cần mua nguồn cho LED dây 10m",
  "Tôi muốn mua đèn cho bảng hiệu",
];

export default function TestingPage() {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [customPrompt, setCustomPrompt] = useState("");
  const [runningAll, setRunningAll] = useState(false);
  const [zaloPhoneNumbers, setZaloPhoneNumbers] = useState("");
  const [zaloMessage, setZaloMessage] = useState("");
  const [zaloImage, setZaloImage] = useState<File | null>(null);
  const [sendingZalo, setSendingZalo] = useState(false);
  const [zaloResults, setZaloResults] = useState<
    Array<{ phoneNumber: string; type: "success" | "error"; message: string }>
  >([]);

  async function runPrompt(prompt: string) {
    setResults((prev) => ({
      ...prev,
      [prompt]: { status: "running", prompt },
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          channel: "widget",
          customerName: "Khách test",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không thể test câu hỏi này");
      }

      setResults((prev) => ({
        ...prev,
        [prompt]: {
          status: "success",
          prompt,
          response: data.response,
          conversationId: data.conversationId,
        },
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [prompt]: {
          status: "error",
          prompt,
          error: error instanceof Error ? error.message : "Đã xảy ra lỗi",
        },
      }));
    }
  }

  async function runAllPrompts() {
    setRunningAll(true);
    try {
      for (const prompt of samplePrompts) {
        await runPrompt(prompt);
      }
    } finally {
      setRunningAll(false);
    }
  }

  function resetResults() {
    setResults({});
  }

  async function sendZaloTestMessage() {
    const phoneNumbers = zaloPhoneNumbers
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (phoneNumbers.length === 0 || !zaloMessage.trim()) return;

    setSendingZalo(true);
    setZaloResults([]);

    try {
      const nextResults: Array<{
        phoneNumber: string;
        type: "success" | "error";
        message: string;
      }> = [];

      for (const phoneNumber of phoneNumbers) {
        const res = zaloImage
          ? await (async () => {
              const formData = new FormData();
              formData.append("action", "send_image");
              formData.append("phoneNumber", phoneNumber);
              formData.append("message", zaloMessage.trim());
              formData.append("image", zaloImage);

              return fetch("/api/channels/zalo", {
                method: "POST",
                body: formData,
              });
            })()
          : await fetch("/api/channels/zalo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "send",
                phoneNumber,
                message: zaloMessage.trim(),
              }),
            });

        const data = await res.json();
        if (!res.ok) {
          nextResults.push({
            phoneNumber,
            type: "error",
            message: data.error || "Không gửi được tin nhắn Zalo",
          });
        } else {
          nextResults.push({
            phoneNumber,
            type: "success",
            message: data.message || "Đã gửi tin nhắn Zalo",
          });
        }
      }

      setZaloResults(nextResults);
    } catch (error) {
      setZaloResults([
        {
          phoneNumber: "system",
          type: "error",
          message: error instanceof Error ? error.message : "Đã xảy ra lỗi",
        },
      ]);
    } finally {
      setSendingZalo(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header
        title="Kiểm thử AI"
        description="Chạy nhanh các câu hỏi mẫu trước khi vận hành thật với khách hàng"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={runAllPrompts}
              disabled={runningAll}
              className="inline-flex items-center gap-2 px-4 py-2 bg-owly-primary text-white rounded-lg hover:bg-owly-primary-dark disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {runningAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Chạy tất cả
            </button>
            <button
              onClick={resetResults}
              className="inline-flex items-center gap-2 px-4 py-2 border border-owly-border text-owly-text rounded-lg hover:bg-owly-bg transition-colors text-sm font-medium"
            >
              <RotateCcw className="h-4 w-4" />
              Xóa kết quả
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl space-y-6">
          <div className="bg-owly-surface border border-owly-border rounded-xl p-5">
            <h3 className="text-base font-semibold text-owly-text mb-3">
              Câu test mẫu
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {samplePrompts.map((prompt) => {
                const result = results[prompt];

                return (
                  <div
                    key={prompt}
                    className="border border-owly-border rounded-xl p-4 bg-owly-bg space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-owly-text">
                        {prompt}
                      </p>
                      <button
                        onClick={() => runPrompt(prompt)}
                        disabled={result?.status === "running" || runningAll}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-owly-primary text-white rounded-lg hover:bg-owly-primary-dark disabled:opacity-50 transition-colors text-xs font-medium"
                      >
                        {result?.status === "running" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Chạy
                      </button>
                    </div>

                    {!result && (
                      <p className="text-xs text-owly-text-light">
                        Chưa chạy câu test này.
                      </p>
                    )}

                    {result?.status === "success" && (
                      <div className="space-y-2">
                        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Trả lời thành công
                        </p>
                        <div className="rounded-lg bg-white border border-owly-border p-3 text-sm text-owly-text whitespace-pre-wrap">
                          {result.response}
                        </div>
                        {result.conversationId && (
                          <p className="text-xs text-owly-text-light">
                            Conversation ID: {result.conversationId}
                          </p>
                        )}
                      </div>
                    )}

                    {result?.status === "error" && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <p className="inline-flex items-center gap-1.5 font-medium mb-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Test thất bại
                        </p>
                        <p>{result.error}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-owly-surface border border-owly-border rounded-xl p-5">
            <h3 className="text-base font-semibold text-owly-text mb-3">
              Test câu của riêng bạn
            </h3>
            <div className="space-y-3">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={4}
                placeholder="Ví dụ: Tôi cần LED dây ngoài trời chống nước cho bảng hiệu dài 10m"
                className="w-full px-3 py-2 text-sm border border-owly-border rounded-lg bg-owly-bg text-owly-text focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary resize-none"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => customPrompt.trim() && runPrompt(customPrompt.trim())}
                  disabled={!customPrompt.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-owly-primary text-white rounded-lg hover:bg-owly-primary-dark disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  <MessageSquare className="h-4 w-4" />
                  Gửi test
                </button>
                <Link
                  href="/conversations"
                  className="text-sm font-medium text-owly-primary hover:text-owly-primary-dark transition-colors"
                >
                  Xem lại hội thoại test
                </Link>
              </div>
            </div>

            {customPrompt.trim() && results[customPrompt.trim()]?.response && (
              <div className="mt-4 rounded-lg border border-owly-border bg-owly-bg p-4">
                <p className="text-xs uppercase tracking-wider text-owly-text-light mb-2">
                  Phản hồi gần nhất
                </p>
                <p className="text-sm text-owly-text whitespace-pre-wrap">
                  {results[customPrompt.trim()]?.response}
                </p>
              </div>
            )}
          </div>

          <div className="bg-owly-surface border border-owly-border rounded-xl p-5">
            <h3 className="text-base font-semibold text-owly-text mb-3">
              Test gửi tin nhắn Zalo
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-owly-text mb-1.5">
                  Danh sách số điện thoại
                </label>
                <textarea
                  value={zaloPhoneNumbers}
                  onChange={(e) => setZaloPhoneNumbers(e.target.value)}
                  rows={6}
                  placeholder={"0369478393\n0352999263\n0369478393"}
                  className="w-full px-3 py-2 text-sm border border-owly-border rounded-lg bg-owly-bg text-owly-text focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary resize-none"
                />
                <p className="mt-1 text-xs text-owly-text-light">
                  Mỗi số điện thoại một dòng.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-owly-text mb-1.5">
                  Nội dung tin nhắn
                </label>
                <textarea
                  value={zaloMessage}
                  onChange={(e) => setZaloMessage(e.target.value)}
                  rows={4}
                  placeholder="Nhập tin nhắn cần gửi qua Zalo"
                  className="w-full px-3 py-2 text-sm border border-owly-border rounded-lg bg-owly-bg text-owly-text focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-owly-text mb-1.5">
                  Ảnh đính kèm
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setZaloImage(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 text-sm border border-owly-border rounded-lg bg-owly-bg text-owly-text file:mr-4 file:rounded-md file:border-0 file:bg-owly-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-owly-primary-dark"
                />
                <p className="mt-1 text-xs text-owly-text-light">
                  Có thể bỏ trống nếu chỉ gửi text.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={sendZaloTestMessage}
                  disabled={!zaloPhoneNumbers.trim() || !zaloMessage.trim() || sendingZalo}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-owly-primary text-white rounded-lg hover:bg-owly-primary-dark disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {sendingZalo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Gửi Zalo
                </button>
              </div>
            </div>

            {zaloResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {zaloResults.map((result) => (
                  <div
                    key={`${result.phoneNumber}-${result.message}`}
                    className={
                      result.type === "success"
                        ? "rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
                        : "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    }
                  >
                    <p className="inline-flex items-center gap-1.5 font-medium mb-1">
                      {result.type === "success" ? (
                        <CheckCircle className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      {result.phoneNumber === "system"
                        ? "Lỗi hệ thống"
                        : `${result.phoneNumber} - ${result.type === "success" ? "Gửi thành công" : "Gửi thất bại"}`}
                    </p>
                    <p>{result.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
