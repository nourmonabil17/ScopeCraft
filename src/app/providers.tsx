// src/app/providers.tsx
//
// Client boundary for the app's context providers. Kept separate from
// layout.tsx so the layout itself stays a server component and can keep
// exporting `metadata` — a "use client" layout cannot.
//
// Order matters: Language wraps Theme and Toast because both of those render
// translated strings (aria-labels, dismiss buttons) and must be able to call
// `useLanguage`.

"use client";

import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { ToastViewport } from "@/components/common/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          {children}
          <ToastViewport />
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
