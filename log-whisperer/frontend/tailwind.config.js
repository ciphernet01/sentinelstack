/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'hsl(var(--primary))',
        secondary: 'hsl(var(--primary-secondary))',
        accent: 'hsl(var(--accent))',
        destructive: 'hsl(var(--destructive))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        anomaly: {
          low: 'hsl(var(--anomaly-low))',
          medium: 'hsl(var(--anomaly-medium))',
          high: 'hsl(var(--anomaly-high))',
          critical: 'hsl(var(--anomaly-critical))',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
};
