// src/utils/pdf/recibos.ts
// Util para generar y DESCARGAR el PDF del recibo interno (ticket 80mm o A4)
// Usa jsPDF + jspdf-autotable vía import dinámico (no infla el bundle principal).

export type VentaItem = {
  product_name?: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_amount?: number; // total por ítem (opcional)
};

export type VentaParaRecibo = {
  sale_id: number;
  created_at: string | Date;
  client?: { name?: string; doc_type?: string; doc_number?: string };
  items: VentaItem[];

  // Totales calculados en backend
  subtotal_amount: number;     // base (SIN IGV) ya con descuento aplicado
  igv_amount: number;          // IGV en moneda
  total_amount: number;        // TOTAL (CON IGV) ya con descuento aplicado

  // Informativos
  discount_amount?: number;    // monto de descuento
  gross_amount?: number;       // bruto pre-descuento (CON IGV), opcional
  payment_method?: { name?: string } | null;
  notes?: string;
};

export type EmpresaInfo = {
  nombre: string;
  ruc?: string;
  direccion?: string;
  telefono?: string;
  logoBase64?: string;
};

const f2 = (n: number) => Number(n ?? 0).toFixed(2);
const f3 = (n: number) => Number(n ?? 0).toFixed(3);
const dt = (d: string | Date) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  const p = (v: number) => String(v).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}`;
};

export async function generarReciboPDF({
  venta,
  empresa = { nombre: 'GRIFO S.A.C.', ruc: '20123456789', direccion: 'Av. Principal 123 - Lima' },
  formato = 'ticket80',
  fileName,
  moneda = 'PEN',
  igvRate = 0.18,
  currencySymbol = 'S/',
}: {
  venta: VentaParaRecibo;
  empresa?: EmpresaInfo;
  formato?: 'ticket80' | 'a4';
  fileName?: string;
  moneda?: string;
  igvRate?: number;
  currencySymbol?: string;
}) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default as any;

  const doc =
    formato === 'ticket80'
      ? new jsPDF({ unit: 'mm', format: [80, 200] })
      : new jsPDF({ unit: 'pt', format: 'a4' });

  // --- Layout comunes ---
  const leftX = formato === 'ticket80' ? 5 : 40;
  const rightX = formato === 'ticket80' ? 75 : (doc.internal as any).pageSize.getWidth() - 40;
  const lineGap = formato === 'ticket80' ? 3 : 10;
  const rowGap = formato === 'ticket80' ? 5 : 16;
  const amount = (n: number) => `${currencySymbol} ${f2(n)}`;

  let y = 8;

  const hr = () => {
    doc.setLineWidth(0.2);
    doc.line(leftX, y, rightX, y);
    y += lineGap;
  };

  const row = (label: string, value: string | number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, leftX, y);
    doc.text(typeof value === 'number' ? amount(value) : String(value), rightX, y, { align: 'right' });
    y += rowGap;
  };

  // ===== Encabezado =====
  if (formato === 'ticket80') {
    // Datos empresa más compactos y margen extra antes del título
    if (empresa.logoBase64) {
      try { doc.addImage(empresa.logoBase64, 'PNG', leftX, y, 20, 20); } catch {}
    }
    const textX = empresa.logoBase64 ? leftX + 23 : leftX;
    doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.text(empresa.nombre, textX, y + 6);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    let infoY = y + 11; // líneas más pegadas entre sí
    if (empresa.ruc)        { doc.text(`RUC: ${empresa.ruc}`, textX, infoY); infoY += 4.5; }
    if (empresa.direccion)  { doc.text(empresa.direccion, textX, infoY, { maxWidth: rightX - textX }); infoY += 4.5; }
    if (empresa.telefono)   { doc.text(`Tel: ${empresa.telefono}`, textX, infoY); infoY += 4.5; }

    // Margen extra antes del título para que el Tel no quede pegado
    y = Math.max(y + 20, infoY) + 4;

    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text(`RECIBO VENTA #${venta.sale_id}`, leftX, y); y += 5;

    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text(`Fecha: ${dt(venta.created_at)}`, leftX, y); y += 5;
    const cliNom = venta.client?.name || 'Consumidor Final';
    const cliDoc = [venta.client?.doc_type, venta.client?.doc_number].filter(Boolean).join(' ');
    doc.text(`Cliente: ${cliNom}`, leftX, y, { maxWidth: rightX - leftX }); y += 5;
    if (cliDoc) { doc.text(`Doc: ${cliDoc}`, leftX, y); y += 5; }
    const pago = venta.payment_method?.name;
    if (pago) { doc.text(`Pago: ${pago}`, leftX, y); y += 5; }
    if (venta.notes) { doc.text(`Obs: ${venta.notes}`, leftX, y, { maxWidth: rightX - leftX }); y += 5; }

    hr();
  } else {
    // A4: logo a la izquierda y bloque de texto compacto a la derecha
    const hasLogo = !!empresa.logoBase64;
    const logoSize = 110; // pt
    const gapLogoText = 24; // separación horizontal entre logo y texto
    if (hasLogo) {
      try { doc.addImage(empresa.logoBase64 as string, 'PNG', leftX, y, logoSize, logoSize); } catch {}
    }

    const textX = hasLogo ? leftX + logoSize + gapLogoText : leftX;
    let line = y + 18;          // línea base
    const infoGap = 18;         // líneas más juntas (pero legibles)

    doc.setFont('helvetica','bold'); doc.setFontSize(26);
    doc.text(empresa.nombre, textX, line); line += infoGap;

    doc.setFont('helvetica','normal'); doc.setFontSize(16);
    if (empresa.ruc)       { doc.text(`RUC: ${empresa.ruc}`, textX, line); line += infoGap; }
    if (empresa.direccion) { doc.text(empresa.direccion, textX, line); line += infoGap; }
    if (empresa.telefono)  { doc.text(`Tel: ${empresa.telefono}`, textX, line); line += infoGap; }

    // Margen extra entre bloque empresa y el título
    const blockBottom = hasLogo ? Math.max(y + logoSize, line) : line;
    y = blockBottom + 18; // aire extra para que Tel no quede pegado

    doc.setFont('helvetica','bold'); doc.setFontSize(28);
    doc.text(`RECIBO VENTA #${venta.sale_id}`, leftX, y); 
    y += 20;

    doc.setFont('helvetica','normal'); doc.setFontSize(18);
    doc.text(`Fecha: ${dt(venta.created_at)}`, leftX, y); y += 18;
    const cliNom = venta.client?.name || 'Consumidor Final';
    const cliDoc = [venta.client?.doc_type, venta.client?.doc_number].filter(Boolean).join(' ');
    doc.text(`Cliente: ${cliNom}`, leftX, y); y += 18;
    if (cliDoc) { doc.text(`Doc: ${cliDoc}`, leftX, y); y += 16; }
    const pago = venta.payment_method?.name;
    if (pago) { doc.text(`Pago: ${pago}`, leftX, y); y += 16; }
    if (venta.notes) { doc.text(`Obs: ${venta.notes}`, leftX, y, { maxWidth: rightX - leftX }); y += 16; }

    hr();
  }

  // ===== Items =====
  const rows = venta.items.map(it => {
    const name = it.product_name || it.description || 'Producto';
    const total = it.total_amount ?? (Number(it.quantity) * Number(it.unit_price));
    return [name, f3(Number(it.quantity)), amount(Number(it.unit_price)), amount(Number(total))];
  });

  autoTable(doc, {
    startY: y,
    head: [['Producto', 'Cant', 'P. Unit', 'Total']],
    body: rows,
    theme: 'plain',
    styles: { fontSize: formato === 'ticket80' ? 8 : 10 },
    headStyles: { fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: leftX, right: formato === 'ticket80' ? 5 : 40 },
  });

  y = (doc as any).lastAutoTable?.finalY ?? y;
  y += lineGap;

  // ===== Resumen =====
  hr();

  // Cálculo robusto del descuento (diseño intacto)
  const N = (v: any) => Number(v ?? 0);
  const totalC = N(venta.total_amount);
  const descDelDTO = N(venta.discount_amount);
  const itemsGross = venta.items.reduce((s, it) => s + N(it.quantity) * N(it.unit_price), 0);
  let brutoPre = N(venta.gross_amount);
  if (!(brutoPre > 0)) brutoPre = itemsGross > 0 ? itemsGross : totalC + descDelDTO;
  let descuento = descDelDTO > 0 ? descDelDTO : Math.max(0, brutoPre - totalC);

  // Orden: Descuento (info) -> Subtotal -> IGV -> TOTAL
  row('Descuento aplicado', `${amount(descuento)}`);
  row('Sub Total (con desc.)', N(venta.subtotal_amount));
  row(`IGV (${Math.round(igvRate * 100)}%)`, N(venta.igv_amount));
  doc.setFont('helvetica', 'bold');
  row('TOTAL', totalC, true);

  // Nota
  if (formato === 'ticket80') {
    hr();
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Documento no fiscal. Comprobante interno.', leftX, y, { maxWidth: rightX - leftX });
  } else {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
    doc.text('Documento no fiscal. Comprobante interno.', leftX, y + 2);
  }

  doc.save(fileName || `RECIBO_${venta.sale_id}.pdf`);
}
