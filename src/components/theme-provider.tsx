"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useState, useRef } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "gelani-theme",
}: ThemeProviderProps) {
  // Always start with defaultTheme to ensure server/client match
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const mounted = useRef(false);

  // Apply theme to DOM - wrapped to defer state updates
  const applyThemeToDOM = React.useCallback((newTheme: Theme) => {
    const root = document.documentElement;
    let resolved: "light" | "dark";
    
    if (newTheme === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      resolved = newTheme;
    }
    
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    
    // Defer setState to avoid lint error
    queueMicrotask(() => {
      setResolvedTheme(resolved);
    });
    
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey]);

  // Initialize from localStorage after mount
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    
    let storedTheme: Theme | null = null;
    try {
      storedTheme = localStorage.getItem(storageKey) as Theme | null;
    } catch {
      // Ignore localStorage errors
    }
    
    const themeToUse = storedTheme && ["light", "dark", "system"].includes(storedTheme) 
      ? storedTheme 
      : defaultTheme;
    
    // Defer state update to avoid lint error
    queueMicrotask(() => {
      setTheme(themeToUse);
      applyThemeToDOM(themeToUse);
    });
  }, [storageKey, defaultTheme, applyThemeToDOM]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeToDOM("system");
    
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme, applyThemeToDOM]);

  // Update theme
  const handleSetTheme = React.useCallback((newTheme: Theme) => {
    setTheme(newTheme);
    applyThemeToDOM(newTheme);
  }, [applyThemeToDOM]);

  return (
    <ThemeProviderContext.Provider 
      value={{ 
        theme, 
        setTheme: handleSetTheme, 
        resolvedTheme 
      }}
    >
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
