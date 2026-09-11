import type { Config } from 'tailwindcss';

/**
 * Palette identica a quella della web app clienti (teal + slate), cosi' la
 * console non sembra un prodotto diverso. Copiata e non importata: le due app
 * sono indipendenti di proposito e non devono condividere build.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4',
          400: '#2DD4BF', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E',
          800: '#115E59', 900: '#0D3B3B', 950: '#042F2E',
        },
        slate: {
          50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1',
          400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155',
          800: '#1E293B', 900: '#0F172A', 950: '#020617',
        },
        success: { 50: '#F0FDF4', 500: '#22C55E', 700: '#15803D' },
        warning: { 50: '#FFFBEB', 500: '#F59E0B', 700: '#B45309' },
        danger: { 50: '#FEF2F2', 500: '#EF4444', 700: '#B91C1C' },
        info: { 50: '#EFF6FF', 500: '#3B82F6', 700: '#1D4ED8' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
