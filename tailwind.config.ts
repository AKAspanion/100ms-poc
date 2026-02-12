import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
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
};

export default config;
