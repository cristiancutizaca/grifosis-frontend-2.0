import { paymentMethods } from "./payment-methods";

export interface Settings {
    // Datos de la empresa
    setting_id: number;
    company_ruc: string;
    company_name: string;
    address: string | null;
    phone: string | null;
    email: string;
    web_address: string | null;
    social_networks: string[] | null;
    logo: string | null;

    // Datos operacionales
    shift_hours: { [key: string]: string } | null;
    payment_methods: string | null;
    currency: string | null;
    invoices: string | null;

    // Cinfiguraciones del sistema
    backup_path: string | null;
    created_at: Date | string;
    updated_at: Date | string;
}

// Tipo para actualización que excluye propiedades del sistema
export type UpdateSettings = Omit<Settings, 'setting_id' | 'created_at' | 'updated_at'>;

export interface socialNetworks {
    url: string;
}

export interface shiftHours {
    shift_name: string;
    hour_start: string;
    hour_end: string;
}

export interface typeCurrency {
    name: string;
}
