"use client";

import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";
import { extractPaginatedData } from "@/lib/pagination";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  X,
  FolderOpen,
  FileText,
  ChevronRight,
  AlertCircle,
  Star,
  ArrowUp,
  Minus,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ArrowLeft,
  Upload,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface CategoryWithCount {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  _count: { entries: number };
}

interface EntryCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface KnowledgeEntry {
  id: string;
  categoryId: string;
  category: EntryCategory;
  title: string;
  content: string;
  priority: number;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ImportResult {
  success: boolean;
  filename: string;
  sourceType: string;
  chunksCreated: number;
  chunksIndexed: number;
  embeddingSkipped: number;
  warnings: string[];
}

interface ImportPreviewSection {
  index: number;
  title: string;
  content: string;
  contentPreview: string;
  contentLength: number;
  sourceFormat: string | null;
  parserConfidence: number | null;
  metadata: Record<string, unknown>;
  selected: boolean;
}

interface ImportPreview {
  success: boolean;
  filename: string;
  sourceType: string;
  suggestedKnowledgeKind?: string | null;
  suggestedCategoryId?: string | null;
  suggestedCategoryName?: string | null;
  categorySuggestionConfidence?: number | null;
  categorySuggestionReason?: string | null;
  chunkCount: number;
  previewCount: number;
  lowConfidenceCount: number;
  averageConfidence: number | null;
  warnings: string[];
  sections: ImportPreviewSection[];
}

type ImportMode = "parser" | "gemini";

const PRIORITIES = [
  { value: 0, label: "Thường", icon: Minus, className: "bg-gray-100 text-gray-600" },
  { value: 1, label: "Trung bình", icon: ArrowUp, className: "bg-yellow-100 text-yellow-700" },
  { value: 2, label: "Cao", icon: ArrowUp, className: "bg-orange-100 text-orange-700" },
  { value: 3, label: "Khẩn cấp", icon: Star, className: "bg-red-100 text-red-700" },
];

function getPriority(value: number) {
  return PRIORITIES.find((priority) => priority.value === value) || PRIORITIES[0];
}

function CategoryIcon({ color, name }: { color: string; name: string }) {
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-semibold flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function KnowledgeBasePage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithCount | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    icon: "folder",
    color: "#4A7C9B",
  });
  const [savingCategory, setSavingCategory] = useState(false);

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [entryForm, setEntryForm] = useState({ title: "", content: "", priority: 0 });
  const [savingEntry, setSavingEntry] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importForm, setImportForm] = useState<{
    priority: number;
    isActive: boolean;
    mode: ImportMode;
  }>({ priority: 0, isActive: true, mode: "parser" });
  const [previewingImport, setPreviewingImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "category" | "entry";
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch("/api/knowledge/categories?limit=100");
      if (res.ok) {
        const data = await res.json();
        setCategories(extractPaginatedData<CategoryWithCount>(data));
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const fetchEntries = useCallback(async (categoryId: string) => {
    setLoadingEntries(true);
    try {
      const params = new URLSearchParams({ categoryId, limit: "100" });
      const res = await fetch(`/api/knowledge/entries?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(extractPaginatedData<KnowledgeEntry>(data));
      }
    } catch (err) {
      console.error("Failed to fetch entries:", err);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategoryId(null);
      return;
    }
    if (!categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (selectedCategoryId) {
      fetchEntries(selectedCategoryId);
    } else {
      setEntries([]);
    }
  }, [selectedCategoryId, fetchEntries]);

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) || null;

  function openCategoryModal(category?: CategoryWithCount) {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description,
        icon: category.icon,
        color: category.color,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "", icon: "folder", color: "#4A7C9B" });
    }
    setShowCategoryModal(true);
  }

  async function saveCategory() {
    if (!categoryForm.name.trim()) return;
    setSavingCategory(true);
    try {
      const url = editingCategory
        ? `/api/knowledge/categories/${editingCategory.id}`
        : "/api/knowledge/categories";
      const method = editingCategory ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      if (res.ok) {
        const savedCategory = (await res.json()) as CategoryWithCount;
        setShowCategoryModal(false);
        await fetchCategories();
        setSelectedCategoryId(savedCategory.id);
        setMobileShowDetail(true);
      }
    } catch (err) {
      console.error("Failed to save category:", err);
    } finally {
      setSavingCategory(false);
    }
  }

  function openEntryModal(entry?: KnowledgeEntry) {
    if (entry) {
      setEditingEntry(entry);
      setEntryForm({ title: entry.title, content: entry.content, priority: entry.priority });
    } else {
      setEditingEntry(null);
      setEntryForm({ title: "", content: "", priority: 0 });
    }
    setShowEntryModal(true);
  }

  function openImportModal() {
    setImportFile(null);
    setImportForm({ priority: 0, isActive: true, mode: "parser" });
    setImportError("");
    setImportPreview(null);
    setImportResult(null);
    setShowImportModal(true);
  }

  function closeImportModal() {
    setShowImportModal(false);
    setImportFile(null);
    setImportError("");
    setImportPreview(null);
    setImportResult(null);
  }

  async function saveEntry() {
    if (!entryForm.title.trim() || !selectedCategoryId) return;
    setSavingEntry(true);
    try {
      const url = editingEntry
        ? `/api/knowledge/entries/${editingEntry.id}`
        : "/api/knowledge/entries";
      const method = editingEntry ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...entryForm, categoryId: selectedCategoryId }),
      });
      if (res.ok) {
        setShowEntryModal(false);
        await fetchEntries(selectedCategoryId);
        await fetchCategories();
      }
    } catch (err) {
      console.error("Failed to save entry:", err);
    } finally {
      setSavingEntry(false);
    }
  }

  async function previewImport() {
    if (!selectedCategoryId || !importFile) return;
    setPreviewingImport(true);
    setImportError("");
    setImportPreview(null);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("mode", importForm.mode);

      const res = await fetch("/api/knowledge/import/preview", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({
        error: `Không đọc được response từ server. HTTP ${res.status}`,
      }));

      if (!res.ok) {
        console.error("Knowledge import preview failed:", {
          status: res.status,
          mode: importForm.mode,
          filename: importFile.name,
          response: data,
        });
        setImportError(
          data.error
            ? `HTTP ${res.status}: ${data.error}`
            : `HTTP ${res.status}: Không thể xem trước file.`
        );
        return;
      }

      setImportPreview({
        ...data,
        sections: data.sections.map((section: ImportPreviewSection) => ({
          ...section,
          selected: true,
        })),
      });
    } catch (err) {
      console.error("Failed to preview knowledge file:", err);
      setImportError("Không thể xem trước file. Vui lòng thử lại.");
    } finally {
      setPreviewingImport(false);
    }
  }

  async function submitImport() {
    if (!selectedCategoryId || !importPreview) return;
    const reviewedSections = importPreview.sections
      .filter((section) => section.selected && section.title.trim() && section.content.trim())
      .map((section) => ({
        title: section.title.trim(),
        content: section.content.trim(),
        metadata: section.metadata,
      }));

    if (reviewedSections.length === 0) {
      setImportError("Chọn ít nhất một mục có tiêu đề và nội dung để import.");
      return;
    }

    setImporting(true);
    setImportError("");
    setImportResult(null);

    try {
      const res = await fetch("/api/knowledge/import/reviewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          filename: importPreview.filename,
          sourceType: importPreview.sourceType,
          priority: importForm.priority,
          isActive: importForm.isActive,
          sections: reviewedSections,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setImportError(data.error || "Không thể import file.");
        return;
      }

      setImportResult(data);
      await fetchEntries(selectedCategoryId);
      await fetchCategories();
      closeImportModal();
    } catch (err) {
      console.error("Failed to import knowledge file:", err);
      setImportError("Không thể import file. Vui lòng thử lại.");
    } finally {
      setImporting(false);
    }
  }

  function updatePreviewSection(
    index: number,
    patch: Partial<Pick<ImportPreviewSection, "title" | "content" | "selected">>
  ) {
    setImportPreview((preview) =>
      preview
        ? {
            ...preview,
            sections: preview.sections.map((section) =>
              section.index === index
                ? {
                    ...section,
                    ...patch,
                    contentLength:
                      patch.content !== undefined ? patch.content.length : section.contentLength,
                  }
                : section
            ),
          }
        : preview
    );
  }

  function removePreviewSection(index: number) {
    setImportPreview((preview) =>
      preview
        ? {
            ...preview,
            sections: preview.sections.filter((section) => section.index !== index),
          }
        : preview
    );
  }

  function setAllPreviewSectionsSelected(selected: boolean) {
    setImportPreview((preview) =>
      preview
        ? {
            ...preview,
            sections: preview.sections.map((section) => ({ ...section, selected })),
          }
        : preview
    );
  }

  function applySuggestedImportCategory() {
    if (!importPreview?.suggestedCategoryId) return;
    setSelectedCategoryId(importPreview.suggestedCategoryId);
    setMobileShowDetail(true);
  }

  async function toggleEntryActive(entry: KnowledgeEntry) {
    try {
      const res = await fetch(`/api/knowledge/entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !entry.isActive }),
      });
      if (res.ok && selectedCategoryId) {
        await fetchEntries(selectedCategoryId);
      }
    } catch (err) {
      console.error("Failed to toggle entry:", err);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const url =
        deleteTarget.type === "category"
          ? `/api/knowledge/categories/${deleteTarget.id}`
          : `/api/knowledge/entries/${deleteTarget.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        if (deleteTarget.type === "category") {
          if (selectedCategoryId === deleteTarget.id) {
            setSelectedCategoryId(null);
            setEntries([]);
          }
          await fetchCategories();
        } else if (selectedCategoryId) {
          await fetchEntries(selectedCategoryId);
          await fetchCategories();
        }
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const colorPresets = [
    "#4A7C9B",
    "#2D5A7B",
    "#C4956A",
    "#6B8E5B",
    "#9B6B9E",
    "#C75C5C",
    "#D4964A",
    "#5B8E8E",
    "#7C6B9B",
    "#4A9B7C",
  ];
  const selectedPreviewCount =
    importPreview?.sections.filter(
      (section) => section.selected && section.title.trim() && section.content.trim()
    ).length || 0;

  return (
    <>
      <Header title="Kho kiến thức" description="Quản lý kiến thức cho trợ lý AI" />

      <div className="flex-1 overflow-hidden flex">
        <div
          className={cn(
            "w-full flex-shrink-0 bg-owly-surface flex-col",
            mobileShowDetail ? "hidden" : "flex"
          )}
        >
          <div className="px-4 py-3 border-b border-owly-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-owly-text">Danh mục</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openCategoryModal()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-owly-primary hover:bg-owly-primary-dark rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingCategories ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-owly-text-light" />
              </div>
            ) : categories.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <FolderOpen className="h-10 w-10 mx-auto mb-3 text-owly-text-light opacity-40" />
                <p className="text-sm font-medium text-owly-text-light">Chưa có danh mục nào</p>
                <p className="text-xs text-owly-text-light mt-1">
                  Tạo danh mục đầu tiên để bắt đầu sắp xếp dữ liệu kiến thức.
                </p>
                <button
                  onClick={() => openCategoryModal()}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-owly-primary border border-owly-primary/30 hover:bg-owly-primary-50 rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tạo danh mục
                </button>
              </div>
            ) : (
              <div className="py-1">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className={cn(
                      "group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                      selectedCategoryId === category.id
                        ? "bg-owly-primary-50 border-r-2 border-owly-primary"
                        : "hover:bg-owly-bg"
                    )}
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                      setMobileShowDetail(true);
                    }}
                  >
                    <CategoryIcon color={category.color} name={category.name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-owly-text truncate">
                          {category.name}
                        </p>
                        <span className="text-xs text-owly-text-light flex-shrink-0 ml-2">
                          {category._count.entries}
                        </span>
                      </div>
                      {category.description && (
                        <p className="text-xs text-owly-text-light truncate mt-0.5">
                          {category.description}
                        </p>
                      )}
                    </div>
                    <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openCategoryModal(category);
                        }}
                        className="p-1 text-owly-text-light hover:text-owly-primary rounded transition-colors"
                        title="Sửa danh mục"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget({
                            type: "category",
                            id: category.id,
                            name: category.name,
                          });
                        }}
                        className="p-1 text-owly-text-light hover:text-red-600 rounded transition-colors"
                        title="Xóa danh mục"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {selectedCategoryId === category.id && (
                      <ChevronRight className="h-4 w-4 text-owly-primary flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={cn("w-full flex-col bg-owly-bg", !mobileShowDetail ? "hidden" : "flex")}>
          {!selectedCategory ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-owly-text-light opacity-30" />
                <p className="text-lg font-medium text-owly-text-light">Chọn một danh mục</p>
                <p className="text-sm text-owly-text-light mt-1">
                  Chọn danh mục bên trái để xem nội dung.
                </p>
                <button
                  onClick={() => openCategoryModal()}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-owly-primary hover:bg-owly-primary-dark rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tạo danh mục trước
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 md:px-6 py-3 border-b border-owly-border bg-owly-surface flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setMobileShowDetail(false);
                      setSelectedCategoryId(null);
                    }}
                    className="mr-1 inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-owly-text hover:bg-owly-primary-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <ArrowLeft className="h-5 w-5 text-owly-text" />
                    <span className="hidden sm:inline">Quay lại</span>
                  </button>
                  <CategoryIcon color={selectedCategory.color} name={selectedCategory.name} />
                  <div>
                    <h3 className="text-sm font-semibold text-owly-text">
                      {selectedCategory.name}
                    </h3>
                    {selectedCategory.description && (
                      <p className="text-xs text-owly-text-light">{selectedCategory.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openImportModal}
                    disabled={!selectedCategory}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-owly-primary border border-owly-primary/30 hover:bg-owly-primary-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Nhập từ file
                  </button>
                  <button
                    onClick={() => openEntryModal()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-owly-primary hover:bg-owly-primary-dark rounded-lg transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm mục
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingEntries ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-owly-text-light" />
                  </div>
                ) : entries.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-owly-text-light opacity-40" />
                    <p className="text-sm font-medium text-owly-text-light">
                      Danh mục này chưa có mục kiến thức nào
                    </p>
                    <p className="text-xs text-owly-text-light mt-1">
                      Thêm mục kiến thức để AI dùng khi tư vấn khách hàng.
                    </p>
                    <button
                      onClick={() => openEntryModal()}
                      className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-owly-primary border border-owly-primary/30 hover:bg-owly-primary-50 rounded-lg transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Thêm mục đầu tiên
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry) => {
                      const priority = getPriority(entry.priority);
                      const PriorityIcon = priority.icon;
                      const contentPreview = entry.content
                        ? entry.content.split("\n")[0].slice(0, 120)
                        : "";

                      return (
                        <div
                          key={entry.id}
                          onClick={() => openEntryModal(entry)}
                          className={cn(
                            "bg-owly-surface rounded-xl border border-owly-border p-4 transition-all hover:shadow-sm cursor-pointer hover:border-owly-primary/30",
                            !entry.isActive && "opacity-60"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-medium text-owly-text">
                                  {entry.title}
                                </h4>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium",
                                    priority.className
                                  )}
                                >
                                  <PriorityIcon className="h-3 w-3" />
                                  {priority.label}
                                </span>
                                {!entry.isActive && (
                                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                                    Đã tắt
                                  </span>
                                )}
                              </div>
                              {contentPreview && (
                                <p className="text-xs text-owly-text-light mt-1 truncate">
                                  {contentPreview}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleEntryActive(entry);
                                }}
                                className={cn(
                                  "p-1.5 rounded transition-colors",
                                  entry.isActive
                                    ? "text-owly-primary hover:bg-owly-primary-50"
                                    : "text-owly-text-light hover:bg-gray-100"
                                )}
                                title={entry.isActive ? "Tắt mục" : "Bật mục"}
                              >
                                {entry.isActive ? (
                                  <ToggleRight className="h-4 w-4" />
                                ) : (
                                  <ToggleLeft className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEntryModal(entry);
                                }}
                                className="p-1.5 text-owly-text-light hover:text-owly-primary hover:bg-owly-primary-50 rounded transition-colors"
                                title="Sửa mục"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget({
                                    type: "entry",
                                    id: entry.id,
                                    name: entry.title,
                                  });
                                }}
                                className="p-1.5 text-owly-text-light hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Xóa mục"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCategoryModal(false)}
          />
          <div className="relative bg-owly-surface rounded-xl shadow-xl border border-owly-border w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-owly-border">
              <h3 className="font-semibold text-owly-text">
                {editingCategory ? "Chỉnh sửa danh mục" : "Tạo danh mục mới"}
              </h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-1 text-owly-text-light hover:text-owly-text rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-owly-text mb-1.5">Tên</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="VD: Hỏi đáp dịch vụ, Chính sách hoàn tiền"
                  className="w-full px-3 py-2 text-sm border border-owly-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-owly-text mb-1.5">Mô tả</label>
                <input
                  type="text"
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, description: e.target.value })
                  }
                  placeholder="Mô tả ngắn cho danh mục này"
                  className="w-full px-3 py-2 text-sm border border-owly-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-owly-text mb-1.5">Màu sắc</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      onClick={() => setCategoryForm({ ...categoryForm, color })}
                      className={cn(
                        "w-7 h-7 rounded-full transition-all",
                        categoryForm.color === color
                          ? "ring-2 ring-offset-2 ring-owly-primary scale-110"
                          : "hover:scale-110"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer border border-owly-border"
                    title="Màu tùy chỉnh"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-owly-border">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 text-sm font-medium text-owly-text-light hover:text-owly-text rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={saveCategory}
                disabled={!categoryForm.name.trim() || savingCategory}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-owly-primary hover:bg-owly-primary-dark disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {savingCategory && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingCategory ? "Lưu thay đổi" : "Tạo danh mục"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !importing && !previewingImport && closeImportModal()}
          />
          <div className="relative bg-owly-surface rounded-xl shadow-xl border border-owly-border w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-owly-border">
              <h3 className="font-semibold text-owly-text">Nhập kiến thức từ file</h3>
              <button
                onClick={closeImportModal}
                disabled={importing || previewingImport}
                className="p-1 text-owly-text-light hover:text-owly-text disabled:opacity-50 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-owly-text mb-1.5">File</label>
                <input
                  key={importForm.mode}
                  type="file"
                  accept={
                    importForm.mode === "gemini"
                      ? ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp,.heic,.heif"
                      : ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md"
                  }
                  onChange={(event) => {
                    setImportFile(event.target.files?.[0] || null);
                    setImportError("");
                    setImportPreview(null);
                    setImportResult(null);
                  }}
                  className="w-full px-3 py-2 text-sm border border-owly-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary"
                />
                <p className="text-xs text-owly-text-light mt-1">
                  Hỗ trợ PDF, Word, Excel, CSV, TXT, MD và ảnh khi dùng Gemini. Tối đa 10MB.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-owly-text mb-1.5">
                  Cách đọc file
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportForm({ ...importForm, mode: "parser" });
                      setImportFile(null);
                      setImportError("");
                      setImportPreview(null);
                      setImportResult(null);
                    }}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                      importForm.mode === "parser"
                        ? "border-owly-primary bg-owly-primary-50 text-owly-primary"
                        : "border-owly-border text-owly-text hover:border-owly-primary/30"
                    )}
                  >
                    <FileText className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      <span className="block text-sm font-medium">Parser thường</span>
                      <span className="block text-xs text-owly-text-light">
                        Nhanh, không tốn AI, hợp file có cấu trúc text rõ.
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportForm({ ...importForm, mode: "gemini" });
                      setImportFile(null);
                      setImportError("");
                      setImportPreview(null);
                      setImportResult(null);
                    }}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                      importForm.mode === "gemini"
                        ? "border-owly-primary bg-owly-primary-50 text-owly-primary"
                        : "border-owly-border text-owly-text hover:border-owly-primary/30"
                    )}
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      <span className="block text-sm font-medium">Đọc bằng Gemini</span>
                      <span className="block text-xs text-owly-text-light">
                        Tốt hơn cho PDF, ảnh chụp, bảng giá nhiều cột và layout khó.
                      </span>
                    </span>
                  </button>
                </div>
                {importForm.mode === "gemini" && (
                  <p className="mt-2 text-xs text-owly-text-light">
                    Với file Word nhiều bảng/ảnh như bảng giá hoặc catalogue nhiều cột, nên lưu thành PDF rồi import
                    bằng Gemini để giữ bố cục chính xác hơn.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-owly-text mb-1.5">Ưu tiên</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRIORITIES.map((priority) => {
                    const Icon = priority.icon;
                    return (
                      <button
                        key={priority.value}
                        onClick={() => setImportForm({ ...importForm, priority: priority.value })}
                        className={cn(
                          "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                          importForm.priority === priority.value
                            ? cn(priority.className, "border-current ring-1 ring-current/20")
                            : "border-owly-border text-owly-text-light hover:border-owly-primary/30"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {priority.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setImportForm({ ...importForm, isActive: !importForm.isActive })}
                className={cn(
                  "inline-flex items-center gap-2 text-sm transition-colors",
                  importForm.isActive ? "text-owly-primary" : "text-owly-text-light"
                )}
              >
                {importForm.isActive ? (
                  <ToggleRight className="h-5 w-5" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
                {importForm.isActive ? "Kích hoạt sau khi import" : "Import ở trạng thái tắt"}
              </button>

              {importError && (
                <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importPreview && (
                <div className="space-y-3 border border-owly-border rounded-lg p-3 bg-owly-bg">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-owly-text">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Xem trước {importPreview.filename}
                      </div>
                      <p className="text-xs text-owly-text-light mt-1">
                        Tách được {importPreview.chunkCount} mục. Đã chọn {selectedPreviewCount} mục
                        để import vào {selectedCategory?.name || "danh mục hiện tại"}.
                      </p>
                      <p className="text-xs text-owly-text-light mt-0.5">
                        Nguồn đọc: {importPreview.sourceType}
                      </p>
                      {importPreview.suggestedCategoryName && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                          <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700">
                            Loại: {importPreview.suggestedKnowledgeKind || "unknown"}
                          </span>
                          <span className="px-2 py-1 rounded-md bg-owly-primary-50 text-owly-primary">
                            Gợi ý: {importPreview.suggestedCategoryName}
                          </span>
                          {importPreview.categorySuggestionConfidence !== null &&
                            importPreview.categorySuggestionConfidence !== undefined && (
                              <span className="text-owly-text-light">
                                {Math.round(importPreview.categorySuggestionConfidence * 100)}%
                              </span>
                            )}
                          {importPreview.suggestedCategoryId &&
                            importPreview.suggestedCategoryId !== selectedCategoryId && (
                              <button
                                onClick={applySuggestedImportCategory}
                                className="font-medium text-owly-primary hover:text-owly-primary-dark"
                              >
                                Chuyển sang danh mục này
                              </button>
                            )}
                        </div>
                      )}
                      {importPreview.categorySuggestionReason && (
                        <p className="text-xs text-owly-text-light mt-1">
                          {importPreview.categorySuggestionReason}
                        </p>
                      )}
                    </div>
                    <div
                      className={cn(
                        "px-2 py-1 rounded-md text-xs font-medium",
                        importPreview.lowConfidenceCount > 0
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-700"
                      )}
                    >
                      {importPreview.averageConfidence === null
                        ? "Chưa có confidence"
                        : `${Math.round(importPreview.averageConfidence * 100)}% confidence`}
                    </div>
                  </div>

                  {importPreview.warnings.length > 0 && (
                    <div className="flex items-start gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        {importPreview.warnings.map((warning, index) => (
                          <p key={`${warning}-${index}`}>{warning}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setAllPreviewSectionsSelected(true)}
                      className="text-xs font-medium text-owly-primary hover:text-owly-primary-dark"
                    >
                      Chọn tất cả
                    </button>
                    <button
                      onClick={() => setAllPreviewSectionsSelected(false)}
                      className="text-xs font-medium text-owly-text-light hover:text-owly-text"
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {importPreview.sections.map((section) => (
                      <div
                        key={`preview-section-${section.index}`}
                        className="border border-owly-border bg-owly-surface rounded-lg p-3"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={section.selected}
                            onChange={(event) =>
                              updatePreviewSection(section.index, {
                                selected: event.target.checked,
                              })
                            }
                            className="mt-2 h-4 w-4 rounded border-owly-border text-owly-primary focus:ring-owly-primary/30"
                            aria-label={`Chọn mục ${section.index + 1}`}
                          />
                          <div className="min-w-0 flex-1 space-y-2">
                            <input
                              type="text"
                              value={section.title}
                              onChange={(event) =>
                                updatePreviewSection(section.index, { title: event.target.value })
                              }
                              className="w-full px-2.5 py-1.5 text-sm font-medium text-owly-text border border-owly-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary"
                            />
                            <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-owly-text-light">
                              <span>#{section.index + 1}</span>
                              {section.sourceFormat && (
                                <span className="px-1.5 py-0.5 rounded bg-gray-100">
                                  {section.sourceFormat}
                                </span>
                              )}
                              {typeof section.metadata.documentKind === "string" && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                  {section.metadata.documentKind}
                                </span>
                              )}
                              {typeof section.metadata.geminiType === "string" && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                                  {section.metadata.geminiType}
                                </span>
                              )}
                              <span>{section.contentLength} ký tự</span>
                              {section.parserConfidence !== null && (
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded",
                                    section.parserConfidence < 0.75
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-green-100 text-green-700"
                                  )}
                                >
                                  {Math.round(section.parserConfidence * 100)}%
                                </span>
                              )}
                              {section.metadata.requiresReview === true && (
                                <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700">
                                  {typeof section.metadata.reviewLabel === "string"
                                    ? section.metadata.reviewLabel
                                    : "Cần kiểm tra"}
                                </span>
                              )}
                            </div>
                            <textarea
                              value={section.content}
                              onChange={(event) =>
                                updatePreviewSection(section.index, { content: event.target.value })
                              }
                              rows={5}
                              className="w-full px-2.5 py-2 text-xs leading-relaxed text-owly-text border border-owly-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary resize-y"
                            />
                          </div>
                          <button
                            onClick={() => removePreviewSection(section.index)}
                            className="p-1.5 text-owly-text-light hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Bỏ mục này"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult && (
                <div className="space-y-2 px-3 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Đã import {importResult.filename}
                  </div>
                  <p>
                    Tạo {importResult.chunksCreated} mục, index embedding{" "}
                    {importResult.chunksIndexed} mục, bỏ qua {importResult.embeddingSkipped} mục.
                  </p>
                  {importResult.warnings.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1 text-green-900">
                      {importResult.warnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-owly-border">
              <button
                onClick={closeImportModal}
                disabled={importing || previewingImport}
                className="px-4 py-2 text-sm font-medium text-owly-text-light hover:text-owly-text disabled:opacity-50 rounded-lg transition-colors"
              >
                Đóng
              </button>
              <button
                onClick={previewImport}
                disabled={!importFile || !selectedCategoryId || importing || previewingImport}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-owly-primary border border-owly-primary/30 hover:bg-owly-primary-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {previewingImport ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                Xem trước
              </button>
              <button
                onClick={submitImport}
                disabled={
                  !selectedCategoryId ||
                  !importPreview ||
                  selectedPreviewCount === 0 ||
                  importing ||
                  previewingImport
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-owly-primary hover:bg-owly-primary-dark disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {importing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Xác nhận nhập {selectedPreviewCount > 0 ? `(${selectedPreviewCount})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEntryModal(false)} />
          <div className="relative bg-owly-surface rounded-xl shadow-xl border border-owly-border w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-owly-border">
              <h3 className="font-semibold text-owly-text">
                {editingEntry ? "Chỉnh sửa mục" : "Tạo mục mới"}
              </h3>
              <button
                onClick={() => setShowEntryModal(false)}
                className="p-1 text-owly-text-light hover:text-owly-text rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-owly-text mb-1.5">Tiêu đề</label>
                <input
                  type="text"
                  value={entryForm.title}
                  onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
                  placeholder="VD: Cách đặt lại mật khẩu"
                  className="w-full px-3 py-2 text-sm border border-owly-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-owly-text mb-1.5">Nội dung</label>
                <textarea
                  value={entryForm.content}
                  onChange={(e) => setEntryForm({ ...entryForm, content: e.target.value })}
                  placeholder="Nhập nội dung kiến thức để AI dùng khi phản hồi khách hàng..."
                  rows={8}
                  className="w-full px-3 py-2 text-sm border border-owly-border rounded-lg focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-owly-text mb-1.5">Ưu tiên</label>
                <div className="flex items-center gap-2">
                  {PRIORITIES.map((priority) => {
                    const Icon = priority.icon;
                    return (
                      <button
                        key={priority.value}
                        onClick={() => setEntryForm({ ...entryForm, priority: priority.value })}
                        className={cn(
                          "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                          entryForm.priority === priority.value
                            ? cn(priority.className, "border-current ring-1 ring-current/20")
                            : "border-owly-border text-owly-text-light hover:border-owly-primary/30"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {priority.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-owly-border">
              <button
                onClick={() => setShowEntryModal(false)}
                className="px-4 py-2 text-sm font-medium text-owly-text-light hover:text-owly-text rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={saveEntry}
                disabled={!entryForm.title.trim() || savingEntry}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-owly-primary hover:bg-owly-primary-dark disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {savingEntry && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingEntry ? "Lưu thay đổi" : "Tạo mới"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-owly-surface rounded-xl shadow-xl border border-owly-border w-full max-w-sm mx-4">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-full bg-red-50">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="font-semibold text-owly-text">
                  Xóa {deleteTarget.type === "category" ? "danh mục" : "mục"}
                </h3>
              </div>
              <p className="text-sm text-owly-text-light">
                Bạn có chắc muốn xóa{" "}
                <span className="font-medium text-owly-text">{deleteTarget.name}</span>?
                {deleteTarget.type === "category" &&
                  " Thao tác này cũng sẽ xóa toàn bộ mục trong danh mục này."}{" "}
                Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-owly-border">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-owly-text-light hover:text-owly-text rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
