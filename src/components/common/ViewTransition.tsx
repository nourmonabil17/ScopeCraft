// src/components/common/ViewTransition.tsx
//
// React's <ViewTransition>, reached in the one way that works everywhere this
// code runs (Module E3).
//
// Three facts force this file, and none of them are guesses:
//
//   1. node_modules/react (19.2.0) has no ViewTransition export at all.
//   2. next/dist/compiled/react does, spelled `ViewTransition`.
//   3. @types/react only declares it as `unstable_ViewTransition`, under
//      react/experimental.
//
// Next vendors its own React copy for the App Router — createVendoredReactAliases
// in its webpack config — so inside a Next build `react` is (2) and the import
// resolves. Under Jest it is (1), and importing the name by hand gives
// `undefined`, which React reports as "Element type is invalid" at render. That
// is not theoretical: it failed 54 tests across three suites before this file
// existed.
//
// So the component is read off the namespace rather than imported by name, and
// falls back to rendering its children untouched. The fallback is the honest
// behaviour in both places it can happen — a test renderer with no view
// transitions, and any future React that drops or renames the export. Neither
// should take the page down for an effect that is decoration.
//
// DELETE THIS FILE once @types/react and the installed React agree on a stable
// name. The check is `npm run typecheck` plus the board tests.

"use client";

import * as React from "react";

export interface ViewTransitionProps {
  /** Stable across the change being animated, and unique in the document. */
  name?: string;
  children: React.ReactNode;
}

const native = (React as unknown as {
  ViewTransition?: React.ComponentType<ViewTransitionProps>;
}).ViewTransition;

export const ViewTransition: React.ComponentType<ViewTransitionProps> =
  native ?? (({ children }: ViewTransitionProps) => <>{children}</>);
