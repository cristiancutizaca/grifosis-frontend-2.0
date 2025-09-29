// src/services/clientDriversService.ts
import api from './apiService';

export interface ClientDriver {
  driver_id: number;
  company_id: number;
  company_name?: string | null;
  full_name: string;
  dni?: string | null;
  driver_license?: string | null;
  plate?: string | null;
  phone?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateClientDriverBody {
  full_name: string;
  dni?: string;
  driver_license?: string;
  plate?: string;
  phone?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  is_active?: boolean;
  notes?: string;
}

export type UpdateClientDriverBody = Partial<CreateClientDriverBody>;

/** Opciones listas para un <select> de conductores */
export type DriverOption = {
  value: number;
  label: string;
  subtitle?: string; // placa o DNI
  plate?: string;
  dni?: string;
};

class ClientDriversService {
  private base(companyId: number) {
    return `/clients/${companyId}/drivers`;
  }

  /** Normaliza/sanea strings y setea defaults seguros antes de enviar al backend */
  private clean<T extends Partial<CreateClientDriverBody>>(body: T): T {
    const t = (s?: string) => (typeof s === 'string' ? s.trim() : undefined);
    return {
      ...body,
      full_name: t(body.full_name) ?? '',
      dni: t(body.dni),
      driver_license: t(body.driver_license),
      plate: t(body.plate),
      phone: t(body.phone),
      vehicle_brand: t(body.vehicle_brand),
      vehicle_model: t(body.vehicle_model),
      vehicle_color: t(body.vehicle_color),
      notes: t(body.notes),
      is_active: body.is_active ?? true,
    } as T;
  }

  /** Lista (con soporte de búsqueda y filtro activo) */
  async list(
    companyId: number,
    opts?: { q?: string; active?: boolean }
  ): Promise<ClientDriver[]> {
    const params = new URLSearchParams();
    if (opts?.q) params.set('q', opts.q);
    if (opts?.active) params.set('active', 'true');
    const url = `${this.base(companyId)}${params.toString() ? `?${params.toString()}` : ''}`;
    return api.get<ClientDriver[]>(url, { cache: 'no-store' } as RequestInit);
  }

  /** Lista solo activos (con búsqueda opcional) */
  async listActive(companyId: number, q?: string): Promise<ClientDriver[]> {
    return this.list(companyId, { q, active: true });
  }

  /** Obtiene un conductor específico */
  async getOne(companyId: number, driverId: number): Promise<ClientDriver> {
    return api.get<ClientDriver>(`${this.base(companyId)}/${driverId}`, { cache: 'no-store' } as RequestInit);
  }

  /** Crea conductor (sanitiza payload) */
  async create(companyId: number, body: CreateClientDriverBody): Promise<ClientDriver> {
    return api.post<ClientDriver>(this.base(companyId), this.clean(body));
  }

  /** Actualiza conductor (sanitiza payload) */
  async update(
    companyId: number,
    driverId: number,
    body: UpdateClientDriverBody
  ): Promise<ClientDriver> {
    return api.patch<ClientDriver>(`${this.base(companyId)}/${driverId}`, this.clean(body));
  }

  /** Elimina conductor */
  async remove(companyId: number, driverId: number): Promise<{ ok: true }> {
    return api.delete<{ ok: true }>(`${this.base(companyId)}/${driverId}`);
  }

  /** Opciones listas para <select> (solo activos, ordenadas por nombre) */
  async getSelectOptions(companyId: number, q?: string): Promise<DriverOption[]> {
    const list = await this.listActive(companyId, q);
    return list
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
      .map((d) => ({
        value: d.driver_id,
        label: d.full_name ?? `Conductor ${d.driver_id}`,
        subtitle: d.plate || d.dni || undefined,
        plate: d.plate ?? undefined,
        dni: d.dni ?? undefined,
      }));
  }
}

export default new ClientDriversService();
