// src/utils/empresaInfo.ts
import apiService from '../services/apiService';

export type EmpresaHeader = {
  nombre: string;
  ruc?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  logoBase64?: string; // PNG/JPG en base64 (sin prefijo data:)
};

// Convierte URL de imagen -> base64 (sin "data:image/...;base64,")
// Antes (mal tipado): Promise<string>
async function urlToBase64NoPrefix(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();

    // 👇 OJO: tipar también el new Promise como <string | undefined>
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
        resolve(base64 || undefined);            // ahora es válido
      };

      reader.onerror = () => resolve(undefined); // ahora es válido
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}


/**
 * Lee la info del grifo desde la tabla `sentings` y la adapta
 * para el encabezado del PDF (nombre, ruc, dirección, etc.).
 */
export async function getEmpresaHeader(): Promise<EmpresaHeader> {
  try {
    const raw = await apiService.get<any>('/sentings'); // <- tu tabla
    const s = Array.isArray(raw) ? (raw[0] ?? {}) : (raw ?? {});

    const nombre    = s?.grifo_name        ?? s?.company_name    ?? s?.name       ?? s?.nombre ?? 'GRIFO';
    const ruc       = s?.ruc               ?? s?.company_ruc     ?? s?.ruc_number ?? undefined;
    const direccion = s?.direccion         ?? s?.company_address ?? s?.address    ?? undefined;
    const telefono  = s?.telefono          ?? s?.company_phone   ?? s?.phone      ?? undefined;
    const email     = s?.email             ?? s?.company_email   ?? undefined;

    // Logo: base64 directo o URL a convertir
    const base64Directo = s?.company_logo_base64 ?? s?.logo_base64 ?? undefined;
    const logoUrl       = s?.company_logo_url ?? s?.logo_url ?? s?.logo ?? undefined;

    let logoBase64 = base64Directo;
    if (!logoBase64 && logoUrl) logoBase64 = await urlToBase64NoPrefix(String(logoUrl));

    return { nombre, ruc, direccion, telefono, email, logoBase64 };
  } catch {
    return { nombre: 'GRIFO' };
  }
}
