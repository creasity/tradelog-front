/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Barlow Condensed', 'sans-serif'],
        body: ['Barlow', 'sans-serif'],
      },
      colors: {
        dark: {
          bg:      '#0a0b0f',
          surface: '#111318',
          card:    '#161820',
          border:  '#1e2028',
          hover:   '#1a1d26',
        },
        light: {
          bg:      '#f0f0ea',
          surface: '#ffffff',
          card:    '#fafaf7',
          border:  '#d8d8d2',
          hover:   '#e8e8e2',
        },
        profit: {
          DEFAULT: '#00d17a',
          dim:     '#00d17a20',
          muted:   '#00a85f',
        },
        loss: {
          DEFAULT: '#ff3b5c',
          dim:     '#ff3b5c20',
          muted:   '#cc2f4a',
        },
        accent: {
          DEFAULT: '#4f8ef7',
          dim:     '#4f8ef720',
        },
        warn: {
          DEFAULT: '#f5a623',
          dim:     '#f5a62320',
        },
      },
      animation: {
        'fade-up':    'fadeUp 0.4s ease forwards',
        'fade-in':    'fadeIn 0.3s ease forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer':    'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
