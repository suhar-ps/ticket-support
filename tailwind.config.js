/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#16211D',
          light: '#5B6B65',
        },
        canvas: '#F5F8F6',
        brand: {
          50: '#EFF6F4',
          100: '#DCEEE9',
          200: '#B7DBD1',
          300: '#8CC3B3',
          400: '#5A9F8B',
          500: '#2F6F5E',
          600: '#245B4C',
          700: '#1C4A3E',
          800: '#173B32',
          900: '#122E27',
        },
      },
      fontFamily: {
        display: ['Manrope', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'ticket-perf': 'radial-gradient(circle, transparent 0, transparent 3px, transparent 3px)',
      },
    },
  },
  plugins: [],
}
