import XlsxPopulate from "xlsx-populate";

/**
 * rows: arreglo de objetos planos (ej: [{fecha: '2025-08-01', total: 123.45}, ...])
 * columns: orden y encabezados -> [{ key: 'fecha', header: 'Fecha' }, { key: 'total', header: 'Total (S/.)' }]
 */
export async function buildExcelBuffer(
  sheetName: string,
  rows: Array<Record<string, any>>,
  columns: Array<{ key: string; header: string }>,
): Promise<Buffer> {
  const workbook = await XlsxPopulate.fromBlankAsync();
  const sheet = workbook.sheet(0).name(sheetName || "Reporte");

  // Encabezados
  const headerRow = columns.map(c => c.header);
  sheet.cell(1, 1).value([headerRow]);

  // Datos
  const dataMatrix = rows.map(row =>
    columns.map(c => normalizeCell(row[c.key]))
  );
  if (dataMatrix.length) {
    sheet.cell(2, 1).value(dataMatrix);
  }

  // Estilos básicos
  const totalRows = Math.max(1, dataMatrix.length + 1);
  const totalCols = columns.length;

  // encabezado en negrita, fondo y bordes
  sheet
    .range(1, 1, 1, totalCols)
    .style({
      bold: true,
      fill: "EFEFEF",
      border: true,
      horizontalAlignment: "center",
      verticalAlignment: "center",
    });

  // bordes para todo el rango
  sheet.range(1, 1, totalRows, totalCols).style({ border: true });

  // Auto-fit columnas
  autoFitColumns(sheet, totalRows, totalCols);

  // Formatos por tipo (si detectas números, fechas, etc.)
  for (let col = 1; col <= totalCols; col++) {
    const values = dataMatrix.map(r => r[col - 1]).filter(v => v !== null && v !== undefined);
    if (values.every(isNumberLike)) {
      // formato número con 2 decimales
      sheet.column(col).style("numberFormat", "#,##0.00");
    }
    if (values.every(isDateLike)) {
      // formato fecha
      sheet.column(col).style("numberFormat", "yyyy-mm-dd");
    }
  }

  const arrayBuffer = await workbook.outputAsync(); // ArrayBuffer
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

function normalizeCell(v: any) {
  if (v === null || v === undefined) return "";
  // Date a objeto Date, números a Number, el resto string
  if (isDateLike(v)) return new Date(v);
  if (isNumberLike(v)) return Number(v);
  return String(v);
}

function isNumberLike(v: any) {
  return typeof v === "number" || (!isNaN(+v) && v !== "");
}

function isDateLike(v: any) {
  if (v instanceof Date) return true;
  // ISO / yyyy-mm-dd
  return typeof v === "string" && !isNaN(Date.parse(v));
}

function autoFitColumns(sheet: XlsxPopulate.Sheet, totalRows: number, totalCols: number) {
  for (let c = 1; c <= totalCols; c++) {
    let maxChars = 10; // mínimo
    for (let r = 1; r <= totalRows; r++) {
      const val = sheet.cell(r, c).value();
      const str = val instanceof Date ? val.toISOString().slice(0, 10) : String(val ?? "");
      maxChars = Math.max(maxChars, str.length);
    }
    // ancho aproximado (caracteres * factor)
    sheet.column(c).width(Math.min(60, Math.max(12, Math.ceil(maxChars * 1.2))));
  }
}
