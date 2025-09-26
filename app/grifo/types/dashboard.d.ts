type ID = string | number;

export interface SalesTrend {
  frecuencia: "day" | "week" | "month" | "year";
  totalVentas: string;
  numVentas: string;
  promedioVenta: string;
}

export interface Client {
  client_id: ID;
  client_type: string;
  company_name?: any;
  first_name?: string;
  last_name?: string;
  category?: string; // credito, contado, moroso, frecuente 
  document_type?: any;
  document_number?: any;
  address?: any,
  phone?: any,
  email?: any,
  birth_date?: any,
  notes?: any,
  created_at?: any,
  updated_at?: any,
}

export interface User {
  user_id: ID;
  username: string;
  role: "admin" | "seller" | "superadmin";
  full_name: string;
  created_at: string;
}

export interface Payment {
  payment_id: ID;
  user_id: ID;
  sale_id: ID;
  payment_timestamp: string; // ISO 8601
  amount: number;
  payment_method_id: ID;
  notes?: string;
}

export interface Sale {
  sale_id: ID;
  client_id: ID;
  user_id: ID;
  employee_id: ID;
  nozzle_id: ID;
  sale_timestamp: string;
  total_amount: number;
  payment_method_id: ID;
  status: "completed" | "cancelled";
  shift: string;
  discount_amount: number;
  final_amount: number; // fianl_amount = total_amount - discount_amount
}

export interface Credit {
  credit_id: ID;
  client_id: ID;
  sale_id: ID;
  credit_amount: number;
  amount_paid: number;
  due_date: string;
  status: "pending" | "paid" | "overdue";
  created_at: string;
  updated_at: string | null;
  client: { client_id: number };
  sale: { sale_id: number };
}
