import { Controller, Get, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';

type Scope = 'day' | 'month' | 'year';

@Controller('reports/gallons')
export class GallonsController {
  constructor(private readonly ds: DataSource) {}

  @Get()
  async getGallons(
    @Query('scope') scope: Scope = 'day',
    @Query('at') at?: string
  ) {
    // day | month | year
    const unit: Scope =
      scope === 'month' ? 'month' : scope === 'year' ? 'year' : 'day';

    const when = at ? new Date(at) : new Date();

    // Galones = total_amount (NETO) / unit_price del producto de la boquilla
    const rows = await this.ds.query(
      `
      SELECT COALESCE(SUM(s.total_amount / NULLIF(p.unit_price,0)), 0) AS gallons
      FROM sales s
      JOIN nozzles n  ON n.nozzle_id  = s.nozzle_id
      JOIN products p ON p.product_id = n.product_id
      WHERE s.status = 'completed'
        AND s.sale_timestamp >= date_trunc($1, $2::timestamp)
        AND s.sale_timestamp <  (date_trunc($1, $2::timestamp) + ('1 ' || $1)::interval)
      `,
      [unit, when.toISOString()]
    );

    const gallons = Number(rows?.[0]?.gallons ?? 0);
    return { scope: unit, at: when.toISOString(), gallons: Number(gallons.toFixed(2)) };
  }
}
