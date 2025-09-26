import apiService from './apiService';
import { Client as Cliente } from "../../app/grifo/types/dashboard"

// Interfaz principal del cliente con campos clásicos y nuevos
export interface Client {
  client_id: number;
  nombre: string;
  apellido: string;
  documento: string;
  tipo_documento: string;
  telefono: string;
  email: string;
  direccion: string;
  tipo_cliente: 'persona' | 'empresa';
  limite_credito: number;
  credito_disponible: number;
  estado: 'activo' | 'inactivo' | 'suspendido';
  fecha_registro: string;
  fecha_actualizacion: string;
  // Nuevos campos opcionales (para edición/creación avanzada)
  first_name?: string;
  last_name?: string;
  company_name?: string | null;
  category?: string;
  document_type?: string;
  document_number?: string;
  address?: string;
  phone?: string;
  birth_date?: string;
  notes?: string;
  client_type?: 'persona' | 'empresa';
  created_at?: string;
  updated_at?: string;
}

// Datos requeridos para crear un cliente
export interface CreateClientData {
  first_name?: string;
  last_name?: string;
  company_name?: string | null;
  category?: string;
  document_type?: string;
  document_number?: string;
  address?: string;
  phone?: string;
  email?: string;
  birth_date?: string | null;
  notes?: string;
  client_type?: 'persona' | 'empresa';
  tipo_documento?: string;
  limite_credito?: number;
}

// Datos para actualizar un cliente (id + parcial del resto)
export interface UpdateClientData extends Partial<CreateClientData> {
  client_id: number;
}

/* ========= NUEVO: forma unificada y helpers sin romper lo existente ========= */

export type ClientUnified = {
  client_id: number;
  client_type: 'persona' | 'empresa';
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  document_number?: string | null;
  /** Nombre listo para UI */
  name: string;
};

/** Normaliza un cliente cualquiera a la forma usada por el módulo de créditos */
export function normalizeClient(raw: Client): ClientUnified {
  const client_type =
    (raw.client_type ?? raw.tipo_cliente ?? 'persona') as 'persona' | 'empresa';

  const first_name = raw.first_name ?? raw.nombre ?? null;
  const last_name  = raw.last_name  ?? raw.apellido ?? null;
  const company    = raw.company_name ?? null;
  const docNumber  = raw.document_number ?? raw.documento ?? null;

  const personName = `${first_name ?? ''} ${last_name ?? ''}`.trim();
  const name =
    client_type === 'empresa'
      ? (company || `Cliente ${raw.client_id}`)
      : (personName || `Cliente ${raw.client_id}`);

  return {
    client_id: raw.client_id,
    client_type,
    first_name,
    last_name,
    company_name: company,
    document_number: docNumber,
    name,
  };
}

/** Devuelve un nombre presentable desde cualquier forma */
export function getDisplayName(c: Client | ClientUnified): string {
  const isUnified = (x: any): x is ClientUnified =>
    typeof (x as any).name === 'string' && 'client_type' in x;
  if (isUnified(c)) return c.name;

  const n = normalizeClient(c);
  return n.name;
}

/* ============================ Servicio ============================ */

class ClientService {
  private endpoint = '/clients';

  // Obtener todos los clientes
  async getAllClients(): Promise<Client[]> {
    return apiService.get<Client[]>(this.endpoint);
  }

  async getClients(): Promise<Cliente[]> {
    return apiService.get<Cliente[]>(this.endpoint);
  }

  /** NUEVO: lista ya normalizada (ideal para el módulo de créditos) */
  async getAllClientsUnified(): Promise<ClientUnified[]> {
    const raw = await this.getAllClients();
    return raw.map(normalizeClient);
  }

  /** NUEVO: diccionario { client_id -> ClientUnified } */
  async getAllClientsMap(): Promise<Record<number, ClientUnified>> {
    const list = await this.getAllClientsUnified();
    const map: Record<number, ClientUnified> = {};
    for (const c of list) map[c.client_id] = c;
    return map;
  }

  // Obtener cliente por ID
  async getClientById(id: number): Promise<Client> {
    return apiService.get<Client>(`${this.endpoint}/${id}`);
  }

  // Crear un nuevo cliente
  async createClient(clientData: CreateClientData): Promise<Client> {
    return apiService.post<Client>(this.endpoint, clientData);
  }

  // 🧠 ACTUALIZADO: Usamos PATCH para no romper tu backend
  async updateClient(clientData: UpdateClientData): Promise<Client> {
    const { client_id, ...data } = clientData;
    return apiService.patch<Client>(`${this.endpoint}/${client_id}`, data);
  }

  // Eliminar cliente
  async deleteClient(id: number): Promise<void> {
    return apiService.delete<void>(`${this.endpoint}/${id}`);
  }

  // Buscar clientes por texto libre
// HOY (frontend)
// src/services/clientService.ts  ✅ REEMPLAZA SOLO ESTE MÉTODO
  async searchClients(query: string): Promise<Client[]> {
    return apiService.get<Client[]>(`${this.endpoint}?search=${encodeURIComponent(query)}`);
  }


  // Obtener clientes filtrados por tipo (persona/empresa)
  async getClientsByType(tipo: 'persona' | 'empresa'): Promise<Client[]> {
    return apiService.get<Client[]>(`${this.endpoint}?tipo_cliente=${tipo}`);
  }

  // Obtener clientes que tengan crédito
  async getClientsWithCredit(): Promise<Client[]> {
    return apiService.get<Client[]>(`${this.endpoint}?con_credito=true`);
  }

  // Actualizar solo el crédito de un cliente
  async updateClientCredit(id: number, nuevoLimite: number): Promise<Client> {
    return apiService.patch<Client>(`${this.endpoint}/${id}/credito`, {
      limite_credito: nuevoLimite
    });
  }

  // Obtener historial de transacciones de un cliente
  async getClientTransactions(id: number): Promise<any[]> {
    return apiService.get<any[]>(`${this.endpoint}/${id}/transacciones`);
  }
}

export default new ClientService();
