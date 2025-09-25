import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Sale } from './entities/sale.entity';
import { Nozzle } from '../nozzles/entities/nozzle.entity';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { PumpsModule } from '../pumps/pumps.module';
import { MeterReading } from '../meter-readings/entities/meter-reading.entity'; // Importación añadida

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, Nozzle, MeterReading]), // 'MeterReading' añadido aquí
    StockMovementsModule,
    PumpsModule
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}