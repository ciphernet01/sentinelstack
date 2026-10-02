"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

/**
 * Light/dark toggle.
 *
 * `next-themes` cannot know the resolved theme during SSR, so `resolvedTheme` is
 * undefined on the first client render. Rendering the icon from it immediately
 * would produce markup that disagrees with the server and trip a hydration
 * error, so the button stays visually neutral until the theme has resolved.
 *
 * The toggle is a direct two-state button rather than a dropdown: the dashboard
 * only offers light and dark, and offering "system" here would add a third
 * outcome the control could not represent.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      // Before mount the theme is unknown, so the control reports no state
      // rather than a state that may be wrong.
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle colour theme"}
      aria-pressed={mounted ? isDark : undefined}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cc-hairline/20 bg-cc-elevated text-cc-dim transition-[background-color,border-color,color,transform] duration-200 hover:border-cc-cyan/40 hover:bg-cc-cyan/10 hover:text-cc-cyan active:scale-[0.97]"
    >
      {mounted && isDark ? (
        <Moon className="h-4 w-4" />
      ) : (
        // Sun before mount and in light mode; the same glyph covers both the
        // light-mode state and the not-yet-resolved state.
        <Sun className="h-4 w-4" />
      )}
      <span className="sr-only">Toggle colour theme</span>
    </button>
  )
}
