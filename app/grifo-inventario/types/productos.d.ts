export interface Product {
  product_id: number;
  name: string;
  description: string | null;
  category: string;
  fuel_type: string | null;
  unit: string;
  unit_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}
