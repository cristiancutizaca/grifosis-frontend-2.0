// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ScheduleModule } from '@nestjs/schedule';

// Entidades
import { Product } from './entities/product.entity';
import { Client } from './entities/client.entity';
import { Employee } from './entities/employee.entity';

// Módulos existentes
import { ProductsModule } from './products/products.module';
import { SettingsModule } from './settings/settings.module';
import { EmployeesModule } from './employees/employees.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { SaleDetailsModule } from './sale-details/sale-details.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { DeliveryDetailsModule } from './delivery-details/delivery-details.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';
import { ExpenseCategoriesModule } from './expense-categories/expense-categories.module';
import { ExpensesModule } from './expenses/expenses.module';
import { CreditsModule } from './credits/credits.module';
import { MeterReadingsModule } from './meter-readings/meter-readings.module';
import { NozzlesModule } from './nozzles/nozzles.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { PaymentsModule } from './payments/payments.module';
import { PumpsModule } from './pumps/pumps.module';
import { PumpsTanksModule } from './PumpsTanks/pumps-tanks.module';
import { BackupModule } from './backup/backup.module';
import { BackupHistoryModule } from './backups-histories/backup-history.module';
import { BackupConfigModule } from './backup-config/backup-config.module';
import { SalesModule } from './sales/sales.module';
import { TanksModule } from './tanks/tanks.module';
import { ShiftsModule } from './shifts/shifts.module';
import { DiscountsModule } from './discounts/discounts.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { ReportsModule } from './reports/reports.module';

// NUEVO sub-módulo de reportes por cliente (separado del ReportsModule grande)
import { ClientsReportsModule } from './reports/clients/clients-reports.module';

// Controlador adicional
import { CashBoxController } from './cash-box.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),

    // TypeORM (sqlite/postgres según env)
    TypeOrmModule.forRoot(
      process.env.DATABASE_TYPE === 'sqlite'
        ? {
            type: 'better-sqlite3',
            database: process.env.DATABASE_PATH || './database.sqlite',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            logging: true,
          }
        : {
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            username: process.env.DB_USERNAME || 'grifosis_user',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_DATABASE || 'grifosis_db',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: false,
            logging: false,
          }
    ),

    // forFeature opcional (si lo necesitas en app.module)
    TypeOrmModule.forFeature([Product, Client, Employee]),

    // módulos existentes
    ProductsModule,
    SettingsModule,
    EmployeesModule,
    UsersModule,
    ClientsModule,
    SuppliersModule,
    DeliveriesModule,
    DeliveryDetailsModule,
    StockMovementsModule,
    ExpenseCategoriesModule,
    ExpensesModule,
    SaleDetailsModule,
    AuthModule,
    CreditsModule,
    MeterReadingsModule,
    NozzlesModule,
    PumpsModule,
    PumpsTanksModule,
    BackupModule,
    BackupHistoryModule,
    BackupConfigModule,
    PaymentMethodsModule,
    PaymentsModule,
    SalesModule,
    TanksModule,
    ShiftsModule,
    DiscountsModule,
    CashRegisterModule,
    ReportsModule,          // sigues teniendo tu módulo grande
    ClientsReportsModule,   // 👈 NUEVO: sub-módulo solo de “reportes por cliente”
  ],
  controllers: [
    AppController,
    CashBoxController,
  ],
  providers: [AppService],
})
export class AppModule {}
