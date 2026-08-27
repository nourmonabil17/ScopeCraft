// Extends expect() with DOM matchers (toBeInTheDocument, toHaveAttribute, ...).
import "@testing-library/jest-dom";
import { installMatchMedia, resetPreferences } from "./render-helpers";
import { resetStubSession, signIn, signOut } from "./next-auth-stub";

// jsdom's test environment has no `fetch` global at all — `jest.spyOn` needs
// the property to already exist to wrap it. A fresh mock is assigned before
// every test, not once at module load: `jest.spyOn` on a property that is
// *already* a mock function returns that same instance rather than creating
// an independent wrapper, so a module-level placeholder would let every
// test's mock.calls accumulate across the whole file instead of starting
// empty. Confirmed by hand — a retry test asserting "exactly 2 calls" saw 8
// once other fetch-mocking tests ran before it in the same file.
beforeEach(() => {
  globalThis.fetch = jest.fn() as typeof fetch;

  // jsdom implements no matchMedia; ThemeProvider subscribes to it on every
  // render. Reinstalled per test so a test that simulates OS dark mode cannot
  // leave the next one in that state.
  installMatchMedia(false);

  // localStorage persists across tests in the same file. Without this, a test
  // that switches to Arabic would silently start the next one in Arabic.
  resetPreferences();

  // Same reasoning as localStorage above: a test that signs a user in must not
  // leave the next one authenticated.
  resetStubSession();
  signIn.mockClear();
  signOut.mockClear();
});
