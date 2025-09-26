import ApiService from "./apiService";
import { discount } from "../../app/grifo-configuracion/types/discounts";

class DiscountService {
    private api = ApiService;
    private basePoint = "/discounts";

    async createDiscount(data: Omit<discount, "id" | "created_at">): Promise<discount> {
        return await this.api.post<discount>(this.basePoint, data);
    }
    
    async getDiscounts(): Promise<discount[]> {
        return await this.api.get<discount[]>(this.basePoint);
    }

    async updateDiscount(id: number, data: Partial<discount>): Promise<discount> {
        return await this.api.patch<discount>(`${this.basePoint}/${id}`, data);
    }

    async deleteDiscount(id: number): Promise<void> {
        await this.api.delete(`${this.basePoint}/${id}`);
    }
}

const discountService = new DiscountService();
export default discountService;
