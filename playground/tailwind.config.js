/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dde7fe',
          200: '#c3d4fd',
          300: '#9ab7fb',
          400: '#6990f8',
          500: '#4166f3',
          600: '#2b47e8',
          700: '#2235d5',
          800: '#222dac',
          900: '#212b88',
          950: '#181d55',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
