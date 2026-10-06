"use client";

import React, { type ReactNode } from "react";
import { useTheme } from "@/contexts/ThemeContext";

export interface PageShellProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "main" | "section";
}

/**
 * Client island shell that binds the active user theme (data-theme={theme})
 * from ThemeContext to root page containers while wrapping Server Component children.
 */
export default function PageShell({
  children,
  className = "min-h-screen bg-bg text-text",
  as: Component = "div",
}: PageShellProps) {
  const { theme } = useTheme();

  return (
    <Component data-theme={theme} className={className}>
      {children}
    </Component>
  );
}

export { PageShell };
