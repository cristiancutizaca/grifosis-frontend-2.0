import ApiService from "./apiService";
import { Settings, UpdateSettings } from "../../app/grifo-configuracion/types/settings";
import { Health } from "../../app/grifo-configuracion/types/health";

class SettingsService {
    private api = ApiService;
    private basePoint = "/settings";

    async getSettings(): Promise<Settings> {
        return await this.api.get<Settings>(`${this.basePoint}`);
    }

    async updateSettings(settings: UpdateSettings): Promise<void> {
        await this.api.put<Settings>(`${this.basePoint}`, settings);
    }

    async getShifts(): Promise<Record<string, string>> {
        return await this.api.get<Record<string, string>>(`${this.basePoint}/shifts`);
    }

    async getHealth(): Promise<Health> {
        return await this.api.get(`${this.basePoint}/health`);
    }
}

const settingsService = new SettingsService();
export default settingsService;
