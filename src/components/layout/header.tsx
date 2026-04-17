"use client";

import { Bell, Search, Sun, Moon, LogOut, User, Menu } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/hooks/use-theme";
import { useRouter } from "next/navigation";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
  };

  return (
    <header className="flex flex-col bg-owly-surface border-b border-owly-border transition-theme">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4">
        <div className="animate-fade-in flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 mr-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
            className="md:hidden p-1.5 -ml-2 text-owly-text-light hover:text-owly-text hover:bg-owly-primary-50 rounded-lg transition-colors shrink-0"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-owly-text truncate">{title}</h2>
            {description && (
              <p className="text-xs sm:text-sm text-owly-text-light mt-0.5 truncate hidden sm:block">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-nowrap">
          {searchOpen && (
            <input
              type="text"
              placeholder="Tìm kiếm..."
              className="px-3 py-1.5 text-sm border border-owly-border rounded-lg bg-owly-surface text-owly-text focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary w-40 sm:w-64 animate-slide-in-down transition-theme"
              autoFocus
              onBlur={() => setSearchOpen(false)}
            />
          )}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="p-2 text-owly-text-light hover:text-owly-text hover:bg-owly-primary-50 rounded-lg transition-colors"
            title="Tìm kiếm"
          >
            <Search className="h-5 w-5" />
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 text-owly-text-light hover:text-owly-text hover:bg-owly-primary-50 rounded-lg transition-colors"
            title={theme === "light" ? "Chế độ tối" : "Chế độ sáng"}
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </button>

          <button className="relative p-2 text-owly-text-light hover:text-owly-text hover:bg-owly-primary-50 rounded-lg transition-colors mr-1 sm:mr-0">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-owly-danger rounded-full" />
          </button>

          <div className="hidden sm:block">
            {actions}
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-owly-primary text-white text-sm font-medium hover:bg-owly-primary-dark transition-colors shrink-0"
            >
              A
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-owly-surface border border-owly-border rounded-lg shadow-lg py-1 z-50 animate-scale-in transition-theme">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/settings");
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-owly-text hover:bg-owly-primary-50 transition-colors"
                >
                  <User className="h-4 w-4" />
                  Hồ sơ và cài đặt
                </button>
                <div className="border-t border-owly-border my-1" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-owly-danger hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {actions && (
        <div className="sm:hidden px-4 pb-3 flex overflow-x-auto flex-nowrap scrollbar-hide">
          {actions}
        </div>
      )}
    </header>
  );
}
