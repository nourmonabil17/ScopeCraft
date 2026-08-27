// src/app/providers.tsx
//
// Client boundary for the app's context providers. Kept separate from
// layout.tsx so the layout itself stays a server component and can keep
// exporting `metadata` — a "use client" layout cannot.
//
// Order matters: Language wraps Theme and Toast because both of those render
// translated strings (aria-labels, dismiss buttons) and must be able to call
// `useLanguage`. SessionProvider sits outermost because UserMenu needs both it
// and `useLanguage`, and it has no dependency of its own.

"use client";

import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { ToastViewport } from "@/components/common/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <ThemeProvider>
          <ToastProvider>
            {children}
            <ToastViewport />
          </ToastProvider>
        </ThemeProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
