/** @type {import('tailwindcss').Config} */

const { nextui } = require("@nextui-org/react");

module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}", // ← NUEVO: escanear src (utils/productColors.ts)
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],

  // ← NUEVO: blindar clases generadas dinámicamente por la utilidad de colores
  safelist: [
    // fondos
    "bg-red-600","bg-emerald-600","bg-indigo-600","bg-amber-500",
    "bg-fuchsia-600","bg-cyan-500","bg-sky-600","bg-lime-500",
    // hovers
    "hover:bg-red-700","hover:bg-emerald-700","hover:bg-indigo-700","hover:bg-amber-600",
    "hover:bg-fuchsia-700","hover:bg-cyan-600","hover:bg-sky-700","hover:bg-lime-600",
    // textos
    "text-white","text-black"
  ],

  theme: {
    extend: {
      backgroundImage: {
        // Definir el degradado de morado a gris
        'gradient-purple-to-black': 'linear-gradient(to bottom, #6a0dad, #f5f5f5)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      fontFamily: {
        'roboto': ['Roboto', 'system-ui'],
      },
      colors: {
        'gray-light': '#020617', // Añadir color gris claro
        'primaryblue': '#020617',
        'primaryblack': '#f0f0f0',
        'purple-dark': '#020617', // Morado oscuro 
        'primaryBlue': '#0060ff', 
        'primaryGreen': '#a1d302', 
      },
      textColor: {
        'textrosa': '#0060ff',
        'textblue': '#0060ff',
      },
      animation: {
        'spin-slow-30': 'spin 30s linear infinite',
        'spin-slow-25': 'spin 25s linear infinite',
        'spin-slow-10': 'spin 10s linear infinite',
        'marquee-infinite': 'marquee 25s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        marquee2: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0%)' },
        },
      },
    },
  },
  darkMode: "class",
  plugins: [
    require('daisyui'),
    nextui({
      themes: {
        // Puedes añadir configuraciones de temas personalizados aquí si es necesario
      },
    }),
  ],
};
