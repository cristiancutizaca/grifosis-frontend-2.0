// src/clients/interfaces/client-contact.interface.ts

export interface ClientContact {
  type: 'phone' | 'email' | 'whatsapp';
  value: string;
  isPrimary: boolean;
  notes?: string;
}
