import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme primary
        bg: {
          primary: '#0f1117',
          card: '#1a1d27',
          elevated: '#242836',
        },
        text: {
          primary: '#f0f0f5',
          secondary: '#8b8fa3',
        },
        accent: {
          primary: '#00d4aa', // teal/mint — brand
          secondary: '#6366f1', // indigo
        },
        positive: '#4ade80',
        negative: '#f87171',
        warning: '#fbbf24',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        pill: '24px',
      },
      fontFeatureSettings: {
        'tabular-nums': '"tnum"',
      },
    },
  },
  plugins: [],
}

export default config
