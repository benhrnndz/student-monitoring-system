"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  variant?: "header" | "surface";
  showLabel?: boolean;
}

export function ThemeToggle({ 
  className = "", 
  variant = "header",
  showLabel = false 
}: ThemeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("classpulse-theme");
    if (saved === "dark") {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    } else {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("classpulse-theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  if (!mounted) {
    return (
      <div 
        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
          variant === "header" ? "bg-white/10 border border-white/10" : "bg-slate-100 border border-slate-200"
        } ${className}`} 
      />
    );
  }

  const isDark = theme === "dark";

  const buttonStyle = variant === "header"
    ? isDark
      ? "bg-[#132347] hover:bg-[#1c3366] text-amber-300 border-white/15"
      : "bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border-white/10"
    : isDark
      ? "bg-[#0e172e] hover:bg-[#132247] text-amber-300 border-slate-700/80 shadow-xs"
      : "bg-white hover:bg-slate-50 text-slate-700 hover:text-[#0a152d] border-slate-200 shadow-xs";

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
      title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
      className={`pressable flex items-center gap-2 rounded-xl text-xs font-semibold border transition-all duration-150 ${
        showLabel ? "px-3 py-2" : "w-9 h-9 justify-center"
      } ${buttonStyle} ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-300 transition-transform rotate-0" />
      ) : (
        <Moon className="w-4 h-4 text-slate-300 transition-transform -rotate-12" />
      )}
      {showLabel && (
        <span className="font-sans">
          {isDark ? "Light Mode" : "Dark Mode"}
        </span>
      )}
    </button>
  );
}

export default ThemeToggle;
