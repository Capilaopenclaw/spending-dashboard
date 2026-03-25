/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: { primary: '#0f1117', card: '#1a1d27', elevated: '#242836' },
        text: { primary: '#f0f0f5', secondary: '#8b8fa3' },
        accent: { primary: '#00d4aa', secondary: '#6366f1' },
        positive: '#4ade80',
        negative: '#f87171',
        warning: '#fbbf24',
      },
    },
  },
  plugins: [],
}
