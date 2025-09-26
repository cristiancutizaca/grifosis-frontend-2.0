// ------------------------------
// Utilidades
// ------------------------------

export const formatCurrency = (n: number, currency: string = "PEN") =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(n);

export const formatNumber = (n: number) => new Intl.NumberFormat("es-PE").format(n);

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
