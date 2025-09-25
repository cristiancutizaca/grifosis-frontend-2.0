export interface SalesTrendDto {
    frecuencia: "day" | "week" | "month" | "year";
    totalVentas: string;      // Ej: "+12.5%"
    numVentas: string;        // Ej: "-4.0%"
    promedioVenta: string;    // Ej: "+3.2%"
}