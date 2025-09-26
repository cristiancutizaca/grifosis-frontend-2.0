import { Surtidores } from "./surtidores";
import { Tanks } from "./tanques";

export interface SurtidoresTanques {
    id: number;
    pump: Surtidores;
    tank: Tanks;
    created_at: string;
    updated_at: string;
}