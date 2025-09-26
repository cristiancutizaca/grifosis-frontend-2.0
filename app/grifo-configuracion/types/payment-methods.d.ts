export interface paymentMethod {
    payment_method_id: number;
    method_name: string;
    description?: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}
