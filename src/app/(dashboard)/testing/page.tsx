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
  "Chị muốn nhuộm tóc nâu",
  "Giá bao nhiêu",
  "Đặt lịch chiều mai",
  "Tóc chị hư rồi",
];

export default function TestingPage() {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [customPrompt, setCustomPrompt] = useState("");
  const [runningAll, setRunningAll] = useState(false);

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
                placeholder="Ví dụ: Em muốn đặt lịch nhuộm nâu lạnh cho tóc ngang vai vào chiều mai"
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
        </div>
      </div>
    </div>
  );
}
