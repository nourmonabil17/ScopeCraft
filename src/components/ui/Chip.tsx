// src/components/ui/Chip.tsx
//
// Chip primitive (owner: Yousef) — Module C.
//
// MoSCoW is encoded by fill weight, not hue: MUST solid, SHOULD outline,
// COULD dashed. This is a WCAG 1.4.1 obligation — the rejected direction used
// red and teal chips, which makes colour the information and leaves anyone who
// cannot distinguish them with nothing.
//
// So there is no `tone`, no `colour` and no `variant` prop here, and adding one
// would undo the reason the component exists. The bucket name is always
// rendered as text, which is what actually carries the meaning; the weight only
// reinforces it.

import type { ReactNode } from "react";
import styles from "./Chip.module.css";

export interface ChipProps {
  weight?: "solid" | "outline" | "dashed";
  className?: string;
  children: ReactNode;
}

export function Chip({ weight = "outline", className, children }: ChipProps) {
  return (
    <span className={[styles.chip, styles[weight], className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
