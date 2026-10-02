"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
// `next-themes/dist/types` no longer exists in 0.4.x; the type is re-exported
// from the package root. This import is what previously broke every build that
// touched the provider, including the dashboard theme toggle.
import { type ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
