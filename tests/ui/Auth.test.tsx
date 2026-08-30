// tests/ui/Auth.test.tsx
//
// The sign-in surface: the login card and the header's identity control.
//
// These run against tests/ui/next-auth-stub.tsx, not real Auth.js — see that
// file for why. What is genuinely under test is the branching the app owns:
// which control appears for a signed-in versus signed-out visitor, that both
// states are translated, and that the two Auth.js calls are made with the
// redirect targets the routing depends on.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./render-helpers";
import { setStubSession, signIn, signOut } from "./next-auth-stub";
import { LoginCard } from "@/components/common/LoginCard";
import { Header } from "@/components/common/Header";

describe("Login card", () => {
  it("signs in with GitHub and comes back to /scopecraft", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginCard />);

    await user.click(screen.getByTestId("login-github"));

    // callbackUrl is the whole point: without it Auth.js returns the visitor
    // to "/", which redirects to /scopecraft, which redirects to /login —
    // a loop that only shows up once the OAuth round trip is real.
    expect(signIn).toHaveBeenCalledWith("github", { callbackUrl: "/scopecraft" });
  });

  it("signs in with Google and comes back to /scopecraft", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginCard />);

    await user.click(screen.getByTestId("login-google"));

    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/scopecraft" });
  });

  it("is translated rather than English-only", () => {
    renderWithProviders(<LoginCard />, { locale: "ar" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "تسجيل الدخول إلى ScopeCraft"
    );
    expect(screen.getByTestId("login-github")).toHaveTextContent("المتابعة عبر GitHub");
    expect(screen.getByTestId("login-google")).toHaveTextContent("المتابعة عبر Google");
  });

  it("keeps the language and theme toggles reachable before sign-in", () => {
    // A first-time Arabic visitor has nothing stored yet, so if the login page
    // dropped the header they would be stuck reading English to sign in.
    renderWithProviders(<LoginCard />);

    expect(screen.getByTestId("app-header")).toBeInTheDocument();
  });
});

describe("Header identity control", () => {
  it("shows nothing at all when signed out", () => {
    renderWithProviders(<Header />);

    // Not "renders a disabled sign-out": a control that can never do anything
    // is one more thing for a screen reader to read out and skip.
    expect(screen.queryByTestId("user-menu")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sign-out")).not.toBeInTheDocument();
  });

  it("names the signed-in user and signs them back out to /login", async () => {
    setStubSession({ user: { name: "Yousef", email: "yousef@example.com" } });
    const user = userEvent.setup();
    renderWithProviders(<Header />);

    expect(screen.getByTestId("user-menu")).toHaveTextContent("Yousef");

    await user.click(screen.getByTestId("sign-out"));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });

  it("falls back to the email when GitHub supplies no display name", () => {
    // GitHub's `name` is optional and frequently empty; an anonymous blank
    // gap in the header reads as a rendering bug.
    setStubSession({ user: { name: null, email: "yousef@example.com" } });
    renderWithProviders(<Header />);

    expect(screen.getByTestId("user-menu")).toHaveTextContent("yousef@example.com");
  });
});
