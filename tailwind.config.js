/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        memrico: {
          bg: '#020617',
          surface: '#020617',
          surfaceMuted: '#020617',
          accent: '#38bdf8',
        },
      },
    },
  },
  darkMode: 'class',
  plugins: [],
}

