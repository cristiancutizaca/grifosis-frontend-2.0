import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

// límites
import { LimitsController } from './limits/limits.controller';
import { LimitsService } from './limits/limits.service';

// 👇 importa tu entidad Client (ajusta la ruta si difiere)
import { Client } from './entities/client.entity';
// (opcional: otras entidades si ClientsService las usa)
import { Product } from '../products/entities/product.entity';
import { Sale } from '../sales/entities/sale.entity';
import { SaleDetail } from '../sale-details/entities/sale-detail.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';

@Module({
  imports: [
    // 👈 registra aquí las entidades que `ClientsService` inyecta vía repositorio
    TypeOrmModule.forFeature([Client, Product, Sale, SaleDetail, PaymentMethod]),
  ],
  controllers: [
    ClientsController,
    LimitsController,
  ],
  providers: [
    ClientsService,
    LimitsService,
  ],
  exports: [
    ClientsService,
    LimitsService,
  ],
})
export class ClientsModule {}
