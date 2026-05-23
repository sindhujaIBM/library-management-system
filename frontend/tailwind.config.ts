import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f5f7f0',
          100: '#e4ebd5',
          200: '#c8d8a9',
          300: '#a3bd75',
          400: '#7fa04a',
          500: '#5c7a2e',
          600: '#486022',
          700: '#384a1c',
          800: '#2c3a17',
          900: '#1e2810',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
