// src/utils/productColors.ts
// Paleta con buen contraste. Las clases deben estar visibles para Tailwind.
export const PRODUCT_COLOR_PALETTE = [
  { bg: 'bg-red-600',      text: 'text-white', hover: 'hover:bg-red-700' },
  { bg: 'bg-emerald-600',  text: 'text-white', hover: 'hover:bg-emerald-700' },
  { bg: 'bg-indigo-600',   text: 'text-white', hover: 'hover:bg-indigo-700' },
  { bg: 'bg-amber-500',    text: 'text-black', hover: 'hover:bg-amber-600' },
  { bg: 'bg-fuchsia-600',  text: 'text-white', hover: 'hover:bg-fuchsia-700' },
  { bg: 'bg-cyan-500',     text: 'text-black', hover: 'hover:bg-cyan-600' },
  { bg: 'bg-sky-600',      text: 'text-white', hover: 'hover:bg-sky-700' },
  { bg: 'bg-lime-500',     text: 'text-black', hover: 'hover:bg-lime-600' },
];

// Hash determinístico: “aleatorio estable” por id/nombre
const hash = (v: number | string) => {
  const s = String(v ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
};

type ColorClasses = {
  style?: { [k: string]: string };
  bgClass?: string;
  textClass: string;
  hoverClass: string;
};

// Si el backend envía color_hex, lo usamos; si no, usamos el hash por id/nombre
export const getClassesForProduct = (
  product: { id?: number | string; nombre?: string; color_hex?: string | null }
): ColorClasses => {
  if (product?.color_hex) {
    return { style: { backgroundColor: String(product.color_hex) }, textClass: 'text-white', hoverClass: '' };
  }
  const key = product?.id ?? product?.nombre ?? 'x';
  const idx = hash(key) % PRODUCT_COLOR_PALETTE.length;
  const c   = PRODUCT_COLOR_PALETTE[idx];
  return { bgClass: c.bg, textClass: c.text, hoverClass: c.hover };
};
