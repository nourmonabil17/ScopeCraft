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
import { ViewTransition } from "@/components/common/ViewTransition";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <ThemeProvider>
          <ToastProvider>
            {/* Route changes cross-fade instead of cutting (Module E3).
                The browser's View Transitions API only fires by itself for
                cross-document navigation; every link in this app is a
                client-side soft navigation, so it needs React to drive it —
                which is what this component and the experimental.viewTransition
                flag in next.config.js do together.

                It wraps `children` and nothing else. The toast viewport below
                is deliberately outside: a toast that is on screen when a
                navigation starts is reporting something that just happened,
                and cross-fading it out and back in would read as a second
                event. The provider chain above is outside for the same reason
                — none of it renders anything that changes on navigation.

                No `name`: the default is "auto", which lets React assign the
                transition names, so nothing here has to stay in sync with a
                string written somewhere else. */}
            <ViewTransition>{children}</ViewTransition>
            <ToastViewport />
          </ToastProvider>
        </ThemeProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
