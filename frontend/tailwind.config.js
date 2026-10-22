/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0C0E14',
          surface: '#151924',
          elevated: '#1C2130',
          border: 'rgba(255, 255, 255, 0.07)',
          text: '#E8EAF0',
          muted: '#8A91A5',
        },
        light: {
          bg: '#F6F7FB',
          surface: '#FFFFFF',
          elevated: '#FFFFFF',
          border: '#E6E9F2',
          text: '#12141C',
          muted: '#6B7280',
        },
        accent: {
          blue: '#5B8CFF',
          violet: '#8B5CF6',
        }
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        'card': '14px',
        'input': '22px',
      },
      boxShadow: {
        'subtle-lift': '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'card-dark': '0 4px 20px -2px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'card-light': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.04)',
        'btn-raised': '0 4px 14px 0 rgba(91, 140, 255, 0.39)',
        'btn-pressed': 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
      }
    },
  },
  plugins: [],
}
