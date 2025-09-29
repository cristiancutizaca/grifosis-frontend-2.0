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
  created_at: string;
  updated_at: string;
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

class ClientDriversService {
  private base(companyId: number) {
    return `/clients/${companyId}/drivers`;
  }

  async list(companyId: number, q?: string): Promise<ClientDriver[]> {
    const url = q ? `${this.base(companyId)}?q=${encodeURIComponent(q)}` : this.base(companyId);
    return api.get<ClientDriver[]>(url, { cache: 'no-store' } as RequestInit);
  }

  async create(companyId: number, body: CreateClientDriverBody): Promise<ClientDriver> {
    return api.post<ClientDriver>(this.base(companyId), body);
  }

  async update(companyId: number, driverId: number, body: UpdateClientDriverBody): Promise<ClientDriver> {
    return api.patch<ClientDriver>(`${this.base(companyId)}/${driverId}`, body);
  }

  async remove(companyId: number, driverId: number): Promise<{ ok: true }> {
    return api.delete<{ ok: true }>(`${this.base(companyId)}/${driverId}`);
  }
}

export default new ClientDriversService();
