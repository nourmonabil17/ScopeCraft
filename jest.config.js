/** @type {import('jest').Config} */
//
// Two kinds of test live here and they need different environments:
//   - tests/api, tests/evaluation -> Node. They exercise route handlers and pure
//     functions; a DOM would be dead weight and would mask Node-only mistakes.
//   - tests/ui -> jsdom. React components need a document to render into.
//
// `projects` keeps that split explicit rather than relying on per-file
// docblock overrides, which are easy to forget when adding the next UI test.
module.exports = {
  projects: [
    {
      displayName: "node",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/api/**/*.test.ts", "<rootDir>/tests/evaluation/**/*.test.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
    {
      displayName: "ui",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/tests/ui/**/*.test.tsx"],
      setupFilesAfterEnv: ["<rootDir>/tests/ui/setup.ts"],
      moduleNameMapper: {
        // CSS Modules resolve to a proxy so `styles.foo` returns the string
        // "foo" instead of undefined — class assertions stay meaningful and the
        // bundler never has to run.
        "\\.module\\.css$": "identity-obj-proxy",
        "\\.css$": "<rootDir>/tests/ui/style-stub.ts",
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
  ],
};
