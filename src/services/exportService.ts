import * as XLSX from 'xlsx';

export interface ExportData {
  headers: string[];
  data: any[][];
  filename: string;
  sheetName?: string;
}

export class ExportService {
  /**
   * Exporta datos a Excel
   */
  static exportToExcel(exportData: ExportData): void {
    try {
      // Crear un nuevo workbook
      const workbook = XLSX.utils.book_new();
      
      // Crear los datos con headers
      const worksheetData = [exportData.headers, ...exportData.data];
      
      // Crear la hoja de trabajo
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Configurar el ancho de las columnas
      const columnWidths = exportData.headers.map(() => ({ wch: 15 }));
      worksheet['!cols'] = columnWidths;
      
      // Agregar la hoja al workbook
      XLSX.utils.book_append_sheet(
        workbook, 
        worksheet, 
        exportData.sheetName || 'Reporte'
      );
      
      // Generar el archivo y descargarlo
      XLSX.writeFile(workbook, `${exportData.filename}.xlsx`);
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      alert('Error al exportar a Excel. Por favor, intente nuevamente.');
    }
  }

  /**
   * Exporta datos a PDF (simulado - en una implementación real usarías jsPDF)
   */
  static exportToPDF(exportData: ExportData): void {
    try {
      // Crear contenido HTML para el PDF
      const htmlContent = this.generateHTMLTable(exportData);
      
      // Crear una nueva ventana para imprimir
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${exportData.filename}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 20px;
                color: #333;
              }
              h1 { 
                color: #f97316; 
                border-bottom: 2px solid #f97316;
                padding-bottom: 10px;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 20px;
              }
              th, td { 
                border: 1px solid #ddd; 
                padding: 8px; 
                text-align: left; 
              }
              th { 
                background-color: #f97316; 
                color: white; 
                font-weight: bold;
              }
              tr:nth-child(even) { 
                background-color: #f9f9f9; 
              }
              .header-info {
                margin-bottom: 20px;
                padding: 10px;
                background-color: #f5f5f5;
                border-radius: 5px;
              }
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header-info">
              <h1>Reporte Grifosis - ${exportData.filename}</h1>
              <p><strong>Fecha de generación:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>Hora:</strong> ${new Date().toLocaleTimeString()}</p>
            </div>
            ${htmlContent}
            <div class="no-print" style="margin-top: 20px;">
              <button onclick="window.print()" style="background-color: #f97316; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                Imprimir / Guardar como PDF
              </button>
              <button onclick="window.close()" style="background-color: #6b7280; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
                Cerrar
              </button>
            </div>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (error) {
      console.error('Error al exportar a PDF:', error);
      alert('Error al exportar a PDF. Por favor, intente nuevamente.');
    }
  }

  /**
   * Genera una tabla HTML a partir de los datos
   */
  private static generateHTMLTable(exportData: ExportData): string {
    const headerRow = exportData.headers
      .map(header => `<th>${header}</th>`)
      .join('');
    
    const dataRows = exportData.data
      .map(row => 
        `<tr>${row.map(cell => `<td>${cell || ''}</td>`).join('')}</tr>`
      )
      .join('');
    
    return `
      <table>
        <thead>
          <tr>${headerRow}</tr>
        </thead>
        <tbody>
          ${dataRows}
        </tbody>
      </table>
    `;
  }

  /**
   * Convierte datos de ventas para exportación
   */
  static prepareSalesData(salesData: any[]): ExportData {
    return {
      headers: ['Fecha', 'Ventas ($)', 'Órdenes', 'Ticket Promedio', 'Variación (%)'],
      data: salesData.map((item, index) => {
        const avgTicket = item.sales / item.orders;
        const prevItem = index > 0 ? salesData[index - 1] : null;
        const variation = prevItem ? ((item.sales - prevItem.sales) / prevItem.sales * 100) : 0;
        
        return [
          item.date,
          `$${item.sales.toLocaleString()}`,
          item.orders.toString(),
          `$${avgTicket.toFixed(2)}`,
          `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%`
        ];
      }),
      filename: `Reporte_Ventas_${new Date().toISOString().split('T')[0]}`
    };
  }

  /**
   * Convierte datos de empleados para exportación
   */
  static prepareEmployeeData(employeeData: any[]): ExportData {
    return {
      headers: ['Ranking', 'Empleado', 'Ventas ($)', 'Órdenes', 'Ticket Promedio', 'Comisión'],
      data: employeeData.map(employee => [
        employee.rank.toString(),
        employee.name,
        `$${employee.sales.toLocaleString()}`,
        employee.orders.toString(),
        `$${employee.avgTicket.toFixed(2)}`,
        `$${employee.commission.toLocaleString()}`
      ]),
      filename: `Reporte_Empleados_${new Date().toISOString().split('T')[0]}`
    };
  }

  /**
   * Convierte datos de inventario para exportación
   */
  static prepareInventoryData(inventoryData: any[]): ExportData {
    return {
      headers: ['Tanque', 'Producto', 'Stock Inicial', 'Stock Final', 'Movimiento', '% Capacidad', 'Estado'],
      data: inventoryData.map(tank => {
        const percentage = (tank.currentStock / tank.capacity) * 100;
        const status = percentage < 15 ? 'Crítico' : percentage < 30 ? 'Bajo' : 'Normal';
        
        return [
          tank.name,
          tank.product,
          `${tank.initialStock.toLocaleString()} L`,
          `${tank.finalStock.toLocaleString()} L`,
          `${tank.movement > 0 ? '+' : ''}${tank.movement.toLocaleString()} L`,
          `${percentage.toFixed(1)}%`,
          status
        ];
      }),
      filename: `Reporte_Inventario_${new Date().toISOString().split('T')[0]}`
    };
  }

  /**
   * Convierte datos de créditos para exportación
   */
  static prepareCreditsData(creditsData: any[]): ExportData {
    return {
      headers: ['Cliente', 'Monto', 'Fecha Vencimiento', 'Días Vencido', 'Estado', 'Vendedor'],
      data: creditsData.map(credit => {
        const status = credit.status === 'current' ? 'Al día' : 
                     credit.status === 'overdue' ? 'Vencido' : 'Crítico';
        
        return [
          credit.client,
          `$${credit.amount.toLocaleString()}`,
          new Date(credit.dueDate).toLocaleDateString(),
          credit.daysOverdue > 0 ? `+${credit.daysOverdue}` : credit.daysOverdue.toString(),
          status,
          credit.employee
        ];
      }),
      filename: `Reporte_Creditos_${new Date().toISOString().split('T')[0]}`
    };
  }

  /**
   * Convierte datos financieros para exportación
   */
  static prepareFinancialData(financialData: any[]): ExportData {
    return {
      headers: ['Fecha', 'Ingresos', 'Gastos', 'Flujo Neto', 'Margen %'],
      data: financialData.map(day => {
        const margin = ((day.net / day.income) * 100);
        
        return [
          new Date(day.date).toLocaleDateString(),
          `$${day.income.toLocaleString()}`,
          `$${day.expenses.toLocaleString()}`,
          `$${day.net.toLocaleString()}`,
          `${margin.toFixed(1)}%`
        ];
      }),
      filename: `Reporte_Financiero_${new Date().toISOString().split('T')[0]}`
    };
  }
}

