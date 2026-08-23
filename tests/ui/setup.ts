// Extends expect() with DOM matchers (toBeInTheDocument, toHaveAttribute, ...).
import "@testing-library/jest-dom";

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
});
