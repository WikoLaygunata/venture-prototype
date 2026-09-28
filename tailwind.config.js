/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        /* Brand pastel palette — Gen Z friendly */
        kenalan: {
          50: '#f3f1ff',
          100: '#e9e5ff',
          200: '#d5cdff',
          300: '#b8a9ff',
          400: '#977dff',
          500: '#7c56f7',
          600: '#6b3ceb',
          700: '#5a2cd0',
          800: '#4b26aa',
          900: '#3f2288',
        },
        /* Color-code statuses */
        mint: {
          soft: '#e6fbf1',
          DEFAULT: '#34d399',
          deep: '#0f7a58',
        },
        sunny: {
          soft: '#fff6e0',
          DEFAULT: '#fbbf24',
          deep: '#92600a',
        },
        smoke: {
          soft: '#f1f3f7',
          DEFAULT: '#94a3b8',
          deep: '#475569',
        },
        blush: {
          soft: '#ffe9ef',
          DEFAULT: '#fb7185',
          deep: '#9f1239',
        },
      },
      boxShadow: {
        card: '0 4px 24px -8px rgba(76, 46, 160, 0.18)',
        fab: '0 12px 28px -6px rgba(124, 86, 247, 0.55)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.28s ease-out both',
        'sheet-up': 'sheet-up 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.2s ease-out both',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
      },
    },
  },
  plugins: [],
}
